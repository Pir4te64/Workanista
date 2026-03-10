"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import WorkanaTab from "./components/WorkanaTab";
import ColdDuckTab from "./components/coldduck/ColdDuckTab";
import DuckIcon from "./components/coldduck/DuckIcon";
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

// Minimal white SVG icons for sidebar
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

  // Keyboard shortcuts
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
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarCollapsed ? "w-20" : "w-64"
        } flex flex-col border-r border-surface-border bg-surface-dark/80 backdrop-blur-xl transition-all duration-300 shrink-0`}
      >
        {/* Logo */}
        <div className={`flex items-center justify-center ${sidebarCollapsed ? "p-4" : "p-6"}`}>
          <DuckIcon size={sidebarCollapsed ? 48 : 160} />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1 mt-4">
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
              {!sidebarCollapsed && <span>{item.label}</span>}
              {!sidebarCollapsed &&
                item.key === "workana" &&
                queue.length > 0 && (
                  <span className="ml-auto px-2 py-0.5 text-xs bg-brand-mint/20 text-brand-mint rounded-full">
                    {pendingCount > 0 ? pendingCount : doneCount}
                  </span>
                )}
            </button>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="p-3 space-y-2 border-t border-surface-border">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="sidebar-item-inactive w-full justify-center"
          >
            <IconCollapse collapsed={sidebarCollapsed} />
            {!sidebarCollapsed && <span>Colapsar</span>}
          </button>
          <button
            onClick={handleLogout}
            className="sidebar-item-inactive w-full text-red-400 hover:text-red-300"
          >
            <IconLogout />
            {!sidebarCollapsed && <span>Cerrar sesion</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top gradient accent */}
        <div className="gradient-accent h-1" />

        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Keyboard shortcuts hint */}
          <div className="flex justify-end mb-2">
            <span className="text-[10px] text-text-muted">
              ⌘N Nueva propuesta · ⌘K Dashboard
            </span>
          </div>

          {activeTab === "dashboard" && (
            <FadeIn>
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-text-primary mb-1">
                    Dashboard
                  </h2>
                  <p className="text-sm text-text-muted">
                    Resumen de tu actividad
                  </p>
                </div>
                <DashboardSummary />

                {/* Quick actions */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setActiveTab("workana")}
                    className="glass-card-hover p-6 text-left group"
                  >
                    <div className="mb-3 text-text-muted group-hover:text-brand-mint transition-colors">
                      <IconBriefcase className="w-7 h-7" />
                    </div>
                    <h3 className="text-sm font-semibold text-text-primary group-hover:text-brand-mint transition-colors">
                      Nueva Propuesta
                    </h3>
                    <p className="text-xs text-text-muted mt-1">
                      Analiza y responde propuestas de Workana
                    </p>
                  </button>
                  <button
                    onClick={() => setActiveTab("linkedin")}
                    className="glass-card-hover p-6 text-left group"
                  >
                    <div className="mb-3 text-text-muted group-hover:text-brand-mint transition-colors">
                      <IconSend className="w-7 h-7" />
                    </div>
                    <h3 className="text-sm font-semibold text-text-primary group-hover:text-brand-mint transition-colors">
                      ColdDuck Outreach
                    </h3>
                    <p className="text-xs text-text-muted mt-1">
                      Genera mensajes personalizados en LinkedIn
                    </p>
                  </button>
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
        </div>
      </main>
    </div>
  );
}
