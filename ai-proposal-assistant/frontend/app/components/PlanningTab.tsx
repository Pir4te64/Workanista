"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "./Toast";
import {
  generatePlanning,
  savePlanning,
  listPlannings,
  getPlanning,
  updatePlanningTasks,
  deletePlanning,
} from "@/lib/api";
import type { PlanningData, PlanningTask, PlanningSummary, PlanningFull, TaskStatus } from "@/lib/api";

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconSparkles({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
      <path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75z" />
      <path d="M5 3l.5 1.5L7 5l-1.5.5L5 7l-.5-1.5L3 5l1.5-.5z" />
    </svg>
  );
}

function IconPlus({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconTrash({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,6 5,6 21,6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

function IconSave({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      <polyline points="17,21 17,13 7,13 7,21" />
      <polyline points="7,3 7,8 15,8" />
    </svg>
  );
}

function IconCheck({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12" />
    </svg>
  );
}

function IconClock({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  );
}

function IconCircle({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

function IconChevronRight({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9,18 15,12 9,6" />
    </svg>
  );
}

function IconLoader({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CYCLE: TaskStatus[] = ["sin_comenzar", "en_proceso", "terminado"];

function nextStatus(current: TaskStatus): TaskStatus {
  const idx = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

function statusLabel(status: TaskStatus): string {
  if (status === "sin_comenzar") return "Sin comenzar";
  if (status === "en_proceso") return "En proceso";
  return "Terminado";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusButton({ status, onClick }: { status: TaskStatus; onClick: () => void }) {
  if (status === "terminado") {
    return (
      <button
        onClick={onClick}
        title="Terminado — click para reiniciar"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 text-brand-mint bg-brand-mint/10 hover:bg-brand-mint/20 border border-brand-mint/20"
      >
        <IconCheck className="w-3.5 h-3.5" />
        Terminado
      </button>
    );
  }
  if (status === "en_proceso") {
    return (
      <button
        onClick={onClick}
        title="En proceso — click para marcar terminado"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 text-blue-400 bg-blue-400/10 hover:bg-blue-400/20 border border-blue-400/20"
      >
        <IconClock className="w-3.5 h-3.5" />
        En proceso
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      title="Sin comenzar — click para iniciar"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 text-text-muted bg-white/4 hover:bg-white/8 border border-white/6 hover:border-white/12"
    >
      <IconCircle className="w-3.5 h-3.5" />
      Sin comenzar
    </button>
  );
}

function ComplexityBadge({ complexity }: { complexity: "baja" | "media" | "alta" }) {
  const styles = {
    baja: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    media: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    alta: "text-red-400 bg-red-400/10 border-red-400/20",
  };
  const labels = { baja: "Baja", media: "Media", alta: "Alta" };
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${styles[complexity]}`}>
      {labels[complexity]}
    </span>
  );
}

function TaskCard({
  task,
  onStatusChange,
}: {
  task: PlanningTask;
  onStatusChange: (id: string, status: TaskStatus) => void;
}) {
  const isTerminado = task.status === "terminado";
  return (
    <div
      className={`glass-card p-4 transition-all duration-200 ${isTerminado ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${isTerminado ? "line-through text-text-muted" : "text-text-primary"}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-text-muted mt-1 leading-relaxed">{task.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <ComplexityBadge complexity={task.complexity} />
        <StatusButton
          status={task.status}
          onClick={() => onStatusChange(task.id, nextStatus(task.status))}
        />
      </div>
    </div>
  );
}

function PlanningStats({ tasks }: { tasks: PlanningTask[] }) {
  const total = tasks.length;
  const terminado = tasks.filter((t) => t.status === "terminado").length;
  const enProceso = tasks.filter((t) => t.status === "en_proceso").length;
  const sinComenzar = tasks.filter((t) => t.status === "sin_comenzar").length;
  const progress = total > 0 ? Math.round((terminado / total) * 100) : 0;

  const complejidades = {
    alta: tasks.filter((t) => t.complexity === "alta").length,
    media: tasks.filter((t) => t.complexity === "media").length,
    baja: tasks.filter((t) => t.complexity === "baja").length,
  };

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Progress bar */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-text-muted">Progreso general</span>
          <span className="text-sm font-semibold text-brand-mint">{progress}%</span>
        </div>
        <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-mint rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Status counters */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-lg font-semibold text-text-primary">{sinComenzar}</p>
          <p className="text-[10px] text-text-muted mt-0.5">Sin comenzar</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-blue-400">{enProceso}</p>
          <p className="text-[10px] text-text-muted mt-0.5">En proceso</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-brand-mint">{terminado}</p>
          <p className="text-[10px] text-text-muted mt-0.5">Terminadas</p>
        </div>
      </div>

      {/* Complexity breakdown */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "1rem" }}>
        <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Complejidad</p>
        <div className="flex gap-2">
          <span className="text-xs text-red-400"><span className="font-semibold">{complejidades.alta}</span> alta</span>
          <span className="text-text-muted text-xs">·</span>
          <span className="text-xs text-yellow-400"><span className="font-semibold">{complejidades.media}</span> media</span>
          <span className="text-text-muted text-xs">·</span>
          <span className="text-xs text-emerald-400"><span className="font-semibold">{complejidades.baja}</span> baja</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PlanningTab() {
  const { addToast } = useToast();

  // List
  const [plannings, setPlannings] = useState<PlanningSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Current planning view
  const [current, setCurrent] = useState<PlanningFull | null>(null);
  const [localTasks, setLocalTasks] = useState<PlanningTask[]>([]);
  const [savingTasks, setSavingTasks] = useState(false);

  // New planning form
  const [isCreating, setIsCreating] = useState(false);
  const [description, setDescription] = useState("");
  const [projectName, setProjectName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<PlanningData | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Load list ──
  const loadList = useCallback(async () => {
    try {
      const data = await listPlannings();
      setPlannings(data);
    } catch {
      addToast("error", "Error al cargar planificaciones");
    } finally {
      setLoadingList(false);
    }
  }, [addToast]);

  useEffect(() => { loadList(); }, [loadList]);

  // ── Open existing planning ──
  const openPlanning = async (id: string) => {
    setIsCreating(false);
    setGeneratedData(null);
    try {
      const data = await getPlanning(id);
      setCurrent(data);
      setLocalTasks(data.data.tasks);
    } catch {
      addToast("error", "Error al cargar planificacion");
    }
  };

  // ── Generate ──
  const handleGenerate = async () => {
    if (!description.trim()) {
      addToast("error", "Escribi una descripcion del proyecto");
      return;
    }
    setGenerating(true);
    try {
      const data = await generatePlanning(description);
      setGeneratedData(data);
      if (!projectName.trim()) {
        setProjectName("Mi proyecto");
      }
    } catch {
      addToast("error", "Error al generar la planificacion");
    } finally {
      setGenerating(false);
    }
  };

  // ── Save new planning ──
  const handleSaveNew = async () => {
    if (!generatedData || !projectName.trim()) return;
    setSaving(true);
    try {
      const saved = await savePlanning(projectName.trim(), description.trim(), generatedData);
      addToast("success", "Planificacion guardada");
      await loadList();
      setCurrent(saved);
      setLocalTasks(saved.data.tasks);
      setIsCreating(false);
      setGeneratedData(null);
      setDescription("");
      setProjectName("");
    } catch {
      addToast("error", "Error al guardar la planificacion");
    } finally {
      setSaving(false);
    }
  };

  // ── Update task status ──
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    if (!current) return;
    const updated = localTasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t));
    setLocalTasks(updated);
    setSavingTasks(true);
    try {
      await updatePlanningTasks(current.id, updated);
    } catch {
      addToast("error", "Error al actualizar tarea");
      setLocalTasks(localTasks); // revert
    } finally {
      setSavingTasks(false);
    }
  };

  // ── Delete planning ──
  const handleDelete = async (id: string) => {
    try {
      await deletePlanning(id);
      addToast("success", "Planificacion eliminada");
      setPlannings((prev) => prev.filter((p) => p.id !== id));
      if (current?.id === id) {
        setCurrent(null);
        setLocalTasks([]);
      }
    } catch {
      addToast("error", "Error al eliminar planificacion");
    }
  };

  // ── Group tasks by phase ──
  const tasksByPhase = current
    ? (current.data.phases ?? []).map((phase) => ({
        phase,
        tasks: localTasks.filter((t) => t.phase === phase).sort((a, b) => a.order - b.order),
      }))
    : [];

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary tracking-tight">Planificaciones</h2>
          <p className="text-sm text-text-muted mt-1">Genera y gestioná planificaciones de proyecto con IA</p>
        </div>
        <button
          onClick={() => {
            setIsCreating(true);
            setCurrent(null);
            setGeneratedData(null);
            setDescription("");
            setProjectName("");
          }}
          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
        >
          <IconPlus className="w-4 h-4" />
          Nueva planificacion
        </button>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-6">
        {/* ── Sidebar: list ── */}
        <div className="space-y-2">
          <p className="section-title mb-3">Guardadas</p>
          {loadingList ? (
            <div className="flex justify-center py-8">
              <IconLoader className="w-5 h-5 text-text-muted" />
            </div>
          ) : plannings.length === 0 ? (
            <div className="glass-card p-5 text-center">
              <p className="text-xs text-text-muted">No hay planificaciones aun</p>
            </div>
          ) : (
            plannings.map((p) => (
              <div
                key={p.id}
                onClick={() => openPlanning(p.id)}
                className={`glass-card-hover p-4 cursor-pointer group ${current?.id === p.id ? "border-brand-mint/30" : ""}`}
                style={current?.id === p.id ? { borderColor: "rgba(0,245,160,0.25)" } : {}}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{p.project_name}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">{formatDate(p.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                      className="p-1 rounded text-text-muted hover:text-red-400 transition-colors"
                    >
                      <IconTrash className="w-3.5 h-3.5" />
                    </button>
                    <IconChevronRight className="w-3.5 h-3.5 text-text-muted" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Main area ── */}
        <div className="min-w-0">
          {/* Create new */}
          {isCreating && !generatedData && (
            <div className="space-y-4">
              <div className="glass-card p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <IconSparkles className="w-5 h-5 text-brand-mint" />
                  <h3 className="text-base font-semibold text-text-primary">Nueva planificacion con IA</h3>
                </div>
                <div>
                  <label className="section-title block mb-2">Nombre del proyecto</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="ej: App de delivery, ERP para empresa X..."
                    className="input-premium w-full text-sm"
                  />
                </div>
                <div>
                  <label className="section-title block mb-2">Descripcion del proyecto</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    placeholder="Describí el proyecto en detalle: qué hay que hacer, tecnologías involucradas, objetivos, restricciones, equipo disponible..."
                    className="input-premium w-full text-sm resize-none"
                  />
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generating || !description.trim()}
                  className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <>
                      <IconLoader className="w-4 h-4" />
                      Generando planificacion...
                    </>
                  ) : (
                    <>
                      <IconSparkles className="w-4 h-4" />
                      Generar con IA
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Preview generated planning before saving */}
          {isCreating && generatedData && (
            <div className="space-y-5">
              {/* Summary */}
              <div className="glass-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="section-title mb-1">Resumen generado</p>
                    <p className="text-sm text-text-secondary leading-relaxed">{generatedData.summary}</p>
                    {generatedData.notes && (
                      <p className="text-xs text-text-muted mt-2 leading-relaxed italic">{generatedData.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={handleSaveNew}
                    disabled={saving}
                    className="btn-primary flex items-center gap-2 px-4 py-2 text-sm shrink-0"
                  >
                    {saving ? <IconLoader className="w-4 h-4" /> : <IconSave className="w-4 h-4" />}
                    Guardar
                  </button>
                </div>
              </div>

              {/* Tasks preview grouped by phase */}
              {(generatedData.phases ?? []).map((phase) => {
                const phaseTasks = (generatedData.tasks ?? [])
                  .filter((t) => t.phase === phase)
                  .sort((a, b) => a.order - b.order);
                if (!phaseTasks.length) return null;
                return (
                  <div key={phase}>
                    <p className="text-xs font-semibold text-brand-mint/80 uppercase tracking-wider mb-3">{phase}</p>
                    <div className="space-y-2">
                      {phaseTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onStatusChange={() => {}}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* View existing planning */}
          {current && !isCreating && (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">{current.project_name}</h3>
                  <p className="text-xs text-text-muted mt-1">
                    Creada {formatDate(current.created_at)}
                    {savingTasks && <span className="ml-2 text-brand-mint/70">· Guardando...</span>}
                  </p>
                  {current.data.summary && (
                    <p className="text-sm text-text-secondary mt-2 leading-relaxed max-w-2xl">{current.data.summary}</p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <PlanningStats tasks={localTasks} />

              {/* Tasks by phase */}
              {tasksByPhase.map(({ phase, tasks }) => {
                if (!tasks.length) return null;
                const done = tasks.filter((t) => t.status === "terminado").length;
                return (
                  <div key={phase}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-brand-mint/80 uppercase tracking-wider">{phase}</p>
                      <span className="text-[10px] text-text-muted">{done}/{tasks.length} terminadas</span>
                    </div>
                    <div className="space-y-2">
                      {tasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onStatusChange={handleStatusChange}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {current.data.notes && (
                <div className="glass-card p-4">
                  <p className="section-title mb-2">Notas</p>
                  <p className="text-xs text-text-secondary leading-relaxed">{current.data.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!isCreating && !current && (
            <div className="glass-card p-12 text-center">
              <div className="text-text-muted mb-4">
                <IconSparkles className="w-10 h-10 mx-auto" />
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">Sin planificacion seleccionada</h3>
              <p className="text-xs text-text-muted">
                Selecciona una planificacion de la lista o crea una nueva con IA.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
