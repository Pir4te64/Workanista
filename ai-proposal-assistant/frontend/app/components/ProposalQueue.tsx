"use client";

import { useState, useCallback } from "react";
import { analyzeProposal } from "@/lib/api";
import { useToast } from "./Toast";
import DuckIcon from "./coldduck/DuckIcon";
import { FadeIn } from "./AnimatedList";
import type { QueueItem } from "../page";

interface Props {
  items: QueueItem[];
  onRemove: (id: string) => void;
  onClearCompleted: () => void;
  onUpdateItem: (id: string, updates: Partial<QueueItem>) => void;
  onReorder: (items: QueueItem[]) => void;
}

export default function ProposalQueue({
  items,
  onRemove,
  onClearCompleted,
  onUpdateItem,
  onReorder,
}: Props) {
  const [processing, setProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const { addToast } = useToast();

  const pendingItems = items.filter((i) => i.status === "pending");
  const doneItems = items.filter(
    (i) => i.status === "done" || i.status === "error"
  );

  const processQueue = useCallback(async () => {
    setProcessing(true);
    const pending = items.filter((i) => i.status === "pending");
    let processed = 0;

    for (const item of pending) {
      onUpdateItem(item.id, { status: "processing" });
      try {
        const result = await analyzeProposal(item.text);
        onUpdateItem(item.id, { status: "done", result });
        processed++;
      } catch (err) {
        onUpdateItem(item.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Error desconocido",
        });
      }
    }
    setProcessing(false);
    if (processed > 0) {
      addToast("success", `${processed} propuestas procesadas`);
    }
  }, [items, onUpdateItem, addToast]);

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    addToast("success", "Respuesta copiada");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (items[index].status !== "pending") return;
    setDropIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    if (items[index].status !== "pending") {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    const reordered = [...items];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    onReorder(reordered);
    setDragIndex(null);
    setDropIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  if (items.length === 0) {
    return (
      <FadeIn>
        <div className="text-center text-text-muted py-8 bg-surface-card rounded-xl border border-surface-border flex flex-col items-center gap-3">
          <DuckIcon size={64} />
          <p>La cola esta vacia. Agrega propuestas arriba para comenzar.</p>
        </div>
      </FadeIn>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={processQueue}
            disabled={processing || pendingItems.length === 0}
            className="px-5 py-2.5 bg-brand-mint hover:bg-brand-mint-dark disabled:bg-surface-border disabled:text-text-muted text-text-dark font-medium rounded-lg transition-colors"
          >
            {processing
              ? `Procesando...`
              : `Procesar ${pendingItems.length} propuesta${pendingItems.length !== 1 ? "s" : ""}`}
          </button>
          {doneItems.length > 0 && (
            <button
              onClick={onClearCompleted}
              className="px-4 py-2.5 text-sm bg-surface-card hover:bg-surface-card-hover border border-surface-border text-text-secondary rounded-lg transition-colors"
            >
              Limpiar completadas
            </button>
          )}
        </div>
        <span className="text-sm text-text-secondary">
          {doneItems.length}/{items.length} procesadas
        </span>
      </div>

      {/* Progress bar */}
      {processing && (
        <div className="w-full bg-surface-border rounded-full h-1.5">
          <div
            className="bg-brand-mint h-1.5 rounded-full transition-all duration-500"
            style={{
              width: `${(doneItems.length / items.length) * 100}%`,
            }}
          />
        </div>
      )}

      {/* Queue items */}
      <div className="space-y-3">
        {items.map((item, index) => {
          const isPending = item.status === "pending";
          const isDragOver = dropIndex === index && dragIndex !== index;

          return (
            <div
              key={item.id}
              draggable={isPending}
              onDragStart={isPending ? () => handleDragStart(index) : undefined}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`bg-surface-card rounded-xl border transition-colors ${
                isDragOver
                  ? "border-brand-mint"
                  : item.status === "processing"
                  ? "border-brand-mint/60"
                  : item.status === "done"
                  ? "border-brand-mint/30"
                  : item.status === "error"
                  ? "border-red-800"
                  : "border-surface-border"
              } ${isPending ? "cursor-grab active:cursor-grabbing" : ""} ${
                dragIndex === index ? "opacity-50" : ""
              }`}
            >
              {/* Item header */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-text-muted font-mono w-6 shrink-0">
                    #{index + 1}
                  </span>
                  <StatusBadge status={item.status} />
                  <p className="text-sm text-text-secondary truncate">
                    {item.text.slice(0, 100)}...
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {item.status === "done" && item.result && (
                    <>
                      <button
                        onClick={() =>
                          setExpandedId(
                            expandedId === item.id ? null : item.id
                          )
                        }
                        className="px-3 py-1 text-xs bg-surface-card-hover hover:bg-text-dark border border-surface-border rounded-lg transition-colors"
                      >
                        {expandedId === item.id ? "Cerrar" : "Ver"}
                      </button>
                      <button
                        onClick={() =>
                          handleCopy(item.id, item.result!.response)
                        }
                        className="px-3 py-1 text-xs bg-brand-mint hover:bg-brand-mint-dark text-text-dark rounded-lg transition-colors"
                      >
                        {copiedId === item.id ? "Copiado!" : "Copiar"}
                      </button>
                    </>
                  )}
                  {item.status === "pending" && (
                    <button
                      onClick={() => onRemove(item.id)}
                      className="px-3 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-surface-card-hover rounded-lg transition-colors"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded result */}
              {expandedId === item.id && item.result && (
                <div className="border-t border-surface-border p-4 space-y-4">
                  {/* Analysis */}
                  <div>
                    <h3 className="text-sm font-medium text-text-secondary mb-2">
                      Analisis
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-text-muted">Tipo:</span>{" "}
                        <span className="text-text-primary">
                          {item.result.analysis.project_type}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted">Complejidad:</span>{" "}
                        <span className="text-text-primary">
                          {item.result.analysis.complexity}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted">Nivel cliente:</span>{" "}
                        <span className="text-text-primary">
                          {item.result.analysis.client_technical_level}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted">Urgencia:</span>{" "}
                        <span className="text-text-primary">
                          {item.result.analysis.urgency}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-text-muted">Tecnologias:</span>{" "}
                        <span className="text-text-primary">
                          {item.result.analysis.technologies?.join(", ")}
                        </span>
                      </div>
                    </div>
                    {/* Suggested price */}
                    {item.result.analysis.suggested_price_min != null && (
                      <div className="mt-3 p-3 bg-brand-mint/10 border border-brand-mint/30 rounded-lg">
                        <span className="text-xs text-brand-mint font-medium">
                          Precio sugerido: $
                          {item.result.analysis.suggested_price_min} - $
                          {item.result.analysis.suggested_price_max} USD
                        </span>
                        {item.result.analysis.price_reasoning && (
                          <p className="text-xs text-brand-mint/60 mt-1">
                            {item.result.analysis.price_reasoning}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Response */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-text-secondary">
                        Respuesta generada
                      </h3>
                      <button
                        onClick={() =>
                          handleCopy(item.id, item.result!.response)
                        }
                        className="px-3 py-1 text-xs bg-surface-card-hover hover:bg-text-dark border border-surface-border rounded-lg transition-colors"
                      >
                        {copiedId === item.id ? "Copiado!" : "Copiar"}
                      </button>
                    </div>
                    <div className="bg-surface-dark rounded-lg p-4 whitespace-pre-wrap text-sm text-text-primary leading-relaxed">
                      {item.result.response}
                    </div>
                  </div>

                  {/* Original proposal */}
                  <div>
                    <h3 className="text-sm font-medium text-text-secondary mb-2">
                      Propuesta original
                    </h3>
                    <div className="bg-surface-dark/50 rounded-lg p-3 text-xs text-text-muted max-h-32 overflow-y-auto">
                      {item.text}
                    </div>
                  </div>
                </div>
              )}

              {/* Error message */}
              {item.status === "error" && item.error && (
                <div className="border-t border-red-900 px-4 py-3">
                  <p className="text-xs text-red-400">{item.error}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: QueueItem["status"] }) {
  const config = {
    pending: {
      label: "Pendiente",
      cls: "bg-surface-border text-text-secondary",
    },
    processing: {
      label: "Procesando...",
      cls: "bg-brand-mint/20 text-brand-mint animate-pulse",
    },
    done: {
      label: "Lista",
      cls: "bg-brand-mint/10 text-brand-mint",
    },
    error: {
      label: "Error",
      cls: "bg-red-900/30 text-red-400",
    },
  };
  const { label, cls } = config[status];
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full shrink-0 ${cls}`}>
      {label}
    </span>
  );
}
