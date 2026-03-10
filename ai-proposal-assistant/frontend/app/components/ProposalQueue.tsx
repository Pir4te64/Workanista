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
        <div className="glass-card flex flex-col items-center justify-center py-14 text-text-muted">
          <DuckIcon size={56} />
          <p className="mt-4 text-sm">La cola esta vacia. Agrega propuestas arriba para comenzar.</p>
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
            className="btn-primary"
          >
            {processing
              ? `Procesando...`
              : `Procesar ${pendingItems.length} propuesta${pendingItems.length !== 1 ? "s" : ""}`}
          </button>
          {doneItems.length > 0 && (
            <button
              onClick={onClearCompleted}
              className="btn-secondary text-sm"
            >
              Limpiar completadas
            </button>
          )}
        </div>
        <span className="text-xs text-text-muted">
          {doneItems.length}/{items.length} procesadas
        </span>
      </div>

      {/* Progress bar */}
      {processing && (
        <div className="w-full rounded-full h-1" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="bg-brand-mint h-1 rounded-full transition-all duration-500"
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
              className={`glass-card transition-all duration-200 ${
                isDragOver ? "!border-brand-mint/50" : ""
              } ${
                item.status === "processing" ? "!border-brand-mint/30" : ""
              } ${
                item.status === "error" ? "!border-red-500/30" : ""
              } ${
                isPending ? "cursor-grab active:cursor-grabbing" : ""
              } ${
                dragIndex === index ? "opacity-50" : ""
              }`}
            >
              {/* Item header */}
              <div className="flex items-center justify-between p-5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[11px] text-text-muted font-mono w-6 shrink-0">
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
                        className="btn-secondary text-xs px-3 py-1.5"
                      >
                        {expandedId === item.id ? "Cerrar" : "Ver"}
                      </button>
                      <button
                        onClick={() =>
                          handleCopy(item.id, item.result!.response)
                        }
                        className="btn-primary text-xs px-3 py-1.5"
                      >
                        {copiedId === item.id ? "Copiado!" : "Copiar"}
                      </button>
                    </>
                  )}
                  {item.status === "pending" && (
                    <button
                      onClick={() => onRemove(item.id)}
                      className="px-3 py-1.5 text-xs text-red-400/60 hover:text-red-400 transition-colors rounded-lg"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded result */}
              {expandedId === item.id && item.result && (
                <div className="p-5 pt-0 space-y-4" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="pt-5">
                    <h3 className="section-title mb-3">
                      Analisis
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-text-muted">Tipo</span>
                        <p className="text-text-primary mt-0.5">
                          {item.result.analysis.project_type}
                        </p>
                      </div>
                      <div>
                        <span className="text-text-muted">Complejidad</span>
                        <p className="text-text-primary mt-0.5">
                          {item.result.analysis.complexity}
                        </p>
                      </div>
                      <div>
                        <span className="text-text-muted">Nivel cliente</span>
                        <p className="text-text-primary mt-0.5">
                          {item.result.analysis.client_technical_level}
                        </p>
                      </div>
                      <div>
                        <span className="text-text-muted">Urgencia</span>
                        <p className="text-text-primary mt-0.5">
                          {item.result.analysis.urgency}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-text-muted">Tecnologias</span>
                        <p className="text-text-primary mt-0.5">
                          {item.result.analysis.technologies?.join(", ")}
                        </p>
                      </div>
                    </div>
                    {/* Suggested price */}
                    {item.result.analysis.suggested_price_min != null && (
                      <div className="mt-4 p-4 rounded-xl" style={{ background: "rgba(0, 245, 160, 0.06)", border: "1px solid rgba(0, 245, 160, 0.1)" }}>
                        <span className="text-xs text-brand-mint font-medium">
                          Precio sugerido: $
                          {item.result.analysis.suggested_price_min} - $
                          {item.result.analysis.suggested_price_max} USD
                        </span>
                        {item.result.analysis.price_reasoning && (
                          <p className="text-xs text-brand-mint/50 mt-1">
                            {item.result.analysis.price_reasoning}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Response */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="section-title">
                        Respuesta generada
                      </h3>
                      <button
                        onClick={() =>
                          handleCopy(item.id, item.result!.response)
                        }
                        className="btn-secondary text-xs px-3 py-1.5"
                      >
                        {copiedId === item.id ? "Copiado!" : "Copiar"}
                      </button>
                    </div>
                    <div className="rounded-xl p-5 whitespace-pre-wrap text-sm text-text-secondary leading-relaxed" style={{ background: "rgba(255,255,255,0.03)" }}>
                      {item.result.response}
                    </div>
                  </div>

                  {/* Original proposal */}
                  <div>
                    <h3 className="section-title mb-3">
                      Propuesta original
                    </h3>
                    <div className="rounded-xl p-4 text-xs text-text-muted max-h-32 overflow-y-auto" style={{ background: "rgba(255,255,255,0.02)" }}>
                      {item.text}
                    </div>
                  </div>
                </div>
              )}

              {/* Error message */}
              {item.status === "error" && item.error && (
                <div className="px-5 py-3" style={{ borderTop: "1px solid rgba(239, 68, 68, 0.15)" }}>
                  <p className="text-xs text-red-400/80">{item.error}</p>
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
      style: { background: "rgba(255,255,255,0.06)", color: "#A0A0B8" },
      cls: "",
    },
    processing: {
      label: "Procesando...",
      style: { background: "rgba(0, 245, 160, 0.12)", color: "#00F5A0" },
      cls: "animate-pulse",
    },
    done: {
      label: "Lista",
      style: { background: "rgba(0, 245, 160, 0.08)", color: "#00F5A0" },
      cls: "",
    },
    error: {
      label: "Error",
      style: { background: "rgba(239, 68, 68, 0.12)", color: "#f87171" },
      cls: "",
    },
  };
  const { label, style, cls } = config[status];
  return (
    <span className={`badge shrink-0 ${cls}`} style={style}>
      {label}
    </span>
  );
}
