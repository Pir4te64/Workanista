"use client";

import { useEffect, useState } from "react";
import {
  getOutreach,
  markOutreachResult,
  checkVideoStatus,
  getMessages,
  addMessage,
  deleteMessage,
  type OutreachRecord,
  type OutreachMessage,
} from "@/lib/coldduck-api";
import DuckIcon from "./DuckIcon";
import Loader from "../Loader";

const RESULT_OPTIONS = [
  { value: "pending", label: "Pendiente", bg: "rgba(255,255,255,0.06)", activeBg: "#6B6B85", activeText: "#fff" },
  { value: "replied", label: "Respondio", bg: "rgba(34,197,94,0.1)", activeBg: "#22c55e", activeText: "#fff" },
  { value: "connected", label: "Conectado", bg: "rgba(0,245,160,0.1)", activeBg: "#00F5A0", activeText: "#0C0C1D" },
  { value: "meeting", label: "Reunion", bg: "rgba(59,130,246,0.1)", activeBg: "#3b82f6", activeText: "#fff" },
  { value: "ignored", label: "Ignorado", bg: "rgba(239,68,68,0.1)", activeBg: "#ef4444", activeText: "#fff" },
] as const;

export default function ColdDuckHistory() {
  const [outreach, setOutreach] = useState<OutreachRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, OutreachMessage[]>>({});
  const [newMessage, setNewMessage] = useState("");
  const [messageSender, setMessageSender] = useState<"me" | "client">("me");
  const [loadingMessages, setLoadingMessages] = useState<string | null>(null);

  const fetchOutreach = async () => {
    try {
      const data = await getOutreach();
      setOutreach(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutreach();
  }, []);

  const handleMarkResult = async (
    outreachId: string,
    result: "replied" | "ignored" | "connected" | "meeting" | "pending"
  ) => {
    try {
      await markOutreachResult(outreachId, result);
      await fetchOutreach();
    } catch {
      setError("Error al actualizar resultado");
    }
  };

  const handleCheckVideo = async (
    videoId: string,
    outreachId: string
  ) => {
    try {
      await checkVideoStatus(videoId, outreachId);
      await fetchOutreach();
    } catch {
      setError("Error al verificar video");
    }
  };

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const loadMessages = async (outreachId: string) => {
    setLoadingMessages(outreachId);
    try {
      const msgs = await getMessages(outreachId);
      setMessages((prev) => ({ ...prev, [outreachId]: msgs }));
    } catch {
      setError("Error al cargar mensajes");
    } finally {
      setLoadingMessages(null);
    }
  };

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!messages[id]) {
        await loadMessages(id);
      }
    }
  };

  const handleAddMessage = async (outreachId: string) => {
    if (!newMessage.trim()) return;
    try {
      await addMessage(outreachId, messageSender, newMessage.trim());
      setNewMessage("");
      await loadMessages(outreachId);
    } catch {
      setError("Error al guardar mensaje");
    }
  };

  const handleDeleteMessage = async (outreachId: string, messageId: string) => {
    try {
      await deleteMessage(messageId);
      await loadMessages(outreachId);
    } catch {
      setError("Error al eliminar mensaje");
    }
  };

  if (loading) {
    return (
      <div className="py-16">
        <Loader size={40} text="Cargando historial ColdDuck..." />
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-400/80 py-16 text-sm">{error}</div>;
  }

  if (outreach.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-text-muted py-16">
        <DuckIcon size={56} />
        <p className="mt-4 text-sm">No hay outreach en el historial. Genera tu primer ColdDuck!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-text-secondary">
          {outreach.length} outreach{outreach.length !== 1 ? "s" : ""}
        </h3>
        <div className="flex gap-3 text-xs text-text-muted">
          <span>
            {outreach.filter((o) => o.result === "replied" || o.result === "connected" || o.result === "meeting").length}{" "}
            positivos
          </span>
          <span className="text-text-muted/30">|</span>
          <span>
            {outreach.filter((o) => o.result === "pending").length} pendientes
          </span>
        </div>
      </div>

      {outreach.map((item) => {
        const profile = item.profile;
        const isExpanded = expandedId === item.id;

        return (
          <div
            key={item.id}
            className="glass-card transition-all duration-200 hover:shadow-card-hover"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-sm font-medium text-text-primary">
                    {profile?.full_name || "Perfil"}
                  </h4>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {profile?.headline || item.linkedin_url}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    {new Date(item.created_at).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {RESULT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleMarkResult(item.id, opt.value)}
                      className="px-2.5 py-1.5 text-xs rounded-lg font-medium transition-all duration-200"
                      style={
                        item.result === opt.value
                          ? { background: opt.activeBg, color: opt.activeText }
                          : { background: "rgba(255,255,255,0.04)", color: "#A0A0B8" }
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  {item.analysis?.industry && (
                    <span className="badge" style={{ background: "rgba(0,245,160,0.08)", color: "#00F5A0" }}>
                      {item.analysis.industry}
                    </span>
                  )}
                  {item.analysis?.role_level && (
                    <span className="badge" style={{ background: "rgba(255,255,255,0.06)", color: "#A0A0B8" }}>
                      {item.analysis.role_level}
                    </span>
                  )}
                  {item.video_data && (
                    <span
                      className="badge"
                      style={
                        item.video_data.status === "completed"
                          ? { background: "rgba(34,197,94,0.08)", color: "#4ade80" }
                          : { background: "rgba(234,179,8,0.08)", color: "#facc15" }
                      }
                    >
                      Video: {item.video_data.status}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(item.id, item.message)}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    {copiedId === item.id ? "Copiado!" : "Copiar"}
                  </button>
                  <button
                    onClick={() => handleExpand(item.id)}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    {isExpanded ? "Cerrar" : "Ver todo"}
                  </button>
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="p-6 pt-0 space-y-5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <div className="pt-5">
                  <h4 className="section-title mb-3">
                    Mensaje
                  </h4>
                  <div className="rounded-xl p-5 whitespace-pre-wrap text-sm text-text-primary leading-relaxed" style={{ background: "rgba(255,255,255,0.03)" }}>
                    {item.message}
                  </div>
                </div>

                {item.analysis?.pain_points && (
                  <div>
                    <h4 className="section-title mb-3">
                      Pain Points
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {item.analysis.pain_points.map((p, i) => (
                        <span
                          key={i}
                          className="badge" style={{ background: "rgba(239,68,68,0.08)", color: "#f87171" }}
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {item.video_data?.video_url && (
                  <div>
                    <h4 className="section-title mb-3">
                      Video
                    </h4>
                    <video
                      src={item.video_data.video_url}
                      controls
                      className="w-full rounded-xl max-h-96"
                    />
                  </div>
                )}

                {item.video_data &&
                  item.video_data.status === "processing" && (
                    <button
                      onClick={() =>
                        handleCheckVideo(item.video_data!.video_id, item.id)
                      }
                      className="btn-secondary text-xs"
                    >
                      Verificar estado del video
                    </button>
                  )}

                {item.linkedin_url && (
                  <div>
                    <a
                      href={item.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-mint/80 hover:text-brand-mint transition-colors"
                    >
                      Abrir perfil en LinkedIn →
                    </a>
                  </div>
                )}

                {/* Conversation Thread */}
                <div>
                  <h4 className="section-title mb-4">
                    Conversacion
                  </h4>

                  {loadingMessages === item.id ? (
                    <Loader size={24} text="Cargando mensajes..." fullscreen={false} />
                  ) : (
                    <div className="space-y-2.5 mb-4">
                      {/* Initial outreach message */}
                      <div className="flex justify-end">
                        <div className="max-w-[80%] px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(0,245,160,0.06)" }}>
                          <div className="text-xs text-brand-mint mb-1.5 font-medium">
                            Mensaje inicial
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed line-clamp-3 text-text-primary">
                            {item.message}
                          </p>
                          <div className="text-xs text-text-muted mt-1.5">
                            {new Date(item.created_at).toLocaleDateString("es-ES", {
                              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Follow-up messages */}
                      {(messages[item.id] || []).map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className="max-w-[80%] px-4 py-3 rounded-xl text-sm group relative"
                            style={
                              msg.sender === "me"
                                ? { background: "rgba(255,255,255,0.04)" }
                                : { background: "rgba(34,197,94,0.06)" }
                            }
                          >
                            <div
                              className={`text-xs mb-1.5 font-medium ${
                                msg.sender === "me" ? "text-text-muted" : "text-green-400"
                              }`}
                            >
                              {msg.sender === "me" ? "Yo" : "Cliente"}
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed text-text-primary">
                              {msg.content}
                            </p>
                            <div className="flex items-center justify-between mt-1.5">
                              <span className="text-xs text-text-muted">
                                {new Date(msg.created_at).toLocaleDateString("es-ES", {
                                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                                })}
                              </span>
                              <button
                                onClick={() => handleDeleteMessage(item.id, msg.id)}
                                className="text-xs text-red-400/60 opacity-0 group-hover:opacity-100 transition-opacity ml-2 hover:text-red-400"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {(messages[item.id] || []).length === 0 && (
                        <div className="text-xs text-text-muted text-center py-3">
                          No hay seguimiento aun. Agrega mensajes abajo.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Add message form */}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <textarea
                        value={expandedId === item.id ? newMessage : ""}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Escribir mensaje de seguimiento..."
                        rows={2}
                        className="input-premium text-sm resize-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            handleAddMessage(item.id);
                          }
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <select
                        value={messageSender}
                        onChange={(e) => setMessageSender(e.target.value as "me" | "client")}
                        className="input-premium text-xs py-1.5 px-2"
                      >
                        <option value="me">Yo</option>
                        <option value="client">Cliente</option>
                      </select>
                      <button
                        onClick={() => handleAddMessage(item.id)}
                        className="btn-primary text-xs px-3 py-1.5"
                      >
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
  );
}
