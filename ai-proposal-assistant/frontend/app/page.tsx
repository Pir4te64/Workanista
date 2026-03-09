"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import WorkanaTab from "./components/WorkanaTab";
import ColdDuckTab from "./components/coldduck/ColdDuckTab";
import DuckIcon from "./components/coldduck/DuckIcon";
import type { ProposalResponse } from "@/lib/api";

export interface QueueItem {
  id: string;
  text: string;
  status: "pending" | "processing" | "done" | "error";
  result?: ProposalResponse;
  error?: string;
}

export default function Home() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeTab, setActiveTab] = useState<"workana" | "linkedin">("workana");
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const addToQueue = (text: string) => {
    const item: QueueItem = {
      id: crypto.randomUUID(),
      text,
      status: "pending",
    };
    setQueue((prev) => [...prev, item]);
  };

  const removeFromQueue = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCompleted = () => {
    setQueue((prev) =>
      prev.filter((item) => item.status !== "done" && item.status !== "error")
    );
  };

  const updateItem = (id: string, updates: Partial<QueueItem>) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const pendingCount = queue.filter((i) => i.status === "pending").length;
  const doneCount = queue.filter((i) => i.status === "done").length;

  return (
    <>
      <div className="absolute top-4 left-4">
        <DuckIcon size={192} />
      </div>
      <div className="absolute top-4 right-4">
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-xs text-text-muted hover:text-text-primary bg-surface-card border border-surface-border rounded-lg hover:bg-surface-card-hover transition-colors"
        >
          Cerrar sesion
        </button>
      </div>
    <main className="max-w-5xl mx-auto px-4 pt-52 pb-8">

      <nav className="flex gap-1 mb-6 border-b border-surface-border">
        <button
          onClick={() => setActiveTab("workana")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === "workana"
              ? "bg-surface-card text-text-primary border-b-2 border-brand-orange"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          Workana
          {queue.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-brand-orange text-white rounded-full">
              {pendingCount > 0
                ? `${pendingCount} pendientes`
                : `${doneCount} listas`}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("linkedin")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1.5 ${
            activeTab === "linkedin"
              ? "bg-surface-card text-text-primary border-b-2 border-brand-orange"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          <DuckIcon size={64} /> LinkedIn
        </button>
      </nav>

      {activeTab === "workana" && <WorkanaTab queue={queue} onAdd={addToQueue} onRemove={removeFromQueue} onClearCompleted={clearCompleted} onUpdateItem={updateItem} />}

      {activeTab === "linkedin" && <ColdDuckTab />}
    </main>
    </>
  );
}
