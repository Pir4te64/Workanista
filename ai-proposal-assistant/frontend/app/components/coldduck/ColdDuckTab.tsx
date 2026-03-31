"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "../Toast";
import DuckIcon from "./DuckIcon";
import Loader from "../Loader";
import {
  processOutreach,
  getOutreach,
  markOutreachResult,
  deleteOutreach,
  getMessages,
  addMessage,
  deleteMessage,
  type OutreachResponse,
  type OutreachRecord,
  type OutreachMessage,
} from "@/lib/coldduck-api";

type Filter = "all" | "pending" | "done" | "archived";

const RESULT_OPTIONS = [
  { value: "pending", label: "Pendiente", color: "#6B6B85", bg: "rgba(255,255,255,0.06)" },
  { value: "replied", label: "Respondio", color: "#4ade80", bg: "rgba(34,197,94,0.1)" },
  { value: "connected", label: "Conectado", color: "#00F5A0", bg: "rgba(0,245,160,0.1)" },
  { value: "meeting", label: "Reunion", color: "#60a5fa", bg: "rgba(59,130,246,0.1)" },
  { value: "ignored", label: "Ignorado", color: "#f87171", bg: "rgba(239,68,68,0.1)" },
  { value: "done", label: "Hecho", color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
] as const;

interface QueueItem {
  id: string;
  linkedin_url?: string;
  profile_text?: string;
  label: string;
  tone: string;
  goal: string;
  status: "pending" | "processing" | "done" | "error";
  result?: OutreachResponse;
  error?: string;
}

export default function ColdDuckTab() {
  const { addToast } = useToast();

  // Queue for new profiles being processed
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const processingRef = useRef(false);

  // History from DB
  const [history, setHistory] = useState<OutreachRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Input form
  const [showForm, setShowForm] = useState(false);
  const [inputMode, setInputMode] = useState<"url" | "manual">("url");
  const [url, setUrl] = useState("");
  const [profileText, setProfileText] = useState("");
  const [tone, setTone] = useState("profesional y cercano");
  const [goal, setGoal] = useState("ofrecer servicios de desarrollo de software a medida");

  // Filter
  const [filter, setFilter] = useState<Filter>("all");

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Messages thread
  const [messages, setMessages] = useState<Record<string, OutreachMessage[]>>({});
  const [newMessage, setNewMessage] = useState("");
  const [messageSender, setMessageSender] = useState<"me" | "client">("me");

  // Load history
  const loadHistory = useCallback(async () => {
    try {
      const data = await getOutreach();
      setHistory(data);
    } catch {
      addToast("error", "Error cargando historial");
    } finally {
      setLoadingHistory(false);
    }
  }, [addToast]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Process queue
  const updateItem = useCallback((id: string, updates: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }, []);

  const processNext = useCallback(async () => {
    if (processingRef.current) return;
    const next = queue.find((i) => i.status === "pending");
    if (!next) return;

    processingRef.current = true;
    updateItem(next.id, { status: "processing" });

    try {
      const data = await processOutreach({
        linkedin_url: next.linkedin_url,
        profile_text: next.profile_text,
        tone: next.tone,
        goal: next.goal,
        generate_video: false,
        avatar_id: "default",
        voice_id: "default",
      });
      updateItem(next.id, {
        status: "done",
        result: data,
        label: data.profile.full_name || next.label,
      });
      // Reload history to get the saved record
      loadHistory();
      addToast("success", `Mensaje generado para ${data.profile.full_name || next.label}`);
    } catch (err) {
      updateItem(next.id, {
        status: "error",
        error: err instanceof Error ? err.message : "Error procesando",
      });
    } finally {
      processingRef.current = false;
    }
  }, [queue, updateItem, loadHistory, addToast]);

  useEffect(() => {
    const hasPending = queue.some((i) => i.status === "pending");
    const hasProcessing = queue.some((i) => i.status === "processing");
    if (hasPending && !hasProcessing && !processingRef.current) {
      processNext();
    }
  }, [queue, processNext]);

  // Add to queue
  const isValidUrl = (u: string) =>
    u.includes("linkedin.com/in/") || u.includes("linkedin.com/company/");

  const handleAdd = () => {
    if (inputMode === "url") {
      if (!url.trim() || !isValidUrl(url)) {
        addToast("error", "URL de LinkedIn invalida");
        return;
      }
      const label = url.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, "").replace(/\/$/, "");
      setQueue((prev) => [...prev, {
        id: crypto.randomUUID(),
        linkedin_url: url.trim(),
        label,
        tone,
        goal,
        status: "pending",
      }]);
      setUrl("");
    } else {
      if (!profileText.trim() || profileText.trim().length < 20) {
        addToast("error", "Pega al menos 20 caracteres del perfil");
        return;
      }
      setQueue((prev) => [...prev, {
        id: crypto.randomUUID(),
        profile_text: profileText.trim(),
        label: profileText.trim().split("\n")[0].slice(0, 40),
        tone,
        goal,
        status: "pending",
      }]);
      setProfileText("");
    }
    addToast("success", "Perfil agregado a la cola");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd();
  };

  const removeQueueItem = (id: string) => {
    setQueue((prev) => prev.filter((i) => i.id !== id));
  };

  // Actions on history items
  const handleDelete = async (id: string) => {
    try {
      await deleteOutreach(id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
      if (expandedId === id) setExpandedId(null);
      addToast("success", "Lead eliminado");
    } catch {
      addToast("error", "Error eliminando lead");
    }
  };

  const handleMarkResult = async (id: string, result: "replied" | "ignored" | "connected" | "meeting" | "pending" | "done") => {
    try {
      await markOutreachResult(id, result);
      setHistory((prev) => prev.map((h) => h.id === id ? { ...h, result } : h));
    } catch {
      addToast("error", "Error actualizando estado");
    }
  };

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    addToast("success", "Mensaje copiado");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!messages[id]) {
        try {
          const msgs = await getMessages(id);
          setMessages((prev) => ({ ...prev, [id]: msgs }));
        } catch { /* ignore */ }
      }
    }
  };

  const handleAddMessage = async (outreachId: string) => {
    if (!newMessage.trim()) return;
    try {
      await addMessage(outreachId, messageSender, newMessage.trim());
      setNewMessage("");
      const msgs = await getMessages(outreachId);
      setMessages((prev) => ({ ...prev, [outreachId]: msgs }));
    } catch {
      addToast("error", "Error al guardar mensaje");
    }
  };

  const handleDeleteMessage = async (outreachId: string, messageId: string) => {
    try {
      await deleteMessage(messageId);
      const msgs = await getMessages(outreachId);
      setMessages((prev) => ({ ...prev, [outreachId]: msgs }));
    } catch {
      addToast("error", "Error al eliminar mensaje");
    }
  };

  // Counts
  const queuePending = queue.filter((i) => i.status === "pending" || i.status === "processing").length;
  const queueErrors = queue.filter((i) => i.status === "error").length;
  const historyActive = history.filter((h) => h.result !== "done").length;
  const historyArchived = history.filter((h) => h.result === "done").length;

  // Filter history
  const filteredHistory = history.filter((h) => {
    if (filter === "pending") return h.result === "pending";
    if (filter === "done") return h.result !== "pending" && h.result !== "done";
    if (filter === "archived") return h.result === "done";
    return h.result !== "done"; // "all" hides archived by default
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(0,245,160,0.08)" }}>
            <DuckIcon size={28} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">ColdDuck</h2>
            <p className="text-[11px] text-text-muted">Lista de perfiles para outreach con IA</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Stats */}
          <div className="flex items-center gap-2 text-xs">
            {queuePending > 0 && (
              <span className="px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-400 animate-pulse">
                {queuePending} procesando
              </span>
            )}
            {queueErrors > 0 && (
              <span className="px-2 py-1 rounded-md bg-red-500/10 text-red-400">
                {queueErrors} errores
              </span>
            )}
            <span className="px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-400">{historyActive} activos</span>
            {historyArchived > 0 && (
              <span className="px-2 py-1 rounded-md bg-purple-500/10 text-purple-400">{historyArchived} archivados</span>
            )}
          </div>
          {/* Filter */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            {([
              { key: "all", label: "Activos" },
              { key: "pending", label: "Pendientes" },
              { key: "done", label: "Contactados" },
              { key: "archived", label: "Archivados" },
            ] as const).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1 text-[11px] font-medium transition-all ${
                  filter === f.key
                    ? "bg-brand-mint text-surface-black"
                    : "bg-surface-dark text-text-muted hover:text-text-primary"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary px-4 py-1.5 text-xs font-medium"
          >
            + Agregar Perfil
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="glass-card p-5 space-y-4 animate-in fade-in slide-in-from-top-2" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-text-primary font-semibold text-sm">Nuevo Perfil</h3>
            <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-text-primary text-lg">&times;</button>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.04)" }}>
            <button
              onClick={() => setInputMode("url")}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                inputMode === "url" ? "bg-brand-mint text-text-dark shadow-sm" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              URL de LinkedIn
            </button>
            <button
              onClick={() => setInputMode("manual")}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                inputMode === "manual" ? "bg-brand-mint text-text-dark shadow-sm" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              Texto manual
            </button>
          </div>

          {inputMode === "url" ? (
            <div>
              <label className="block text-xs text-text-muted mb-1">URL de LinkedIn *</label>
              <input
                className="input-premium w-full"
                placeholder="https://www.linkedin.com/in/nombre-persona"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              {url && !isValidUrl(url) && (
                <p className="text-xs text-red-400/80 mt-1">URL invalida (linkedin.com/in/...)</p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs text-text-muted mb-1">Texto del perfil *</label>
              <textarea
                className="input-premium w-full resize-y"
                rows={4}
                placeholder="Pega la info del perfil: nombre, titulo, experiencia, habilidades..."
                value={profileText}
                onChange={(e) => setProfileText(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          )}

          {/* Tone & Goal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">Tono</label>
              <select value={tone} onChange={(e) => setTone(e.target.value)} className="input-premium w-full text-sm">
                <option value="profesional y cercano">Profesional y cercano</option>
                <option value="casual y directo">Casual y directo</option>
                <option value="formal y ejecutivo">Formal y ejecutivo</option>
                <option value="tecnico y especifico">Tecnico y especifico</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Objetivo</label>
              <input
                className="input-premium w-full text-sm"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 text-[10px] text-text-muted rounded" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                Cmd+Enter
              </kbd>
              <span className="text-[11px] text-text-muted">para agregar</span>
            </div>
            <button onClick={handleAdd} className="btn-primary px-6 py-2 text-sm font-medium">
              Agregar a la cola
            </button>
          </div>
        </div>
      )}

      {/* Queue (items being processed) */}
      {queue.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">Cola de procesamiento</h3>
            {queue.some((i) => i.status === "done" || i.status === "error") && (
              <button
                onClick={() => setQueue((prev) => prev.filter((i) => i.status === "pending" || i.status === "processing"))}
                className="text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                Limpiar completadas
              </button>
            )}
          </div>
          {queue.map((item) => (
            <div
              key={item.id}
              className={`glass-card-hover rounded-lg transition-all ${item.status === "done" ? "opacity-60" : ""}`}
              style={{ border: "1px solid rgba(255,255,255,0.04)" }}
            >
              <div className="flex items-center gap-3 p-3">
                {/* Status dot */}
                <span
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    item.status === "processing"
                      ? "bg-yellow-400 animate-pulse"
                      : item.status === "done"
                      ? "bg-brand-mint"
                      : item.status === "error"
                      ? "bg-red-400"
                      : "bg-text-muted/50"
                  }`}
                />

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-text-primary truncate block">
                    {item.result?.profile.full_name || item.label}
                  </span>
                  {item.result?.profile.headline && (
                    <span className="text-[10px] text-text-muted truncate block">{item.result.profile.headline}</span>
                  )}
                </div>

                {/* Status text */}
                {item.status === "processing" && (
                  <span className="text-[10px] text-yellow-400 animate-pulse flex-shrink-0">Procesando...</span>
                )}
                {item.status === "error" && (
                  <span className="text-[10px] text-red-400 flex-shrink-0 truncate max-w-[200px]">{item.error}</span>
                )}
                {item.status === "done" && item.result && (
                  <button
                    onClick={() => handleCopy(`q-${item.id}`, item.result!.message)}
                    className="btn-primary text-[10px] px-2 py-1 flex-shrink-0"
                  >
                    {copiedId === `q-${item.id}` ? "Copiado!" : "Copiar"}
                  </button>
                )}

                {/* Remove */}
                {item.status !== "processing" && (
                  <button
                    onClick={() => removeQueueItem(item.id)}
                    className="text-text-muted hover:text-red-400 p-1 transition-colors flex-shrink-0"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History List */}
      {loadingHistory ? (
        <div className="flex justify-center py-12">
          <Loader size={24} text="Cargando perfiles..." fullscreen={false} />
        </div>
      ) : filteredHistory.length === 0 && queue.length === 0 ? (
        <div className="glass-card p-10 text-center" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <DuckIcon size={48} />
          <p className="text-text-muted text-sm mt-4">
            No hay perfiles {filter !== "all" ? `(${filter === "pending" ? "pendientes" : "contactados"})` : ""}. Agrega uno con el boton de arriba.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredHistory.map((item) => {
            const profile = item.profile;
            const isExpanded = expandedId === item.id;
            const currentResult = RESULT_OPTIONS.find((o) => o.value === item.result) || RESULT_OPTIONS[0];

            return (
              <div
                key={item.id}
                className="glass-card-hover rounded-lg transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.04)" }}
              >
                {/* Main row */}
                <div className="flex items-center gap-3 p-3">
                  {/* Result badge */}
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: currentResult.color }}
                  />

                  {/* Profile info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-text-primary truncate">
                        {profile?.full_name || "Perfil"}
                      </span>
                      {profile?.industry && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-mint/10 text-brand-mint flex-shrink-0">
                          {profile.industry}
                        </span>
                      )}
                      {item.analysis?.role_level && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "rgba(255,255,255,0.06)", color: "#A0A0B8" }}>
                          {item.analysis.role_level}
                        </span>
                      )}
                    </div>
                    {profile?.headline && (
                      <span className="text-[10px] text-text-muted truncate block">{profile.headline}</span>
                    )}
                  </div>

                  {/* Date */}
                  <span className="text-[10px] text-text-muted flex-shrink-0">
                    {new Date(item.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                  </span>

                  {/* Actions */}
                  {item.linkedin_url && (
                    <a
                      href={item.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] px-2 py-1 rounded-md flex-shrink-0 transition-colors"
                      style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa" }}
                    >
                      LinkedIn
                    </a>
                  )}
                  <button
                    onClick={() => handleCopy(item.id, item.message)}
                    className="btn-primary text-[10px] px-2 py-1 flex-shrink-0"
                  >
                    {copiedId === item.id ? "Copiado!" : "Copiar"}
                  </button>
                  <button
                    onClick={() => handleExpand(item.id)}
                    className="text-text-muted hover:text-text-primary p-1 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-text-muted hover:text-red-400 p-1 transition-colors flex-shrink-0"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-3 pb-4 space-y-4" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    {/* Result status buttons */}
                    <div className="flex gap-1.5 flex-wrap pt-3">
                      {RESULT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleMarkResult(item.id, opt.value)}
                          className="px-2.5 py-1.5 text-[10px] rounded-lg font-medium transition-all"
                          style={
                            item.result === opt.value
                              ? { background: opt.color, color: opt.value === "connected" ? "#0C0C1D" : "#fff" }
                              : { background: "rgba(255,255,255,0.04)", color: "#A0A0B8" }
                          }
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* Message */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Mensaje</h4>
                        <button
                          onClick={() => handleCopy(`msg-${item.id}`, item.message)}
                          className="btn-secondary text-[10px] px-2 py-1"
                        >
                          {copiedId === `msg-${item.id}` ? "Copiado!" : "Copiar"}
                        </button>
                      </div>
                      <div className="rounded-lg p-4 whitespace-pre-wrap text-xs text-text-primary leading-relaxed" style={{ background: "rgba(255,255,255,0.03)" }}>
                        {item.message}
                      </div>
                    </div>

                    {/* Analysis */}
                    {item.analysis && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {item.analysis.pain_points?.length > 0 && (
                          <div>
                            <h4 className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">Pain Points</h4>
                            <div className="flex flex-wrap gap-1">
                              {item.analysis.pain_points.map((p, i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.08)", color: "#f87171" }}>
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {item.analysis.connection_hooks?.length > 0 && (
                          <div>
                            <h4 className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">Hooks</h4>
                            <div className="flex flex-wrap gap-1">
                              {item.analysis.connection_hooks.map((h, i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(0,245,160,0.08)", color: "#00F5A0" }}>
                                  {h}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Conversation */}
                    <div>
                      <h4 className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-3">Conversacion</h4>
                      <div className="space-y-2 mb-3">
                        {(messages[item.id] || []).map((msg) => (
                          <div key={msg.id} className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}>
                            <div
                              className="max-w-[80%] px-3 py-2 rounded-lg text-xs group relative"
                              style={msg.sender === "me" ? { background: "rgba(255,255,255,0.04)" } : { background: "rgba(34,197,94,0.06)" }}
                            >
                              <div className={`text-[10px] mb-1 font-medium ${msg.sender === "me" ? "text-text-muted" : "text-green-400"}`}>
                                {msg.sender === "me" ? "Yo" : "Cliente"}
                              </div>
                              <p className="whitespace-pre-wrap leading-relaxed text-text-primary">{msg.content}</p>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-[10px] text-text-muted">
                                  {new Date(msg.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                </span>
                                <button
                                  onClick={() => handleDeleteMessage(item.id, msg.id)}
                                  className="text-[10px] text-red-400/60 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {(messages[item.id] || []).length === 0 && (
                          <p className="text-[10px] text-text-muted text-center py-2">Sin seguimiento aun</p>
                        )}
                      </div>
                      <div className="flex gap-2 items-end">
                        <textarea
                          value={expandedId === item.id ? newMessage : ""}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Escribir mensaje de seguimiento..."
                          rows={2}
                          className="input-premium flex-1 text-xs resize-none"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddMessage(item.id);
                          }}
                        />
                        <div className="flex flex-col gap-1">
                          <select
                            value={messageSender}
                            onChange={(e) => setMessageSender(e.target.value as "me" | "client")}
                            className="input-premium text-[10px] py-1 px-2"
                          >
                            <option value="me">Yo</option>
                            <option value="client">Cliente</option>
                          </select>
                          <button onClick={() => handleAddMessage(item.id)} className="btn-primary text-[10px] px-3 py-1">
                            Enviar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
