"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ColdDuckInput from "./ColdDuckInput";
import ColdDuckResult from "./ColdDuckResult";
import ColdDuckHistory from "./ColdDuckHistory";
import Loader from "../Loader";
import { processOutreach, type OutreachResponse } from "@/lib/coldduck-api";

export interface ColdDuckQueueItem {
  id: string;
  linkedin_url?: string;
  profile_text?: string;
  label: string;
  tone: string;
  goal: string;
  generate_video: boolean;
  avatar_id: string;
  voice_id: string;
  status: "pending" | "processing" | "done" | "error";
  result?: OutreachResponse;
  error?: string;
}

export default function ColdDuckTab() {
  const [queue, setQueue] = useState<ColdDuckQueueItem[]>([]);
  const [subTab, setSubTab] = useState<"new" | "history">("new");
  const processingRef = useRef(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const updateItem = useCallback((id: string, updates: Partial<ColdDuckQueueItem>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }, []);

  const processNext = useCallback(async () => {
    if (processingRef.current) return;

    const currentQueue = queue;
    const next = currentQueue.find((i) => i.status === "pending");
    if (!next) return;

    processingRef.current = true;
    updateItem(next.id, { status: "processing" });

    try {
      const data = await processOutreach({
        linkedin_url: next.linkedin_url,
        profile_text: next.profile_text,
        tone: next.tone,
        goal: next.goal,
        generate_video: next.generate_video,
        avatar_id: next.avatar_id,
        voice_id: next.voice_id,
      });
      updateItem(next.id, { status: "done", result: data, label: data.profile.full_name || next.label });
      setExpandedId(next.id);
    } catch (err) {
      updateItem(next.id, {
        status: "error",
        error: err instanceof Error ? err.message : "Error procesando outreach",
      });
    } finally {
      processingRef.current = false;
    }
  }, [queue, updateItem]);

  useEffect(() => {
    const hasPending = queue.some((i) => i.status === "pending");
    const hasProcessing = queue.some((i) => i.status === "processing");
    if (hasPending && !hasProcessing && !processingRef.current) {
      processNext();
    }
  }, [queue, processNext]);

  const addToQueue = (params: {
    linkedin_url?: string;
    profile_text?: string;
    tone: string;
    goal: string;
    generate_video: boolean;
    avatar_id: string;
    voice_id: string;
  }) => {
    const label = params.linkedin_url
      ? params.linkedin_url.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, "").replace(/\/$/, "")
      : "Perfil manual";

    const item: ColdDuckQueueItem = {
      id: crypto.randomUUID(),
      ...params,
      label,
      status: "pending",
    };
    setQueue((prev) => [...prev, item]);
  };

  const removeFromQueue = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const clearCompleted = () => {
    setQueue((prev) => prev.filter((item) => item.status !== "done" && item.status !== "error"));
    setExpandedId(null);
  };

  const pendingCount = queue.filter((i) => i.status === "pending").length;
  const processingCount = queue.filter((i) => i.status === "processing").length;
  const doneCount = queue.filter((i) => i.status === "done").length;
  const errorCount = queue.filter((i) => i.status === "error").length;

  return (
    <div className="space-y-6">
      <div className="flex gap-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button
          onClick={() => setSubTab("new")}
          className={`px-5 py-2.5 text-[13px] font-medium rounded-t-xl transition-all duration-200 flex items-center gap-2 ${
            subTab === "new"
              ? "text-brand-mint"
              : "text-text-muted hover:text-text-primary"
          }`}
          style={
            subTab === "new"
              ? { background: "rgba(0, 245, 160, 0.06)", borderBottom: "2px solid #00F5A0" }
              : { borderBottom: "2px solid transparent" }
          }
        >
          Nuevo Outreach
          {queue.length > 0 && (
            <span className="badge" style={{ background: "rgba(0, 245, 160, 0.15)", color: "#00F5A0", fontSize: "10px" }}>
              {pendingCount + processingCount > 0
                ? `${pendingCount + processingCount} en cola`
                : `${doneCount} listas`}
            </span>
          )}
        </button>
        <button
          onClick={() => setSubTab("history")}
          className={`px-5 py-2.5 text-[13px] font-medium rounded-t-xl transition-all duration-200 ${
            subTab === "history"
              ? "text-brand-mint"
              : "text-text-muted hover:text-text-primary"
          }`}
          style={
            subTab === "history"
              ? { background: "rgba(0, 245, 160, 0.06)", borderBottom: "2px solid #00F5A0" }
              : { borderBottom: "2px solid transparent" }
          }
        >
          Historial
        </button>
      </div>

      {subTab === "new" && (
        <div className="space-y-5">
          <ColdDuckInput onSubmit={addToQueue} processing={processingCount > 0} />

          {/* Queue */}
          {queue.length > 0 && (
            <div className="glass-card overflow-hidden">
              <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-medium text-text-primary">Cola de Outreach</h3>
                  <div className="flex gap-3 text-xs text-text-muted">
                    {pendingCount > 0 && <span>{pendingCount} pendientes</span>}
                    {processingCount > 0 && <span className="text-yellow-400">1 procesando</span>}
                    {doneCount > 0 && <span className="text-brand-mint">{doneCount} listas</span>}
                    {errorCount > 0 && <span className="text-red-400">{errorCount} errores</span>}
                  </div>
                </div>
                {(doneCount > 0 || errorCount > 0) && (
                  <button
                    onClick={clearCompleted}
                    className="btn-secondary text-xs"
                  >
                    Limpiar completadas
                  </button>
                )}
              </div>

              <div>
                {queue.map((item, index) => (
                  <div key={item.id} className="p-5" style={index > 0 ? { borderTop: "1px solid rgba(255,255,255,0.03)" } : undefined}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            item.status === "processing"
                              ? "bg-yellow-400 animate-pulse"
                              : item.status === "done"
                              ? "bg-brand-mint"
                              : item.status === "error"
                              ? "bg-red-400"
                              : "bg-text-muted/50"
                          }`}
                        />
                        <div className="min-w-0">
                          <span className="text-sm text-text-primary font-medium">
                            {item.result?.profile.full_name || item.label}
                          </span>
                          {item.result?.profile.headline && (
                            <p className="text-xs text-text-muted truncate max-w-md">{item.result.profile.headline}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {item.linkedin_url && (
                          <a
                            href={item.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="badge" style={{ background: "rgba(59, 130, 246, 0.1)", color: "#60a5fa" }}
                          >
                            Ver perfil
                          </a>
                        )}
                        {item.status === "processing" && (
                          <span className="text-xs text-yellow-400 animate-pulse">Procesando...</span>
                        )}
                        {item.status === "done" && (
                          <button
                            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                            className="btn-secondary text-xs px-3 py-1.5"
                          >
                            {expandedId === item.id ? "Cerrar" : "Ver resultado"}
                          </button>
                        )}
                        {item.status === "pending" && (
                          <button
                            onClick={() => removeFromQueue(item.id)}
                            className="px-2.5 py-1.5 text-xs text-red-400/60 hover:text-red-400 rounded-lg transition-colors"
                          >
                            Quitar
                          </button>
                        )}
                        {(item.status === "done" || item.status === "error") && (
                          <button
                            onClick={() => removeFromQueue(item.id)}
                            className="px-2 py-1.5 text-xs text-text-muted/50 hover:text-text-muted transition-colors"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {item.status === "processing" && (
                      <div className="mt-4 ml-5">
                        <Loader size={20} text="Analizando perfil y generando mensaje..." fullscreen={false} />
                        <p className="text-xs text-text-muted mt-1.5">Esto puede tomar 10-30 segundos</p>
                      </div>
                    )}

                    {item.status === "error" && (
                      <div className="mt-3 ml-5 text-xs text-red-400/80 rounded-xl p-3" style={{ background: "rgba(239, 68, 68, 0.06)" }}>
                        {item.error}
                      </div>
                    )}

                    {item.status === "done" && item.result && expandedId === item.id && (
                      <div className="mt-4">
                        <ColdDuckResult
                          result={item.result}
                          onClose={() => setExpandedId(null)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === "history" && <ColdDuckHistory />}
    </div>
  );
}
