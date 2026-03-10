"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import WorkanaTab from "./components/WorkanaTab";
import ColdDuckTab from "./components/coldduck/ColdDuckTab";
import DuckIcon from "./components/coldduck/DuckIcon";
import BudgetTab from "./components/BudgetTab";
import DashboardSummary from "./components/DashboardSummary";
import { FadeIn } from "./components/AnimatedList";
import { useToast } from "./components/Toast";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import type { ProposalResponse } from "@/lib/api";

export interface QueueItem {
  id: string;
  text: string;
  status: "pending" | "processing" | "done" | "error";
  result?: ProposalResponse;
  error?: string;
}

function IconDashboard({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function IconBriefcase({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
      <path d="M2 12h20" />
    </svg>
  );
}

function IconSend({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13" />
      <path d="M22 2L15 22l-4-9-9-4z" />
    </svg>
  );
}

function IconDocument({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function IconCollapse({ collapsed, className = "w-5 h-5" }: { collapsed: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      {collapsed ? (
        <path d="M9 18l6-6-6-6" />
      ) : (
        <path d="M15 18l-6-6 6-6" />
      )}
    </svg>
  );
}

function IconLogout({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16,17 21,12 16,7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard" },
  { key: "workana", label: "Workana", icon: "briefcase" },
  { key: "linkedin", label: "ColdDuck", icon: "send" },
  { key: "budgets", label: "Presupuestos", icon: "document" },
] as const;

type TabKey = (typeof NAV_ITEMS)[number]["key"];

export default function Home() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const router = useRouter();
  const { addToast } = useToast();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const addToQueue = useCallback(
    (text: string) => {
      const item: QueueItem = {
        id: crypto.randomUUID(),
        text,
        status: "pending",
      };
      setQueue((prev) => [...prev, item]);
      addToast("success", "Propuesta agregada a la cola");
    },
    [addToast]
  );

  const removeFromQueue = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCompleted = () => {
    setQueue((prev) =>
      prev.filter((item) => item.status !== "done" && item.status !== "error")
    );
    addToast("info", "Cola limpiada");
  };

  const updateItem = (id: string, updates: Partial<QueueItem>) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const reorderQueue = (newItems: QueueItem[]) => {
    setQueue(newItems);
  };

  const pendingCount = queue.filter((i) => i.status === "pending").length;
  const doneCount = queue.filter((i) => i.status === "done").length;

  useKeyboardShortcuts({
    n: () => {
      setActiveTab("workana");
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    k: () => {
      setActiveTab("dashboard");
    },
  });

  return (
    <div className="flex h-screen overflow-hidden bg-surface-black">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarCollapsed ? "w-[72px]" : "w-60"
        } flex flex-col bg-surface-dark/60 backdrop-blur-2xl transition-all duration-300 shrink-0 relative`}
        style={{ borderRight: "1px solid rgba(255,255,255,0.04)" }}
      >
        {/* Logo */}
        <div className={`flex items-center justify-center ${sidebarCollapsed ? "py-5" : "pt-8 pb-6"}`}>
          <DuckIcon size={sidebarCollapsed ? 40 : 140} />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={
                activeTab === item.key
                  ? "sidebar-item-active w-full"
                  : "sidebar-item-inactive w-full"
              }
            >
              {item.icon === "dashboard" && <IconDashboard />}
              {item.icon === "briefcase" && <IconBriefcase />}
              {item.icon === "send" && <IconSend />}
              {item.icon === "document" && <IconDocument />}
              {!sidebarCollapsed && (
                <span className="text-[13px]">{item.label}</span>
              )}
              {!sidebarCollapsed &&
                item.key === "workana" &&
                queue.length > 0 && (
                  <span className="ml-auto px-2 py-0.5 text-[10px] font-semibold bg-brand-mint/15 text-brand-mint rounded-md">
                    {pendingCount > 0 ? pendingCount : doneCount}
                  </span>
                )}
            </button>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="p-3 space-y-1" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="sidebar-item-inactive w-full justify-center"
          >
            <IconCollapse collapsed={sidebarCollapsed} />
            {!sidebarCollapsed && <span className="text-[13px]">Colapsar</span>}
          </button>
          <button
            onClick={handleLogout}
            className="sidebar-item-inactive w-full text-red-400/70 hover:text-red-400"
          >
            <IconLogout />
            {!sidebarCollapsed && <span className="text-[13px]">Cerrar sesion</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top gradient accent */}
        <div className="gradient-accent h-[3px]" />

        <div className="max-w-5xl mx-auto px-8 py-10">
          {/* Keyboard shortcuts hint */}
          <div className="flex justify-end mb-4">
            <div className="flex items-center gap-3">
              <kbd className="px-1.5 py-0.5 text-[10px] text-text-muted rounded" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                ⌘N
              </kbd>
              <span className="text-[10px] text-text-muted">Nueva propuesta</span>
              <kbd className="px-1.5 py-0.5 text-[10px] text-text-muted rounded" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                ⌘K
              </kbd>
              <span className="text-[10px] text-text-muted">Dashboard</span>
            </div>
          </div>

          {activeTab === "dashboard" && (
            <FadeIn>
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-semibold text-text-primary tracking-tight">
                    Dashboard
                  </h2>
                  <p className="text-sm text-text-muted mt-1">
                    Resumen de tu actividad
                  </p>
                </div>
                <DashboardSummary />

                {/* Quick actions */}
                <div>
                  <p className="section-title mb-4">Acciones rapidas</p>
                  <div className="grid grid-cols-3 gap-5">
                    <button
                      onClick={() => setActiveTab("workana")}
                      className="glass-card-hover p-7 text-left group"
                    >
                      <div className="mb-4 text-text-muted group-hover:text-brand-mint transition-colors duration-300">
                        <IconBriefcase className="w-8 h-8" />
                      </div>
                      <h3 className="text-sm font-semibold text-text-primary group-hover:text-brand-mint transition-colors duration-300">
                        Nueva Propuesta
                      </h3>
                      <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                        Analiza y responde propuestas de Workana
                      </p>
                    </button>
                    <button
                      onClick={() => setActiveTab("linkedin")}
                      className="glass-card-hover p-7 text-left group"
                    >
                      <div className="mb-4 text-text-muted group-hover:text-brand-mint transition-colors duration-300">
                        <IconSend className="w-8 h-8" />
                      </div>
                      <h3 className="text-sm font-semibold text-text-primary group-hover:text-brand-mint transition-colors duration-300">
                        ColdDuck Outreach
                      </h3>
                      <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                        Genera mensajes personalizados en LinkedIn
                      </p>
                    </button>
                    <button
                      onClick={() => setActiveTab("budgets")}
                      className="glass-card-hover p-7 text-left group"
                    >
                      <div className="mb-4 text-text-muted group-hover:text-brand-mint transition-colors duration-300">
                        <IconDocument className="w-8 h-8" />
                      </div>
                      <h3 className="text-sm font-semibold text-text-primary group-hover:text-brand-mint transition-colors duration-300">
                        Presupuestos
                      </h3>
                      <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                        Arma presupuestos profesionales en PDF
                      </p>
                    </button>
                  </div>
                </div>
              </div>
            </FadeIn>
          )}

          {activeTab === "workana" && (
            <FadeIn>
              <WorkanaTab
                queue={queue}
                onAdd={addToQueue}
                onRemove={removeFromQueue}
                onClearCompleted={clearCompleted}
                onUpdateItem={updateItem}
                onReorder={reorderQueue}
                inputRef={inputRef}
              />
            </FadeIn>
          )}

          {activeTab === "linkedin" && (
            <FadeIn>
              <ColdDuckTab />
            </FadeIn>
          )}

          {activeTab === "budgets" && (
            <FadeIn>
              <BudgetTab />
            </FadeIn>
          )}
        </div>
      </main>
    </div>
  );
}
