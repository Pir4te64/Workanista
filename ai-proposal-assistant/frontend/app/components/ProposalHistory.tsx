"use client";

import { useEffect, useState } from "react";
import {
  getProposals,
  markResult,
  updatePrice,
  type Proposal,
} from "@/lib/api";
import Loader from "./Loader";
import { useToast } from "./Toast";
import DuckIcon from "./coldduck/DuckIcon";
import { FadeIn } from "./AnimatedList";

const RESULT_OPTIONS = [
  { value: "won", label: "Ganada", bg: "rgba(0, 245, 160, 0.15)", activeBg: "#00F5A0", activeText: "#0C0C1D" },
  { value: "lost", label: "Perdida", bg: "rgba(239, 68, 68, 0.15)", activeBg: "#ef4444", activeText: "#fff" },
  { value: "no_response", label: "Sin respuesta", bg: "rgba(255,255,255,0.06)", activeBg: "#6B6B85", activeText: "#fff" },
] as const;

export default function ProposalHistory() {
  const { addToast } = useToast();
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
      addToast("success", "Resultado actualizado");
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
    addToast("success", "Copiado al portapapeles");
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="py-16">
        <Loader size={40} text="Cargando historial..." />
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-400/80 py-16 text-sm">{error}</div>;
  }

  if (proposals.length === 0) {
    return (
      <FadeIn>
        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
          <DuckIcon size={56} />
          <p className="mt-4 text-sm">No hay propuestas en el historial.</p>
        </div>
      </FadeIn>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parseAnalysis = (p: Proposal): Record<string, any> => {
    try { return JSON.parse(p.analysis); } catch { return {}; }
  };

  const filteredProposals = proposals.filter((p) => {
    const a = parseAnalysis(p);
    const response = p.responses?.[0];

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

    if (filterResult !== "all") {
      const currentResult = response?.result || "no_response";
      if (currentResult !== filterResult) return false;
    }

    const price = response?.price_charged;
    if (priceMin && (!price || price < parseFloat(priceMin))) return false;
    if (priceMax && (!price || price > parseFloat(priceMax))) return false;

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

  const handleExportCSV = () => {
    const headers = ["fecha", "tipo_proyecto", "complejidad", "tecnologias", "precio_sugerido_min", "precio_sugerido_max", "precio_cobrado", "resultado", "texto_cliente"];
    const rows = filteredProposals.map((p) => {
      const a = parseAnalysis(p);
      const response = p.responses?.[0];
      const techs = Array.isArray(a.technologies) ? a.technologies.join("; ") : String(a.technologies || "");
      const clientText = (p.client_text || "").slice(0, 100).replace(/"/g, '""');
      return [
        new Date(p.created_at).toISOString().split("T")[0],
        String(a.project_type || ""),
        String(a.complexity || ""),
        techs,
        String(a.suggested_price_min ?? ""),
        String(a.suggested_price_max ?? ""),
        String(response?.price_charged ?? ""),
        String(response?.result || "no_response"),
        `"${clientText}"`,
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `propuestas_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    addToast("success", `${filteredProposals.length} propuestas exportadas`);
  };

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar por tecnologia, tipo de proyecto, texto..."
              className="input-premium pl-10 text-sm"
            />
          </div>
          <select
            value={filterResult}
            onChange={(e) => setFilterResult(e.target.value)}
            className="input-premium w-auto text-sm"
          >
            <option value="all">Todos</option>
            <option value="won">Ganadas</option>
            <option value="lost">Perdidas</option>
            <option value="no_response">Sin respuesta</option>
          </select>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary text-sm ${
              showFilters || (priceMin || priceMax || dateFrom || dateTo)
                ? "!border-brand-mint/30 !text-brand-mint"
                : ""
            }`}
          >
            Filtros
          </button>
          <button
            onClick={handleExportCSV}
            className="btn-primary text-sm"
          >
            Exportar CSV
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="btn-secondary text-sm !text-red-400/80 hover:!text-red-400"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Extended filters */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <div>
              <label className="section-title block mb-2">Precio min</label>
              <input
                type="number"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                placeholder="$0"
                className="input-premium text-sm py-2.5"
              />
            </div>
            <div>
              <label className="section-title block mb-2">Precio max</label>
              <input
                type="number"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                placeholder="$∞"
                className="input-premium text-sm py-2.5"
              />
            </div>
            <div>
              <label className="section-title block mb-2">Desde</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input-premium text-sm py-2.5"
              />
            </div>
            <div>
              <label className="section-title block mb-2">Hasta</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input-premium text-sm py-2.5"
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
        <FadeIn>
          <div className="flex flex-col items-center justify-center py-12 text-text-muted">
            <DuckIcon size={56} />
            <p className="mt-4 text-sm">No se encontraron propuestas con esos filtros.</p>
          </div>
        </FadeIn>
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
            className="glass-card transition-all duration-200 hover:shadow-card-hover"
          >
            {/* Header */}
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
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
                    <span className="badge" style={{ background: "rgba(0, 245, 160, 0.1)", color: "#00F5A0" }}>
                      ${priceCharged} USD
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  {RESULT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() =>
                        handleMarkResult(proposal.id, opt.value)
                      }
                      className="px-3 py-1.5 text-xs rounded-lg font-medium transition-all duration-200"
                      style={
                        currentResult === opt.value
                          ? { background: opt.activeBg, color: opt.activeText }
                          : { background: "rgba(255,255,255,0.04)", color: "#A0A0B8" }
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Proposal preview */}
              <p className="text-sm text-text-secondary line-clamp-2 mb-4 leading-relaxed">
                {proposal.client_text}
              </p>

              {/* Tags + price + actions */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  {analysis.project_type && (
                    <span className="badge" style={{ background: "rgba(0, 245, 160, 0.08)", color: "#00F5A0" }}>
                      {String(analysis.project_type)}
                    </span>
                  )}
                  {analysis.complexity && (
                    <span className="badge" style={{ background: "rgba(255,255,255,0.06)", color: "#A0A0B8" }}>
                      {String(analysis.complexity)}
                    </span>
                  )}
                  {analysis.suggested_price_min != null && (
                    <span className="badge" style={{ background: "rgba(0, 245, 160, 0.08)", color: "#00F5A0" }}>
                      Sugerido: ${String(analysis.suggested_price_min)}-$
                      {String(analysis.suggested_price_max)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Price input */}
                  {editingPriceId === proposal.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-text-muted">$</span>
                      <input
                        type="number"
                        value={priceValue}
                        onChange={(e) => setPriceValue(e.target.value)}
                        placeholder="0"
                        className="input-premium w-20 text-xs py-1.5 px-2"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            handleSavePrice(proposal.id);
                          if (e.key === "Escape") setEditingPriceId(null);
                        }}
                      />
                      <button
                        onClick={() => handleSavePrice(proposal.id)}
                        className="btn-primary text-xs px-2.5 py-1.5"
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
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      {priceCharged ? `$${priceCharged}` : "Precio"}
                    </button>
                  )}
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : proposal.id)
                    }
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    {isExpanded ? "Cerrar" : "Ver todo"}
                  </button>
                </div>
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="p-6 pt-0 space-y-5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <div className="pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="section-title">
                      Propuesta del cliente (completa)
                    </h3>
                    <button
                      onClick={() =>
                        handleCopy(
                          proposal.id + "-proposal",
                          proposal.client_text
                        )
                      }
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      {copiedId === proposal.id + "-proposal"
                        ? "Copiado!"
                        : "Copiar propuesta"}
                    </button>
                  </div>
                  <div className="rounded-xl p-5 text-sm text-text-secondary max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed" style={{ background: "rgba(255,255,255,0.03)" }}>
                    {proposal.client_text}
                  </div>
                </div>

                {/* Analysis details */}
                {analysis.project_type && (
                  <div>
                    <h3 className="section-title mb-3">
                      Analisis
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-text-muted">Tipo</span>
                        <p className="text-text-primary mt-0.5">
                          {String(analysis.project_type)}
                        </p>
                      </div>
                      <div>
                        <span className="text-text-muted">Complejidad</span>
                        <p className="text-text-primary mt-0.5">
                          {String(analysis.complexity)}
                        </p>
                      </div>
                      <div>
                        <span className="text-text-muted">Nivel cliente</span>
                        <p className="text-text-primary mt-0.5">
                          {String(analysis.client_technical_level)}
                        </p>
                      </div>
                      <div>
                        <span className="text-text-muted">Urgencia</span>
                        <p className="text-text-primary mt-0.5">
                          {String(analysis.urgency)}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-text-muted">Tecnologias</span>
                        <p className="text-text-primary mt-0.5">
                          {Array.isArray(analysis.technologies)
                            ? (analysis.technologies as string[]).join(", ")
                            : String(analysis.technologies || "N/A")}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-text-muted">Arquitectura</span>
                        <p className="text-text-primary mt-0.5">
                          {String(analysis.suggested_architecture || "N/A")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Generated response */}
                {response && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="section-title">
                        Respuesta generada
                      </h3>
                      <button
                        onClick={() =>
                          handleCopy(
                            proposal.id + "-response",
                            response.response_text
                          )
                        }
                        className="btn-primary text-xs px-3 py-1.5"
                      >
                        {copiedId === proposal.id + "-response"
                          ? "Copiado!"
                          : "Copiar respuesta"}
                      </button>
                    </div>
                    <div className="rounded-xl p-5 whitespace-pre-wrap text-sm text-text-secondary leading-relaxed" style={{ background: "rgba(255,255,255,0.03)" }}>
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
