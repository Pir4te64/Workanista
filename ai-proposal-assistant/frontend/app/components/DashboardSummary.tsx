"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getAnalytics, type AnalyticsData } from "@/lib/api";
import { getOutreach, type OutreachRecord } from "@/lib/coldduck-api";

interface StatCard {
  label: string;
  value: string;
  color?: string;
  sub?: string;
}

export default function DashboardSummary() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [outreach, setOutreach] = useState<OutreachRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [analyticsData, outreachData] = await Promise.allSettled([
          getAnalytics(),
          getOutreach(),
        ]);

        if (analyticsData.status === "fulfilled") {
          setAnalytics(analyticsData.value);
        }
        if (outreachData.status === "fulfilled") {
          setOutreach(outreachData.value);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const formatRevenue = (value: number | undefined): string => {
    if (value === undefined || value === null) return "\u2014";
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const stats: StatCard[] = [
    {
      label: "Propuestas Hoy",
      value:
        analytics?.total_proposals !== undefined
          ? String(analytics.total_proposals)
          : "\u2014",
    },
    {
      label: "Win Rate",
      value:
        analytics?.win_rate !== undefined
          ? `${analytics.win_rate}%`
          : "\u2014",
      color:
        analytics?.win_rate !== undefined
          ? analytics.win_rate >= 50
            ? "#22c55e"
            : "#ef4444"
          : undefined,
    },
    {
      label: "Ingresos",
      value: formatRevenue(analytics?.total_revenue),
    },
    {
      label: "Outreach",
      value: outreach ? String(outreach.length) : "\u2014",
      sub: outreach && outreach.length > 0 ? "mensajes enviados" : undefined,
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="glass-card p-4 animate-pulse"
          >
            <div className="h-3 w-20 rounded-md mb-3" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="h-7 w-16 rounded-md" style={{ background: "rgba(255,255,255,0.08)" }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.06, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="glass-card p-4 transition-all duration-300 hover:shadow-card-hover group"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <p className="section-title mb-2">
            {stat.label}
          </p>
          <p
            className="text-2xl font-semibold tracking-tight"
            style={stat.color ? { color: stat.color } : { color: "#EDEDF4" }}
          >
            {stat.value}
          </p>
          {stat.sub && (
            <p className="text-xs text-text-muted mt-1.5">{stat.sub}</p>
          )}
        </motion.div>
      ))}
    </div>
  );
}
