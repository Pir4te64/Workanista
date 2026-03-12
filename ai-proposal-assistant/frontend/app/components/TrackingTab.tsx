"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "./Toast";
import { listActiveScrum, updateScrumData } from "@/lib/scrum-api";
import type { ScrumFull, Sprint, UserStory, StoryStatus } from "@/lib/scrum-api";

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_CYCLE: StoryStatus[] = ["pendiente", "en_progreso", "completada"];
const nextStatus = (s: StoryStatus): StoryStatus =>
  STATUS_CYCLE[(STATUS_CYCLE.indexOf(s) + 1) % STATUS_CYCLE.length];

const storyStatusLabel: Record<StoryStatus, string> = {
  pendiente: "Sin comenzar",
  en_progreso: "En progreso",
  completada: "Completada",
};

const storyStatusColor: Record<StoryStatus, string> = {
  pendiente: "text-text-muted border-white/15 bg-white/4",
  en_progreso: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  completada: "text-brand-mint border-brand-mint/30 bg-brand-mint/10",
};

const priorityColor: Record<string, string> = {
  alta: "text-red-400",
  media: "text-yellow-400",
  baja: "text-text-muted",
};

// ─── Icons ───────────────────────────────────────────────────────────────────

const IconRefresh = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
);

const IconChevron = ({ open }: { open: boolean }) => (
  <svg className={`w-4 h-4 transition-transform ${open ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const IconLoader = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
    <path d="M12 2a10 10 0 0110 10" strokeLinecap="round" />
  </svg>
);

const IconUser = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// ─── Sprint progress bar ─────────────────────────────────────────────────────

function SprintProgress({ sprint }: { sprint: Sprint }) {
  const total = sprint.stories.length;
  const done = sprint.stories.filter((s) => s.status === "completada").length;
  const inProgress = sprint.stories.filter((s) => s.status === "en_progreso").length;
  const pctDone = total ? Math.round((done / total) * 100) : 0;
  const pctIn = total ? Math.round((inProgress / total) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-text-muted">
        <span>{done}/{total} historias completadas</span>
        <span>{pctDone}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden flex">
        <div className="h-full bg-brand-mint transition-all duration-500" style={{ width: `${pctDone}%` }} />
        <div className="h-full bg-yellow-400/60 transition-all duration-500" style={{ width: `${pctIn}%` }} />
      </div>
    </div>
  );
}

// ─── Story row ───────────────────────────────────────────────────────────────

function StoryRow({
  story,
  onToggleStatus,
  saving,
}: {
  story: UserStory;
  onToggleStatus: (storyId: string) => void;
  saving: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg transition-colors ${story.status === "completada" ? "opacity-60" : ""}`}
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <button
        onClick={() => onToggleStatus(story.id)}
        disabled={saving}
        className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
          story.status === "completada" ? "border-brand-mint bg-brand-mint" :
          story.status === "en_progreso" ? "border-yellow-400 bg-yellow-400/20" :
          "border-white/20 bg-transparent hover:border-white/40"
        }`}
        title={`Ciclar estado: ${storyStatusLabel[story.status]}`}
      >
        {story.status === "completada" && (
          <svg className="w-3 h-3 text-surface-black" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 6l3 3 5-5" />
          </svg>
        )}
        {story.status === "en_progreso" && (
          <div className="w-2 h-2 rounded-full bg-yellow-400" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${story.status === "completada" ? "line-through text-text-muted" : "text-text-primary"}`}>
          {story.title}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${storyStatusColor[story.status]}`}>
            {storyStatusLabel[story.status]}
          </span>
          <span className={`text-[10px] font-medium ${priorityColor[story.priority] ?? "text-text-muted"}`}>
            {story.priority}
          </span>
          <span className="text-[10px] text-text-muted">{story.story_points} pts</span>
          {story.assigned_to && (
            <span className="flex items-center gap-1 text-[10px] text-text-muted">
              <IconUser className="w-3 h-3" />{story.assigned_to}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sprint card ─────────────────────────────────────────────────────────────

function SprintCard({
  sprint,
  projectId,
  allSprints,
  projectData,
  onSprints,
}: {
  sprint: Sprint;
  projectId: string;
  allSprints: Sprint[];
  projectData: import("@/lib/scrum-api").ScrumData;
  onSprints: (sprints: Sprint[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  const total = sprint.stories.length;
  const done = sprint.stories.filter((s) => s.status === "completada").length;
  const isComplete = total > 0 && done === total;

  const handleToggleStatus = async (storyId: string) => {
    const updated = allSprints.map((sp) =>
      sp.id === sprint.id
        ? { ...sp, stories: sp.stories.map((s) => s.id === storyId ? { ...s, status: nextStatus(s.status) } : s) }
        : sp
    );
    onSprints(updated);
    setSaving(true);
    try {
      await updateScrumData(projectId, { ...projectData, sprints: updated });
    } catch {
      addToast("error", "Error al guardar el estado");
      onSprints(allSprints); // rollback
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card overflow-hidden">
      <button
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/2 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
          isComplete ? "border-brand-mint bg-brand-mint text-surface-black" : "border-white/20 text-text-muted"
        }`}>
          {isComplete ? "✓" : sprint.number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-text-primary truncate">{sprint.name}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
              isComplete ? "text-brand-mint border-brand-mint/30 bg-brand-mint/10" :
              done > 0 ? "text-yellow-400 border-yellow-400/30 bg-yellow-400/10" :
              "text-text-muted border-white/10 bg-white/4"
            }`}>
              {done}/{total}
            </span>
          </div>
          <SprintProgress sprint={sprint} />
        </div>
        <IconChevron open={open} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {sprint.goal && (
            <p className="text-xs text-text-muted italic border-l-2 border-brand-mint/30 pl-2 py-0.5">
              {sprint.goal}
            </p>
          )}
          {sprint.deliverables.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {sprint.deliverables.map((d) => (
                <span key={d.id} className="text-[10px] px-2 py-1 rounded-full border border-white/10 text-text-muted bg-white/4">
                  📦 {d.title}
                </span>
              ))}
            </div>
          )}
          <div className="space-y-1.5 pt-1">
            {sprint.stories.map((story) => (
              <StoryRow
                key={story.id}
                story={story}
                onToggleStatus={handleToggleStatus}
                saving={saving}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Project panel ────────────────────────────────────────────────────────────

function ProjectPanel({ project, onUpdate }: { project: ScrumFull; onUpdate: (p: ScrumFull) => void }) {
  const [open, setOpen] = useState(true);
  const [sprints, setSprints] = useState<Sprint[]>(project.data.sprints);

  const totalStories = sprints.reduce((s, sp) => s + sp.stories.length, 0);
  const doneStories = sprints.reduce((s, sp) => s + sp.stories.filter((st) => st.status === "completada").length, 0);
  const pct = totalStories ? Math.round((doneStories / totalStories) * 100) : 0;

  const handleSprints = (updated: Sprint[]) => {
    setSprints(updated);
    onUpdate({ ...project, data: { ...project.data, sprints: updated } });
  };

  return (
    <div className="glass-card overflow-hidden">
      {/* Project header */}
      <button
        className="w-full px-5 py-4 flex items-start gap-4 text-left hover:bg-white/2 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-text-primary">{project.project_name}</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border text-brand-mint border-brand-mint/30 bg-brand-mint/10 uppercase tracking-wide">
              ● Activo
            </span>
          </div>
          {project.client_name && (
            <p className="text-xs text-text-muted mt-0.5">{project.client_name}</p>
          )}
          {/* Overall progress */}
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-text-muted">
              <span>{doneStories}/{totalStories} historias totales</span>
              <span className="font-medium text-text-primary">{pct}% completado</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
              <div className="h-full bg-brand-mint transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 mt-0.5">
          <div className="text-right">
            <p className="text-sm font-semibold text-text-primary">{sprints.length}</p>
            <p className="text-[10px] text-text-muted">sprints</p>
          </div>
          <IconChevron open={open} />
        </div>
      </button>

      {/* Sprints */}
      {open && (
        <div className="px-4 pb-4 space-y-2">
          {sprints.map((sprint) => (
            <SprintCard
              key={sprint.id}
              sprint={sprint}
              projectId={project.id}
              allSprints={sprints}
              projectData={project.data}
              onSprints={handleSprints}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main tab ────────────────────────────────────────────────────────────────

export default function TrackingTab() {
  const [projects, setProjects] = useState<ScrumFull[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listActiveScrum();
      setProjects(data);
    } catch {
      addToast("error", "Error al cargar proyectos activos");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = (updated: ScrumFull) => {
    setProjects((p) => p.map((x) => x.id === updated.id ? updated : x));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary tracking-tight">Seguimiento</h2>
          <p className="text-sm text-text-muted mt-0.5">
            Proyectos activos · {projects.length} en curso
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all text-text-muted border-white/10 bg-white/4 hover:text-text-primary disabled:opacity-50"
        >
          {loading ? <IconLoader className="w-3.5 h-3.5" /> : <IconRefresh className="w-3.5 h-3.5" />}
          Actualizar
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <IconLoader className="w-6 h-6 text-brand-mint" />
        </div>
      ) : projects.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-text-primary font-medium">Sin proyectos activos</p>
          <p className="text-sm text-text-muted mt-1">
            Activa un proyecto desde la pestaña Planificacion para verlo aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((p) => (
            <ProjectPanel key={p.id} project={p} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
