"use client";

import { useEffect, useState } from "react";
import { getAnalytics, type AnalyticsData } from "@/lib/api";
import Loader from "./Loader";
import Sparkline from "./Sparkline";
import { FadeIn } from "./AnimatedList";

function KpiCard({ label, value, sub, sparkData }: { label: string; value: string | number; sub?: string; sparkData?: number[] }) {
  return (
    <div className="bg-surface-card rounded-xl border border-surface-border p-4 hover:border-brand-mint/30 transition-colors">
      <div className="text-xs text-text-muted mb-1">{label}</div>
      <div className="text-2xl font-bold text-brand-mint">{value}</div>
      {sparkData && <Sparkline data={sparkData} />}
      {sub && <div className="text-xs text-text-secondary mt-1">{sub}</div>}
    </div>
  );
}

function BarChart({ items, labelKey, valueKey, maxValue, colorClass = "bg-brand-mint" }: {
  items: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  maxValue: number;
  colorClass?: string;
}) {
  if (items.length === 0) return <div className="text-xs text-text-muted">Sin datos</div>;
  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const val = Number(item[valueKey]) || 0;
        const pct = maxValue > 0 ? (val / maxValue) * 100 : 0;
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="w-28 text-xs text-text-secondary truncate" title={String(item[labelKey])}>
              {String(item[labelKey])}
            </div>
            <div className="flex-1 h-5 bg-surface-dark rounded-full overflow-hidden">
              <div className={`h-full ${colorClass} rounded-full transition-all`} style={{ width: `${Math.max(pct, 2)}%` }} />
            </div>
            <div className="w-10 text-xs text-text-muted text-right">{val}</div>
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
    <div className="flex h-6 rounded-full overflow-hidden bg-surface-dark">
      {wonPct > 0 && (
        <div className="bg-brand-mint flex items-center justify-center text-[10px] text-white font-medium" style={{ width: `${wonPct}%` }}>
          {won}
        </div>
      )}
      {lostPct > 0 && (
        <div className="bg-red-600 flex items-center justify-center text-[10px] text-white font-medium" style={{ width: `${lostPct}%` }}>
          {lost}
        </div>
      )}
      {noResponse > 0 && (
        <div className="bg-surface-card-hover flex items-center justify-center text-[10px] text-text-muted font-medium" style={{ width: `${((noResponse) / total) * 100}%` }}>
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
    <div className="space-y-2">
      {timeline.map((m) => (
        <div key={m.month} className="flex items-center gap-3">
          <div className="w-16 text-xs text-text-muted">{m.month}</div>
          <div className="flex-1 flex h-5 rounded-full overflow-hidden bg-surface-dark">
            {m.won > 0 && (
              <div className="bg-brand-mint" style={{ width: `${(m.won / maxTotal) * 100}%` }} />
            )}
            {m.lost > 0 && (
              <div className="bg-red-600" style={{ width: `${(m.lost / maxTotal) * 100}%` }} />
            )}
            {m.no_response > 0 && (
              <div className="bg-surface-card-hover" style={{ width: `${(m.no_response / maxTotal) * 100}%` }} />
            )}
          </div>
          <div className="w-8 text-xs text-text-muted text-right">{m.total}</div>
          {m.revenue > 0 && (
            <div className="w-20 text-xs text-brand-mint text-right">${m.revenue.toLocaleString()}</div>
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

  if (loading) return <div className="py-12"><Loader size={40} text="Calculando analytics..." /></div>;
  if (error) return <div className="text-center text-red-400 py-12">{error}</div>;
  if (!data) return null;

  const won = data.results.won || 0;
  const lost = data.results.lost || 0;
  const noResponse = data.results.no_response || 0;

  const maxTechCount = data.technologies.length > 0 ? Math.max(...data.technologies.map(t => t.count)) : 1;
  const maxTypeCount = data.project_types.length > 0 ? Math.max(...data.project_types.map(t => t.total)) : 1;

  // Price accuracy
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Propuestas" value={data.total_proposals} sparkData={data.monthly_timeline.map(m => m.total)} />
        <KpiCard label="Win Rate" value={`${data.win_rate}%`} sub={`${won} ganadas de ${won + lost} decididas`} sparkData={data.monthly_timeline.map(m => m.won + m.lost > 0 ? Math.round(m.won / (m.won + m.lost) * 100) : 0)} />
        <KpiCard label="Ingresos Totales" value={`$${data.total_revenue.toLocaleString()}`} sub={data.avg_price > 0 ? `Promedio: $${data.avg_price.toLocaleString()}` : undefined} sparkData={data.monthly_timeline.map(m => m.revenue)} />
        <KpiCard label="Precision de Precios" value={data.price_accuracy.length > 0 ? `${priceAccuracyPct}%` : "N/A"} sub={data.price_accuracy.length > 0 ? `${data.price_accuracy.length} con precio real` : "Agrega precios para medir"} />
      </div>

      {/* Overall Win Rate Bar */}
      <div className="bg-surface-card rounded-xl border border-surface-border p-4">
        <h3 className="text-sm font-medium text-text-secondary mb-3">Resultados Generales</h3>
        <WinRateBar won={won} lost={lost} noResponse={noResponse} />
        <div className="flex gap-4 mt-2 text-xs text-text-muted">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand-mint inline-block" /> Ganadas ({won})</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600 inline-block" /> Perdidas ({lost})</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-surface-card-hover inline-block" /> Sin respuesta ({noResponse})</span>
        </div>
      </div>

      {/* Two columns: Project Types + Technologies */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Project Types */}
        <div className="bg-surface-card rounded-xl border border-surface-border p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Por Tipo de Proyecto</h3>
          <BarChart
            items={data.project_types}
            labelKey="type"
            valueKey="total"
            maxValue={maxTypeCount}
          />
          {data.project_types.length > 0 && (
            <div className="mt-3 pt-3 border-t border-surface-border space-y-1">
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

        {/* Technologies */}
        <div className="bg-surface-card rounded-xl border border-surface-border p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Tecnologias mas Pedidas</h3>
          <BarChart
            items={data.technologies}
            labelKey="tech"
            valueKey="count"
            maxValue={maxTechCount}
            colorClass="bg-blue-500"
          />
          {data.technologies.filter(t => t.won > 0).length > 0 && (
            <div className="mt-3 pt-3 border-t border-surface-border space-y-1">
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

      {/* Two columns: Complexity + Urgency */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-surface-card rounded-xl border border-surface-border p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Complejidad</h3>
          <BarChart
            items={Object.entries(data.complexities).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => (b.value as number) - (a.value as number))}
            labelKey="label"
            valueKey="value"
            maxValue={Math.max(...Object.values(data.complexities), 1)}
            colorClass="bg-purple-500"
          />
        </div>
        <div className="bg-surface-card rounded-xl border border-surface-border p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Urgencia</h3>
          <BarChart
            items={Object.entries(data.urgencies).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => (b.value as number) - (a.value as number))}
            labelKey="label"
            valueKey="value"
            maxValue={Math.max(...Object.values(data.urgencies), 1)}
            colorClass="bg-yellow-500"
          />
        </div>
        <div className="bg-surface-card rounded-xl border border-surface-border p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Nivel Tecnico del Cliente</h3>
          <BarChart
            items={Object.entries(data.client_tech_levels).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => (b.value as number) - (a.value as number))}
            labelKey="label"
            valueKey="value"
            maxValue={Math.max(...Object.values(data.client_tech_levels), 1)}
            colorClass="bg-emerald-500"
          />
        </div>
      </div>

      {/* Monthly Timeline */}
      <div className="bg-surface-card rounded-xl border border-surface-border p-4">
        <h3 className="text-sm font-medium text-text-secondary mb-3">Tendencia Mensual</h3>
        <MonthlyChart timeline={data.monthly_timeline} />
        <div className="flex gap-4 mt-3 text-xs text-text-muted">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand-mint inline-block" /> Ganadas</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600 inline-block" /> Perdidas</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-surface-card-hover inline-block" /> Sin respuesta</span>
        </div>
      </div>

      {/* Insight box */}
      {data.project_types.length > 0 && data.technologies.length > 0 && (
        <div className="bg-brand-mint/10 border border-brand-mint/30 rounded-xl p-4">
          <h3 className="text-sm font-medium text-brand-mint mb-2">Insight para Producto</h3>
          <p className="text-xs text-text-secondary leading-relaxed">
            El tipo de proyecto mas demandado es <strong className="text-text-primary">{data.project_types[0]?.type}</strong> ({data.project_types[0]?.total} propuestas).
            {data.project_types[0]?.win_rate > 0 && ` Win rate: ${data.project_types[0].win_rate}%.`}
            {" "}La tecnologia mas solicitada es <strong className="text-text-primary">{data.technologies[0]?.tech}</strong> ({data.technologies[0]?.count} veces).
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
          className="px-4 py-2 text-sm bg-brand-mint hover:bg-brand-mint-dark text-text-dark rounded-lg transition-colors"
        >
          Exportar CSV
        </button>
      </div>
    </div>
    </FadeIn>
  );
}
