"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getAnalytics, type AnalyticsData } from "@/lib/api";
import { getOutreach, type OutreachRecord } from "@/lib/coldduck-api";

interface StatCard {
  label: string;
  value: string;
  color?: string;
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
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-surface-card/60 backdrop-blur-xl border border-surface-border/50 rounded-2xl p-5 animate-pulse"
          >
            <div className="h-3 w-20 bg-white/10 rounded mb-3" />
            <div className="h-7 w-16 bg-white/10 rounded" />
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
          transition={{ duration: 0.4, delay: i * 0.08 }}
          className="bg-surface-card/60 backdrop-blur-xl border border-surface-border/50 rounded-2xl p-5 transition-shadow duration-300 hover:shadow-[0_0_15px_rgba(0,245,160,0.1)]"
        >
          <p className="text-xs text-white/50 uppercase tracking-wider mb-1">
            {stat.label}
          </p>
          <p
            className="text-2xl font-semibold"
            style={stat.color ? { color: stat.color } : undefined}
          >
            {stat.value}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
