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
  { value: "pending", label: "Pendiente", color: "bg-text-muted" },
  { value: "replied", label: "Respondio", color: "bg-green-600" },
  { value: "connected", label: "Conectado", color: "bg-brand-mint" },
  { value: "meeting", label: "Reunion", color: "bg-blue-600" },
  { value: "ignored", label: "Ignorado", color: "bg-red-600" },
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
      <div className="py-12">
        <Loader size={40} text="Cargando historial ColdDuck..." />
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-400 py-12">{error}</div>;
  }

  if (outreach.length === 0) {
    return (
      <div className="text-center text-text-muted py-12">
        <div className="mb-3 flex justify-center"><DuckIcon size={64} /></div>
        No hay outreach en el historial. Genera tu primer ColdDuck!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-text-secondary">
          {outreach.length} outreach{outreach.length !== 1 ? "s" : ""}
        </h3>
        <div className="flex gap-2 text-xs text-text-muted">
          <span>
            {outreach.filter((o) => o.result === "replied" || o.result === "connected" || o.result === "meeting").length}{" "}
            positivos
          </span>
          <span>|</span>
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
            className="bg-surface-card rounded-xl border border-surface-border"
          >
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-sm font-medium text-text-primary">
                    {profile?.full_name || "Perfil"}
                  </h4>
                  <p className="text-xs text-text-secondary">
                    {profile?.headline || item.linkedin_url}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {new Date(item.created_at).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex gap-1 flex-wrap justify-end">
                  {RESULT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleMarkResult(item.id, opt.value)}
                      className={`px-2 py-1 text-xs rounded-full transition-colors ${
                        item.result === opt.value
                          ? `${opt.color} text-white`
                          : "bg-surface-card-hover text-text-muted hover:bg-text-dark"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  {item.analysis?.industry && (
                    <span className="px-2 py-0.5 text-xs bg-brand-mint/10 text-brand-mint rounded">
                      {item.analysis.industry}
                    </span>
                  )}
                  {item.analysis?.role_level && (
                    <span className="px-2 py-0.5 text-xs bg-text-dark/50 text-text-secondary rounded">
                      {item.analysis.role_level}
                    </span>
                  )}
                  {item.video_data && (
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${
                        item.video_data.status === "completed"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-yellow-500/15 text-yellow-400"
                      }`}
                    >
                      Video: {item.video_data.status}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(item.id, item.message)}
                    className="px-3 py-1 text-xs bg-brand-mint hover:bg-brand-mint-dark text-text-dark rounded-lg transition-colors"
                  >
                    {copiedId === item.id ? "Copiado!" : "Copiar"}
                  </button>
                  <button
                    onClick={() => handleExpand(item.id)}
                    className="px-3 py-1 text-xs bg-surface-card-hover hover:bg-text-dark border border-surface-border rounded-lg transition-colors"
                  >
                    {isExpanded ? "Cerrar" : "Ver todo"}
                  </button>
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-surface-border p-5 space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-text-secondary mb-2">
                    Mensaje
                  </h4>
                  <div className="bg-surface-dark rounded-lg p-4 whitespace-pre-wrap text-sm text-text-primary leading-relaxed">
                    {item.message}
                  </div>
                </div>

                {item.analysis?.pain_points && (
                  <div>
                    <h4 className="text-xs font-medium text-text-muted mb-2 uppercase">
                      Pain Points
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {item.analysis.pain_points.map((p, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 text-xs bg-red-500/10 text-red-400 rounded"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {item.video_data?.video_url && (
                  <div>
                    <h4 className="text-sm font-medium text-text-secondary mb-2">
                      Video
                    </h4>
                    <video
                      src={item.video_data.video_url}
                      controls
                      className="w-full rounded-lg max-h-96"
                    />
                  </div>
                )}

                {item.video_data &&
                  item.video_data.status === "processing" && (
                    <button
                      onClick={() =>
                        handleCheckVideo(item.video_data!.video_id, item.id)
                      }
                      className="px-4 py-2 text-xs bg-surface-card-hover hover:bg-text-dark border border-surface-border rounded-lg transition-colors"
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
                      className="text-xs text-brand-mint hover:underline"
                    >
                      Abrir perfil en LinkedIn →
                    </a>
                  </div>
                )}

                {/* Conversation Thread */}
                <div>
                  <h4 className="text-sm font-medium text-text-secondary mb-3">
                    Conversacion
                  </h4>

                  {loadingMessages === item.id ? (
                    <Loader size={24} text="Cargando mensajes..." fullscreen={false} />
                  ) : (
                    <div className="space-y-2 mb-3">
                      {/* Initial outreach message */}
                      <div className="flex justify-end">
                        <div className="max-w-[80%] px-3 py-2 rounded-lg bg-brand-mint/15 text-text-primary text-sm">
                          <div className="text-xs text-brand-mint mb-1 font-medium">
                            Mensaje inicial
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed line-clamp-3">
                            {item.message}
                          </p>
                          <div className="text-xs text-text-muted mt-1">
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
                            className={`max-w-[80%] px-3 py-2 rounded-lg text-sm group relative ${
                              msg.sender === "me"
                                ? "bg-surface-card-hover text-text-primary"
                                : "bg-green-600/15 text-text-primary"
                            }`}
                          >
                            <div
                              className={`text-xs mb-1 font-medium ${
                                msg.sender === "me" ? "text-text-muted" : "text-green-400"
                              }`}
                            >
                              {msg.sender === "me" ? "Yo" : "Cliente"}
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed">
                              {msg.content}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-text-muted">
                                {new Date(msg.created_at).toLocaleDateString("es-ES", {
                                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                                })}
                              </span>
                              <button
                                onClick={() => handleDeleteMessage(item.id, msg.id)}
                                className="text-xs text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {(messages[item.id] || []).length === 0 && (
                        <div className="text-xs text-text-muted text-center py-2">
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
                        className="w-full px-3 py-2 text-sm bg-surface-dark border border-surface-border rounded-lg text-text-primary placeholder:text-text-muted focus:border-brand-mint focus:outline-none resize-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            handleAddMessage(item.id);
                          }
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <select
                        value={messageSender}
                        onChange={(e) => setMessageSender(e.target.value as "me" | "client")}
                        className="px-2 py-1 text-xs bg-surface-dark border border-surface-border rounded text-text-primary focus:border-brand-mint focus:outline-none"
                      >
                        <option value="me">Yo</option>
                        <option value="client">Cliente</option>
                      </select>
                      <button
                        onClick={() => handleAddMessage(item.id)}
                        className="px-3 py-1.5 text-xs bg-brand-mint hover:bg-brand-mint-dark text-text-dark rounded-lg transition-colors"
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
