"use client";

import { useEffect, useState } from "react";
import { getAnalytics, type AnalyticsData } from "@/lib/api";
import Loader from "./Loader";
import Sparkline from "./Sparkline";
import { FadeIn } from "./AnimatedList";

function KpiCard({ label, value, sub, sparkData }: { label: string; value: string | number; sub?: string; sparkData?: number[] }) {
  return (
    <div className="glass-card p-5 transition-all duration-300 hover:shadow-card-hover group">
      <div className="section-title mb-3">{label}</div>
      <div className="text-2xl font-semibold text-brand-mint tracking-tight">{value}</div>
      {sparkData && <div className="mt-2"><Sparkline data={sparkData} /></div>}
      {sub && <div className="text-xs text-text-muted mt-2">{sub}</div>}
    </div>
  );
}

function BarChart({ items, labelKey, valueKey, maxValue, color = "#00F5A0" }: {
  items: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  maxValue: number;
  color?: string;
}) {
  if (items.length === 0) return <div className="text-xs text-text-muted">Sin datos</div>;
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => {
        const val = Number(item[valueKey]) || 0;
        const pct = maxValue > 0 ? (val / maxValue) * 100 : 0;
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="w-28 text-xs text-text-secondary truncate" title={String(item[labelKey])}>
              {String(item[labelKey])}
            </div>
            <div className="flex-1 h-[18px] rounded-md overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div
                className="h-full rounded-md transition-all duration-500"
                style={{ width: `${Math.max(pct, 2)}%`, background: color, opacity: 0.8 }}
              />
            </div>
            <div className="w-10 text-xs text-text-muted text-right font-mono">{val}</div>
          </div>
        );
      })}
    </div>
  );
}

function WinRateBar({ won, lost, noResponse }: { won: number; lost: number; noResponse: number }) {
  const total = won + lost + noResponse;
  if (total === 0) return null;
  const wonPct = (won / total) * 100;
  const lostPct = (lost / total) * 100;
  return (
    <div className="flex h-7 rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
      {wonPct > 0 && (
        <div className="flex items-center justify-center text-[10px] font-semibold" style={{ width: `${wonPct}%`, background: "#00F5A0", color: "#0C0C1D" }}>
          {won}
        </div>
      )}
      {lostPct > 0 && (
        <div className="flex items-center justify-center text-[10px] text-white font-semibold" style={{ width: `${lostPct}%`, background: "#ef4444" }}>
          {lost}
        </div>
      )}
      {noResponse > 0 && (
        <div className="flex items-center justify-center text-[10px] text-text-muted font-medium" style={{ width: `${((noResponse) / total) * 100}%`, background: "rgba(255,255,255,0.06)" }}>
          {noResponse}
        </div>
      )}
    </div>
  );
}

function MonthlyChart({ timeline }: { timeline: AnalyticsData["monthly_timeline"] }) {
  if (timeline.length === 0) return <div className="text-xs text-text-muted">Sin datos</div>;
  const maxTotal = Math.max(...timeline.map(m => m.total), 1);
  return (
    <div className="space-y-2.5">
      {timeline.map((m) => (
        <div key={m.month} className="flex items-center gap-3">
          <div className="w-16 text-xs text-text-muted font-mono">{m.month}</div>
          <div className="flex-1 flex h-[18px] rounded-md overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
            {m.won > 0 && (
              <div style={{ width: `${(m.won / maxTotal) * 100}%`, background: "#00F5A0", opacity: 0.8 }} />
            )}
            {m.lost > 0 && (
              <div style={{ width: `${(m.lost / maxTotal) * 100}%`, background: "#ef4444", opacity: 0.8 }} />
            )}
            {m.no_response > 0 && (
              <div style={{ width: `${(m.no_response / maxTotal) * 100}%`, background: "rgba(255,255,255,0.08)" }} />
            )}
          </div>
          <div className="w-8 text-xs text-text-muted text-right font-mono">{m.total}</div>
          {m.revenue > 0 && (
            <div className="w-20 text-xs text-brand-mint text-right font-mono">${m.revenue.toLocaleString()}</div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ProposalAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAnalytics()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-16"><Loader size={40} text="Calculando analytics..." /></div>;
  if (error) return <div className="text-center text-red-400/80 py-16 text-sm">{error}</div>;
  if (!data) return null;

  const won = data.results.won || 0;
  const lost = data.results.lost || 0;
  const noResponse = data.results.no_response || 0;

  const maxTechCount = data.technologies.length > 0 ? Math.max(...data.technologies.map(t => t.count)) : 1;
  const maxTypeCount = data.project_types.length > 0 ? Math.max(...data.project_types.map(t => t.total)) : 1;

  let priceAccuracyPct = 0;
  if (data.price_accuracy.length > 0) {
    const withinRange = data.price_accuracy.filter(
      p => p.charged >= p.suggested_min && p.charged <= p.suggested_max
    ).length;
    priceAccuracyPct = Math.round((withinRange / data.price_accuracy.length) * 100);
  }

  const handleExportCsv = () => {
    const header = "month,total,won,lost,no_response,revenue";
    const rows = data.monthly_timeline.map(m => `${m.month},${m.total},${m.won},${m.lost},${m.no_response},${m.revenue}`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `analytics_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <FadeIn>
    <div className="space-y-6">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <KpiCard label="Total Propuestas" value={data.total_proposals} sparkData={data.monthly_timeline.map(m => m.total)} />
        <KpiCard label="Win Rate" value={`${data.win_rate}%`} sub={`${won} ganadas de ${won + lost} decididas`} sparkData={data.monthly_timeline.map(m => m.won + m.lost > 0 ? Math.round(m.won / (m.won + m.lost) * 100) : 0)} />
        <KpiCard label="Ingresos Totales" value={`$${data.total_revenue.toLocaleString()}`} sub={data.avg_price > 0 ? `Promedio: $${data.avg_price.toLocaleString()}` : undefined} sparkData={data.monthly_timeline.map(m => m.revenue)} />
        <KpiCard label="Precision de Precios" value={data.price_accuracy.length > 0 ? `${priceAccuracyPct}%` : "N/A"} sub={data.price_accuracy.length > 0 ? `${data.price_accuracy.length} con precio real` : "Agrega precios para medir"} />
      </div>

      {/* Overall Win Rate Bar */}
      <div className="glass-card p-6">
        <h3 className="section-title mb-4">Resultados Generales</h3>
        <WinRateBar won={won} lost={lost} noResponse={noResponse} />
        <div className="flex gap-5 mt-3">
          <span className="flex items-center gap-2 text-xs text-text-muted">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#00F5A0" }} /> Ganadas ({won})
          </span>
          <span className="flex items-center gap-2 text-xs text-text-muted">
            <span className="w-2.5 h-2.5 rounded-sm inline-block bg-red-500" /> Perdidas ({lost})
          </span>
          <span className="flex items-center gap-2 text-xs text-text-muted">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "rgba(255,255,255,0.1)" }} /> Sin respuesta ({noResponse})
          </span>
        </div>
      </div>

      {/* Two columns: Project Types + Technologies */}
      <div className="grid md:grid-cols-2 gap-5">
        <div className="glass-card p-6">
          <h3 className="section-title mb-4">Por Tipo de Proyecto</h3>
          <BarChart
            items={data.project_types}
            labelKey="type"
            valueKey="total"
            maxValue={maxTypeCount}
          />
          {data.project_types.length > 0 && (
            <div className="mt-4 pt-4 space-y-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              {data.project_types.filter(t => t.won + t.lost > 0).map(t => (
                <div key={t.type} className="flex justify-between text-xs">
                  <span className="text-text-muted">{t.type}</span>
                  <span className={t.win_rate >= 50 ? "text-brand-mint" : "text-red-400"}>
                    {t.win_rate}% win rate ({t.won}W / {t.lost}L)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-6">
          <h3 className="section-title mb-4">Tecnologias mas Pedidas</h3>
          <BarChart
            items={data.technologies}
            labelKey="tech"
            valueKey="count"
            maxValue={maxTechCount}
            color="#3b82f6"
          />
          {data.technologies.filter(t => t.won > 0).length > 0 && (
            <div className="mt-4 pt-4 space-y-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              {data.technologies.filter(t => t.won > 0).slice(0, 8).map(t => (
                <div key={t.tech} className="flex justify-between text-xs">
                  <span className="text-text-muted">{t.tech}</span>
                  <span className="text-blue-400">{t.win_rate}% win rate ({t.won}W)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Three columns: Complexity + Urgency + Client Level */}
      <div className="grid md:grid-cols-3 gap-5">
        <div className="glass-card p-6">
          <h3 className="section-title mb-4">Complejidad</h3>
          <BarChart
            items={Object.entries(data.complexities).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => (b.value as number) - (a.value as number))}
            labelKey="label"
            valueKey="value"
            maxValue={Math.max(...Object.values(data.complexities), 1)}
            color="#7C3AED"
          />
        </div>
        <div className="glass-card p-6">
          <h3 className="section-title mb-4">Urgencia</h3>
          <BarChart
            items={Object.entries(data.urgencies).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => (b.value as number) - (a.value as number))}
            labelKey="label"
            valueKey="value"
            maxValue={Math.max(...Object.values(data.urgencies), 1)}
            color="#eab308"
          />
        </div>
        <div className="glass-card p-6">
          <h3 className="section-title mb-4">Nivel Tecnico del Cliente</h3>
          <BarChart
            items={Object.entries(data.client_tech_levels).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => (b.value as number) - (a.value as number))}
            labelKey="label"
            valueKey="value"
            maxValue={Math.max(...Object.values(data.client_tech_levels), 1)}
            color="#10b981"
          />
        </div>
      </div>

      {/* Monthly Timeline */}
      <div className="glass-card p-6">
        <h3 className="section-title mb-4">Tendencia Mensual</h3>
        <MonthlyChart timeline={data.monthly_timeline} />
        <div className="flex gap-5 mt-4">
          <span className="flex items-center gap-2 text-xs text-text-muted">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#00F5A0" }} /> Ganadas
          </span>
          <span className="flex items-center gap-2 text-xs text-text-muted">
            <span className="w-2.5 h-2.5 rounded-sm inline-block bg-red-500" /> Perdidas
          </span>
          <span className="flex items-center gap-2 text-xs text-text-muted">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "rgba(255,255,255,0.1)" }} /> Sin respuesta
          </span>
        </div>
      </div>

      {/* Insight box */}
      {data.project_types.length > 0 && data.technologies.length > 0 && (
        <div className="glass-card p-6" style={{ borderColor: "rgba(0, 245, 160, 0.12)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-mint mb-3">Insight para Producto</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            El tipo de proyecto mas demandado es <strong className="text-text-primary font-medium">{data.project_types[0]?.type}</strong> ({data.project_types[0]?.total} propuestas).
            {data.project_types[0]?.win_rate > 0 && ` Win rate: ${data.project_types[0].win_rate}%.`}
            {" "}La tecnologia mas solicitada es <strong className="text-text-primary font-medium">{data.technologies[0]?.tech}</strong> ({data.technologies[0]?.count} veces).
            {data.monthly_timeline.length >= 2 && (
              <> Tendencia: {data.monthly_timeline[data.monthly_timeline.length - 1].total >= data.monthly_timeline[data.monthly_timeline.length - 2].total ? "creciente" : "decreciente"} en el ultimo mes.</>
            )}
            {" "}Estos datos sugieren oportunidad para crear un producto estandarizado en este nicho.
          </p>
        </div>
      )}

      {/* Export CSV */}
      <div className="flex justify-end">
        <button
          onClick={handleExportCsv}
          className="btn-primary text-sm"
        >
          Exportar CSV
        </button>
      </div>
    </div>
    </FadeIn>
  );
}
