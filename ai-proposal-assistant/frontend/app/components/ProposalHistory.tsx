"use client";

import { useEffect, useState } from "react";
import {
  getProposals,
  markResult,
  updatePrice,
  type Proposal,
} from "@/lib/api";
import Loader from "./Loader";

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
  const [searchText, setSearchText] = useState("");
  const [filterResult, setFilterResult] = useState<string>("all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

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
      <div className="py-12">
        <Loader size={40} text="Cargando historial..." />
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parseAnalysis = (p: Proposal): Record<string, any> => {
    try { return JSON.parse(p.analysis); } catch { return {}; }
  };

  const filteredProposals = proposals.filter((p) => {
    const a = parseAnalysis(p);
    const response = p.responses?.[0];

    // Text search: client_text, technologies, project_type, complexity
    if (searchText) {
      const q = searchText.toLowerCase();
      const techs = Array.isArray(a.technologies) ? a.technologies.join(" ") : String(a.technologies || "");
      const searchable = [
        p.client_text,
        String(a.project_type || ""),
        String(a.complexity || ""),
        techs,
        String(a.suggested_architecture || ""),
      ].join(" ").toLowerCase();
      if (!searchable.includes(q)) return false;
    }

    // Result filter
    if (filterResult !== "all") {
      const currentResult = response?.result || "no_response";
      if (currentResult !== filterResult) return false;
    }

    // Price range
    const price = response?.price_charged;
    if (priceMin && (!price || price < parseFloat(priceMin))) return false;
    if (priceMax && (!price || price > parseFloat(priceMax))) return false;

    // Date range
    const created = new Date(p.created_at);
    if (dateFrom && created < new Date(dateFrom)) return false;
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (created > to) return false;
    }

    return true;
  });

  const hasActiveFilters = searchText || filterResult !== "all" || priceMin || priceMax || dateFrom || dateTo;

  const clearFilters = () => {
    setSearchText("");
    setFilterResult("all");
    setPriceMin("");
    setPriceMax("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="bg-surface-card rounded-xl border border-surface-border p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar por tecnología, tipo de proyecto, texto..."
              className="w-full pl-10 pr-3 py-2 text-sm bg-surface-dark border border-surface-border rounded-lg text-text-primary placeholder:text-text-muted focus:border-brand-orange focus:outline-none"
            />
          </div>
          <select
            value={filterResult}
            onChange={(e) => setFilterResult(e.target.value)}
            className="px-3 py-2 text-sm bg-surface-dark border border-surface-border rounded-lg text-text-primary focus:border-brand-orange focus:outline-none"
          >
            <option value="all">Todos</option>
            <option value="won">Ganadas</option>
            <option value="lost">Perdidas</option>
            <option value="no_response">Sin respuesta</option>
          </select>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 text-sm border rounded-lg transition-colors ${
              showFilters || (priceMin || priceMax || dateFrom || dateTo)
                ? "bg-brand-orange/15 border-brand-orange text-brand-orange"
                : "bg-surface-dark border-surface-border text-text-muted hover:text-text-primary"
            }`}
          >
            Filtros
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm bg-surface-dark border border-surface-border rounded-lg text-red-400 hover:bg-red-600/10 transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Extended filters */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-surface-border">
            <div>
              <label className="block text-xs text-text-muted mb-1">Precio mín</label>
              <input
                type="number"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                placeholder="$0"
                className="w-full px-3 py-1.5 text-sm bg-surface-dark border border-surface-border rounded-lg text-text-primary focus:border-brand-orange focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Precio máx</label>
              <input
                type="number"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                placeholder="$∞"
                className="w-full px-3 py-1.5 text-sm bg-surface-dark border border-surface-border rounded-lg text-text-primary focus:border-brand-orange focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Desde</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-surface-dark border border-surface-border rounded-lg text-text-primary focus:border-brand-orange focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Hasta</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-surface-dark border border-surface-border rounded-lg text-text-primary focus:border-brand-orange focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Results count */}
        <div className="text-xs text-text-muted">
          {filteredProposals.length} de {proposals.length} propuestas
          {hasActiveFilters && " (filtrado)"}
        </div>
      </div>

      {filteredProposals.length === 0 && hasActiveFilters && (
        <div className="text-center text-text-muted py-8">
          No se encontraron propuestas con esos filtros.
        </div>
      )}

      {filteredProposals.map((proposal) => {
        const response = proposal.responses?.[0];
        const currentResult = response?.result || "no_response";
        const priceCharged = response?.price_charged;
        const isExpanded = expandedId === proposal.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let analysis: Record<string, any> = {};
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
