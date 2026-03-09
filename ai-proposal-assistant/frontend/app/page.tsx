"use client";

import { useState } from "react";
import ProposalInput from "./components/ProposalInput";
import ProposalQueue from "./components/ProposalQueue";
import ProposalHistory from "./components/ProposalHistory";
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
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");

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
    <main className="max-w-5xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary">
          AI Proposal Assistant
        </h1>
        <p className="text-text-secondary mt-1">
          Genera respuestas optimizadas para propuestas de Workana
        </p>
      </header>

      <nav className="flex gap-1 mb-6 border-b border-surface-border">
        <button
          onClick={() => setActiveTab("new")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === "new"
              ? "bg-surface-card text-text-primary border-b-2 border-brand-orange"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          Cola de Propuestas
          {queue.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-brand-orange text-white rounded-full">
              {pendingCount > 0
                ? `${pendingCount} pendientes`
                : `${doneCount} listas`}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === "history"
              ? "bg-surface-card text-text-primary border-b-2 border-brand-orange"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          Historial
        </button>
      </nav>

      {activeTab === "new" && (
        <div className="space-y-6">
          <ProposalInput onAdd={addToQueue} queueCount={queue.length} />
          <ProposalQueue
            items={queue}
            onRemove={removeFromQueue}
            onClearCompleted={clearCompleted}
            onUpdateItem={updateItem}
          />
        </div>
      )}

      {activeTab === "history" && <ProposalHistory />}
    </main>
  );
}
