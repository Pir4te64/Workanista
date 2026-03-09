"use client";

import { useState } from "react";
import ProposalInput from "./ProposalInput";
import ProposalQueue from "./ProposalQueue";
import ProposalHistory from "./ProposalHistory";
import ProposalAnalytics from "./ProposalAnalytics";
import type { QueueItem } from "../page";

interface Props {
  queue: QueueItem[];
  onAdd: (text: string) => void;
  onRemove: (id: string) => void;
  onClearCompleted: () => void;
  onUpdateItem: (id: string, updates: Partial<QueueItem>) => void;
}

export default function WorkanaTab({ queue, onAdd, onRemove, onClearCompleted, onUpdateItem }: Props) {
  const [subTab, setSubTab] = useState<"new" | "history" | "analytics">("new");

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-surface-border">
        <button
          onClick={() => setSubTab("new")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            subTab === "new"
              ? "bg-surface-card text-text-primary border-b-2 border-brand-orange"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          Nueva Propuesta
        </button>
        <button
          onClick={() => setSubTab("history")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            subTab === "history"
              ? "bg-surface-card text-text-primary border-b-2 border-brand-orange"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          Historial
        </button>
        <button
          onClick={() => setSubTab("analytics")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            subTab === "analytics"
              ? "bg-surface-card text-text-primary border-b-2 border-brand-orange"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          Analytics
        </button>
      </div>

      {subTab === "new" && (
        <div className="space-y-6">
          <ProposalInput onAdd={onAdd} queueCount={queue.length} />
          <ProposalQueue
            items={queue}
            onRemove={onRemove}
            onClearCompleted={onClearCompleted}
            onUpdateItem={onUpdateItem}
          />
        </div>
      )}

      {subTab === "history" && <ProposalHistory />}

      {subTab === "analytics" && <ProposalAnalytics />}
    </div>
  );
}
