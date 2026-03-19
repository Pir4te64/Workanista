"use client";

import { useState } from "react";
import ProposalInput from "./ProposalInput";
import ProposalQueue from "./ProposalQueue";
import ProposalHistory from "./ProposalHistory";
import ProposalAnalytics from "./ProposalAnalytics";
import SellersPanel from "./SellersPanel";
import type { QueueItem } from "../page";

interface Props {
  queue: QueueItem[];
  onAdd: (text: string) => void;
  onRemove: (id: string) => void;
  onClearCompleted: () => void;
  onUpdateItem: (id: string, updates: Partial<QueueItem>) => void;
  onReorder: (items: QueueItem[]) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export default function WorkanaTab({ queue, onAdd, onRemove, onClearCompleted, onUpdateItem, onReorder, inputRef }: Props) {
  const [subTab, setSubTab] = useState<"new" | "history" | "analytics" | "sellers">("new");

  const tabs = [
    { key: "new" as const, label: "Nueva Propuesta" },
    { key: "history" as const, label: "Historial" },
    { key: "analytics" as const, label: "Analytics" },
    { key: "sellers" as const, label: "Vendedores" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={`px-5 py-2.5 text-[13px] font-medium rounded-t-xl transition-all duration-200 ${
              subTab === tab.key
                ? "text-brand-mint"
                : "text-text-muted hover:text-text-primary"
            }`}
            style={
              subTab === tab.key
                ? {
                    background: "rgba(0, 245, 160, 0.06)",
                    borderBottom: "2px solid #00F5A0",
                  }
                : { borderBottom: "2px solid transparent" }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === "new" && (
        <div className="space-y-5">
          <ProposalInput onAdd={onAdd} queueCount={queue.length} inputRef={inputRef} />
          <ProposalQueue
            items={queue}
            onRemove={onRemove}
            onClearCompleted={onClearCompleted}
            onUpdateItem={onUpdateItem}
            onReorder={onReorder}
          />
        </div>
      )}

      {subTab === "history" && <ProposalHistory />}

      {subTab === "analytics" && <ProposalAnalytics />}

      {subTab === "sellers" && <SellersPanel />}
    </div>
  );
}
