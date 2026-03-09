"use client";

import { useEffect, useState } from "react";
import {
  getProposals,
  markResult,
  updatePrice,
  type Proposal,
} from "@/lib/api";

const RESULT_OPTIONS = [
  { value: "won", label: "Ganada", color: "bg-brand-orange" },
  { value: "lost", label: "Perdida", color: "bg-red-600" },
  { value: "no_response", label: "Sin respuesta", color: "bg-text-muted" },
] as const;

export default function ProposalHistory() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceValue, setPriceValue] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchProposals = async () => {
    try {
      const data = await getProposals();
      setProposals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const handleMarkResult = async (
    proposalId: string,
    result: "won" | "lost" | "no_response"
  ) => {
    try {
      await markResult(proposalId, result);
      await fetchProposals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    }
  };

  const handleSavePrice = async (proposalId: string) => {
    const price = parseFloat(priceValue);
    if (isNaN(price) || price <= 0) return;
    try {
      await updatePrice(proposalId, price);
      setEditingPriceId(null);
      setPriceValue("");
      await fetchProposals();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al guardar precio"
      );
    }
  };

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="text-center text-text-secondary py-12">
        Cargando historial...
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-400 py-12">{error}</div>;
  }

  if (proposals.length === 0) {
    return (
      <div className="text-center text-text-muted py-12">
        No hay propuestas en el historial.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {proposals.map((proposal) => {
        const response = proposal.responses?.[0];
        const currentResult = response?.result || "no_response";
        const priceCharged = response?.price_charged;
        const isExpanded = expandedId === proposal.id;
        let analysis: Record<string, unknown> = {};
        try {
          analysis = JSON.parse(proposal.analysis);
        } catch {
          // ignore parse errors
        }

        return (
          <div
            key={proposal.id}
            className="bg-surface-card rounded-xl border border-surface-border"
          >
            {/* Header */}
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="text-xs text-text-muted">
                    {new Date(proposal.created_at).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  {priceCharged && (
                    <span className="px-2 py-0.5 text-xs bg-brand-orange/15 text-brand-orange rounded">
                      ${priceCharged} USD
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  {RESULT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() =>
                        handleMarkResult(proposal.id, opt.value)
                      }
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        currentResult === opt.value
                          ? `${opt.color} text-white`
                          : "bg-surface-card-hover text-text-muted hover:bg-text-dark"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Proposal preview */}
              <div className="mb-3">
                <p className="text-sm text-text-secondary line-clamp-2">
                  {proposal.client_text}
                </p>
              </div>

              {/* Tags + price + actions */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  {analysis.project_type && (
                    <span className="px-2 py-0.5 text-xs bg-brand-orange/10 text-brand-orange rounded">
                      {String(analysis.project_type)}
                    </span>
                  )}
                  {analysis.complexity && (
                    <span className="px-2 py-0.5 text-xs bg-text-dark/50 text-text-secondary rounded">
                      {String(analysis.complexity)}
                    </span>
                  )}
                  {analysis.suggested_price_min != null && (
                    <span className="px-2 py-0.5 text-xs bg-brand-cream/10 text-brand-cream rounded">
                      Sugerido: ${String(analysis.suggested_price_min)}-$
                      {String(analysis.suggested_price_max)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Price input */}
                  {editingPriceId === proposal.id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-text-muted">$</span>
                      <input
                        type="number"
                        value={priceValue}
                        onChange={(e) => setPriceValue(e.target.value)}
                        placeholder="0"
                        className="w-20 px-2 py-1 text-xs bg-surface-dark border border-surface-border rounded text-text-primary focus:border-brand-orange focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            handleSavePrice(proposal.id);
                          if (e.key === "Escape") setEditingPriceId(null);
                        }}
                      />
                      <button
                        onClick={() => handleSavePrice(proposal.id)}
                        className="px-2 py-1 text-xs bg-brand-orange hover:bg-brand-orange-light text-white rounded transition-colors"
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingPriceId(proposal.id);
                        setPriceValue(priceCharged?.toString() || "");
                      }}
                      className="px-3 py-1 text-xs bg-surface-card-hover hover:bg-text-dark border border-surface-border rounded-lg transition-colors"
                    >
                      {priceCharged ? `$${priceCharged}` : "Precio"}
                    </button>
                  )}
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : proposal.id)
                    }
                    className="px-3 py-1 text-xs bg-surface-card-hover hover:bg-text-dark border border-surface-border rounded-lg transition-colors"
                  >
                    {isExpanded ? "Cerrar" : "Ver todo"}
                  </button>
                </div>
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-surface-border p-5 space-y-4">
                {/* Full proposal text with copy */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-text-secondary">
                      Propuesta del cliente (completa)
                    </h3>
                    <button
                      onClick={() =>
                        handleCopy(
                          proposal.id + "-proposal",
                          proposal.client_text
                        )
                      }
                      className="px-3 py-1 text-xs bg-surface-card-hover hover:bg-text-dark border border-surface-border rounded-lg transition-colors"
                    >
                      {copiedId === proposal.id + "-proposal"
                        ? "Copiado!"
                        : "Copiar propuesta"}
                    </button>
                  </div>
                  <div className="bg-surface-dark rounded-lg p-4 text-sm text-text-secondary max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {proposal.client_text}
                  </div>
                </div>

                {/* Analysis details */}
                {analysis.project_type && (
                  <div>
                    <h3 className="text-sm font-medium text-text-secondary mb-2">
                      Analisis
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-text-muted">Tipo:</span>{" "}
                        <span className="text-text-primary">
                          {String(analysis.project_type)}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted">Complejidad:</span>{" "}
                        <span className="text-text-primary">
                          {String(analysis.complexity)}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted">
                          Nivel cliente:
                        </span>{" "}
                        <span className="text-text-primary">
                          {String(analysis.client_technical_level)}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted">Urgencia:</span>{" "}
                        <span className="text-text-primary">
                          {String(analysis.urgency)}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-text-muted">Tecnologias:</span>{" "}
                        <span className="text-text-primary">
                          {Array.isArray(analysis.technologies)
                            ? (analysis.technologies as string[]).join(", ")
                            : String(analysis.technologies || "N/A")}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-text-muted">
                          Arquitectura:
                        </span>{" "}
                        <span className="text-text-primary">
                          {String(analysis.suggested_architecture || "N/A")}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Generated response with copy */}
                {response && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-text-secondary">
                        Respuesta generada
                      </h3>
                      <button
                        onClick={() =>
                          handleCopy(
                            proposal.id + "-response",
                            response.response_text
                          )
                        }
                        className="px-3 py-1 text-xs bg-brand-orange hover:bg-brand-orange-light text-white rounded-lg transition-colors"
                      >
                        {copiedId === proposal.id + "-response"
                          ? "Copiado!"
                          : "Copiar respuesta"}
                      </button>
                    </div>
                    <div className="bg-surface-dark rounded-lg p-4 whitespace-pre-wrap text-sm text-text-primary leading-relaxed">
                      {response.response_text}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
