"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "./Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SellerLink {
  id: string;
  url: string;
  title: string;
  assigned_to: string;
  done: boolean;
  notes: string;
  created_at: string;
}

export default function SellersPanel() {
  const { addToast } = useToast();
  const [links, setLinks] = useState<SellerLink[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  // Filter
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/sellers/links`);
      const data = await res.json();
      setLinks(data.links ?? []);
    } catch {
      addToast("error", "Error cargando links");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!url) { addToast("error", "Agrega un link"); return; }
    try {
      await fetch(`${API}/api/sellers/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, title, assigned_to: assignedTo }),
      });
      addToast("success", "Link agregado");
      setUrl(""); setTitle(""); setAssignedTo(""); setShowForm(false);
      load();
    } catch { addToast("error", "Error creando link"); }
  };

  const toggleDone = async (link: SellerLink) => {
    try {
      await fetch(`${API}/api/sellers/links/${link.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !link.done }),
      });
      setLinks((prev) => prev.map((l) => l.id === link.id ? { ...l, done: !l.done } : l));
    } catch { addToast("error", "Error actualizando"); }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API}/api/sellers/links/${id}`, { method: "DELETE" });
      setLinks((prev) => prev.filter((l) => l.id !== id));
      addToast("success", "Link eliminado");
    } catch { addToast("error", "Error eliminando"); }
  };

  const updateNotes = async (id: string, notes: string) => {
    try {
      await fetch(`${API}/api/sellers/links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      setLinks((prev) => prev.map((l) => l.id === id ? { ...l, notes } : l));
    } catch { addToast("error", "Error guardando nota"); }
  };

  const filtered = links.filter((l) => {
    if (filter === "pending") return !l.done;
    if (filter === "done") return l.done;
    return true;
  });

  const pendingCount = links.filter((l) => !l.done).length;
  const doneCount = links.filter((l) => l.done).length;

  return (
    <div className="space-y-5">
      {/* Stats + Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-400">{pendingCount} pendientes</span>
            <span className="px-2 py-1 rounded-md bg-green-500/10 text-green-400">{doneCount} hechos</span>
          </div>
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            {(["all", "pending", "done"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-[11px] font-medium transition-all ${
                  filter === f ? "bg-brand-mint text-surface-black" : "bg-surface-dark text-text-muted hover:text-text-primary"
                }`}
              >
                {f === "all" ? "Todos" : f === "pending" ? "Pendientes" : "Hechos"}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary px-4 py-1.5 text-xs font-medium"
        >
          + Agregar Link
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="glass-card p-5 space-y-4 animate-in fade-in slide-in-from-top-2" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-text-primary font-semibold text-sm">Nuevo Link de Workana</h3>
            <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-text-primary text-lg">&times;</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs text-text-muted mb-1">URL de Workana *</label>
              <input className="input-premium w-full" placeholder="https://www.workana.com/job/..." value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Asignar a</label>
              <input className="input-premium w-full" placeholder="Nombre del vendedor..." value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs text-text-muted mb-1">Título / Descripción</label>
              <input className="input-premium w-full" placeholder="Breve descripción del proyecto..." value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={handleCreate} className="btn-primary px-6 py-2 text-sm font-medium">Guardar</button>
          </div>
        </div>
      )}

      {/* Links List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-brand-mint border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-10 text-center" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-text-muted text-sm">No hay links {filter !== "all" ? `(${filter === "pending" ? "pendientes" : "hechos"})` : ""}. Agrega uno con el botón de arriba.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((link) => (
            <LinkRow key={link.id} link={link} onToggle={toggleDone} onDelete={handleDelete} onUpdateNotes={updateNotes} />
          ))}
        </div>
      )}
    </div>
  );
}

function LinkRow({
  link,
  onToggle,
  onDelete,
  onUpdateNotes,
}: {
  link: SellerLink;
  onToggle: (l: SellerLink) => void;
  onDelete: (id: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(link.notes || "");

  return (
    <div
      className={`glass-card-hover rounded-lg transition-all ${link.done ? "opacity-60" : ""}`}
      style={{ border: "1px solid rgba(255,255,255,0.04)" }}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Checkbox */}
        <button
          onClick={() => onToggle(link)}
          className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all ${
            link.done
              ? "bg-brand-mint"
              : "bg-surface-dark"
          }`}
          style={{ border: link.done ? "none" : "1px solid rgba(255,255,255,0.1)" }}
        >
          {link.done && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0F0F1E" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-xs font-medium hover:underline truncate ${
                link.done ? "text-text-muted line-through" : "text-brand-mint"
              }`}
            >
              {link.title || link.url}
            </a>
            {link.assigned_to && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 flex-shrink-0">
                {link.assigned_to}
              </span>
            )}
          </div>
          {link.title && (
            <div className="text-[10px] text-text-muted truncate mt-0.5">{link.url}</div>
          )}
        </div>

        {/* Date */}
        <span className="text-[10px] text-text-muted flex-shrink-0">
          {new Date(link.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
        </span>

        {/* Actions */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-text-muted hover:text-text-primary p-1 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(link.id)}
          className="text-text-muted hover:text-red-400 p-1 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>

      {/* Expanded notes */}
      {expanded && (
        <div className="px-3 pb-3 pt-0">
          <textarea
            className="input-premium w-full text-xs min-h-[50px] resize-y"
            placeholder="Notas..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== link.notes) onUpdateNotes(link.id, notes);
            }}
          />
        </div>
      )}
    </div>
  );
}
