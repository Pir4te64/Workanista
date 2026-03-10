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

  // Process queue items
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
      <div className="flex gap-1 border-b border-surface-border">
        <button
          onClick={() => setSubTab("new")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            subTab === "new"
              ? "bg-surface-card text-text-primary border-b-2 border-brand-mint"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          Nuevo Outreach
          {queue.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-brand-mint text-text-dark rounded-full">
              {pendingCount + processingCount > 0
                ? `${pendingCount + processingCount} en cola`
                : `${doneCount} listas`}
            </span>
          )}
        </button>
        <button
          onClick={() => setSubTab("history")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            subTab === "history"
              ? "bg-surface-card text-text-primary border-b-2 border-brand-mint"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          Historial
        </button>
      </div>

      {subTab === "new" && (
        <div className="space-y-6">
          <ColdDuckInput onSubmit={addToQueue} processing={processingCount > 0} />

          {/* Queue */}
          {queue.length > 0 && (
            <div className="bg-surface-card rounded-xl border border-surface-border">
              <div className="p-4 border-b border-surface-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-medium text-text-primary">Cola de Outreach</h3>
                  <div className="flex gap-2 text-xs text-text-muted">
                    {pendingCount > 0 && <span>{pendingCount} pendientes</span>}
                    {processingCount > 0 && <span className="text-yellow-400">1 procesando</span>}
                    {doneCount > 0 && <span className="text-green-400">{doneCount} listas</span>}
                    {errorCount > 0 && <span className="text-red-400">{errorCount} errores</span>}
                  </div>
                </div>
                {(doneCount > 0 || errorCount > 0) && (
                  <button
                    onClick={clearCompleted}
                    className="px-3 py-1 text-xs bg-surface-card-hover hover:bg-text-dark border border-surface-border rounded-lg transition-colors text-text-muted"
                  >
                    Limpiar completadas
                  </button>
                )}
              </div>

              <div className="divide-y divide-surface-border">
                {queue.map((item) => (
                  <div key={item.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Status indicator */}
                        <span
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                            item.status === "processing"
                              ? "bg-yellow-400 animate-pulse"
                              : item.status === "done"
                              ? "bg-green-400"
                              : item.status === "error"
                              ? "bg-red-400"
                              : "bg-text-muted"
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
                            className="px-2 py-1 text-xs bg-blue-600/15 text-blue-400 hover:bg-blue-600/25 rounded-lg transition-colors"
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
                            className="px-2 py-1 text-xs bg-surface-card-hover hover:bg-text-dark border border-surface-border rounded-lg transition-colors"
                          >
                            {expandedId === item.id ? "Cerrar" : "Ver resultado"}
                          </button>
                        )}
                        {item.status === "pending" && (
                          <button
                            onClick={() => removeFromQueue(item.id)}
                            className="px-2 py-1 text-xs text-red-400 hover:bg-red-600/10 rounded-lg transition-colors"
                          >
                            Quitar
                          </button>
                        )}
                        {(item.status === "done" || item.status === "error") && (
                          <button
                            onClick={() => removeFromQueue(item.id)}
                            className="px-2 py-1 text-xs text-text-muted hover:text-text-primary transition-colors"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {item.status === "processing" && (
                      <div className="mt-3 ml-5">
                        <Loader size={20} text="Analizando perfil y generando mensaje..." fullscreen={false} />
                        <p className="text-xs text-text-muted mt-1">Esto puede tomar 10-30 segundos</p>
                      </div>
                    )}

                    {item.status === "error" && (
                      <div className="mt-2 ml-5 text-xs text-red-400 bg-red-500/10 rounded-lg p-2">{item.error}</div>
                    )}

                    {item.status === "done" && item.result && expandedId === item.id && (
                      <div className="mt-3">
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
