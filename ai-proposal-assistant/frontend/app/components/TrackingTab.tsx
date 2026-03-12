"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "./Toast";
import { listActiveScrum, updateScrumData } from "@/lib/scrum-api";
import type { ScrumFull, Sprint, UserStory, StoryStatus } from "@/lib/scrum-api";

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_CYCLE: StoryStatus[] = ["pendiente", "en_progreso", "completada"];
const nextStatus = (s: StoryStatus): StoryStatus =>
  STATUS_CYCLE[(STATUS_CYCLE.indexOf(s) + 1) % STATUS_CYCLE.length];

// ─── Status & Priority visual config (Linear-style) ─────────────────────────

const statusConfig: Record<StoryStatus, { label: string; dot: string; text: string; bg: string }> = {
  pendiente:   { label: "Sin comenzar", dot: "bg-zinc-400",   text: "text-zinc-400",   bg: "bg-zinc-400/10" },
  en_progreso: { label: "En progreso", dot: "bg-amber-400",  text: "text-amber-400",  bg: "bg-amber-400/10" },
  completada:  { label: "Completada",   dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-400/10" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  alta:  { label: "Alta",  color: "text-red-400" },
  media: { label: "Media", color: "text-amber-400" },
  baja:  { label: "Baja",  color: "text-zinc-500" },
};

// ─── Icons ───────────────────────────────────────────────────────────────────

const IconRefresh = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
);

const IconChevron = ({ open }: { open: boolean }) => (
  <svg className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const IconLoader = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
    <path d="M12 2a10 10 0 0110 10" strokeLinecap="round" />
  </svg>
);

// ─── Story row (Jira backlog-style) ─────────────────────────────────────────

function StoryRow({
  story,
  onToggleStatus,
  saving,
}: {
  story: UserStory;
  onToggleStatus: (storyId: string) => void;
  saving: boolean;
}) {
  const sc = statusConfig[story.status];
  const pc = priorityConfig[story.priority] ?? priorityConfig.media;

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2 hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] last:border-b-0 ${
        story.status === "completada" ? "opacity-50" : ""
      }`}
    >
      {/* Status dot toggle */}
      <button
        onClick={() => onToggleStatus(story.id)}
        disabled={saving}
        className="shrink-0 relative"
        title={`Estado: ${sc.label}`}
      >
        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
          story.status === "completada"
            ? "border-emerald-400 bg-emerald-400"
            : story.status === "en_progreso"
            ? "border-amber-400 bg-amber-400/20"
            : "border-zinc-500 hover:border-zinc-400"
        }`}>
          {story.status === "completada" && (
            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6l3 3 5-5" />
            </svg>
          )}
          {story.status === "en_progreso" && (
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          )}
        </div>
      </button>

      {/* Title */}
      <p className={`flex-1 text-sm leading-snug truncate ${
        story.status === "completada" ? "line-through text-text-muted" : "text-text-primary"
      }`}>
        {story.title}
      </p>

      {/* Priority */}
      <span className={`text-xs font-medium uppercase tracking-wide ${pc.color} hidden sm:block`}>
        {story.priority === "alta" && (
          <svg className="w-3.5 h-3.5 inline mr-0.5 -mt-px" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 3l5 10H3z" />
          </svg>
        )}
        {pc.label}
      </span>

      {/* Points */}
      <span className={`text-xs font-mono tabular-nums w-8 text-right ${
        story.story_points >= 13 ? "text-red-400" : story.story_points >= 5 ? "text-amber-400" : "text-text-muted"
      }`}>
        {story.story_points}
      </span>

      {/* Assigned */}
      {story.assigned_to && (
        <span className="text-xs text-text-muted truncate max-w-[80px] hidden md:block">
          {story.assigned_to}
        </span>
      )}
    </div>
  );
}

// ─── Sprint section ─────────────────────────────────────────────────────────

function SprintSection({
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
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  const total = sprint.stories.length;
  const done = sprint.stories.filter((s) => s.status === "completada").length;
  const inProgress = sprint.stories.filter((s) => s.status === "en_progreso").length;
  const pctDone = total ? Math.round((done / total) * 100) : 0;
  const pctInProgress = total ? Math.round((inProgress / total) * 100) : 0;

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
      onSprints(allSprints);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Sprint header */}
      <button
        className="w-full px-4 py-3 flex items-center gap-3 text-left bg-surface-card/60 hover:bg-surface-card/80 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <IconChevron open={open} />

        <span className="text-sm font-semibold text-text-primary">{sprint.name}</span>

        {/* Counters */}
        <div className="flex items-center gap-2 ml-auto text-xs">
          {done > 0 && (
            <span className="text-emerald-400 font-medium">{done} done</span>
          )}
          {inProgress > 0 && (
            <span className="text-amber-400 font-medium">{inProgress} in progress</span>
          )}
          <span className="text-text-muted">{total} items</span>
        </div>

        {/* Progress bar */}
        <div className="w-24 shrink-0">
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden flex">
            <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${pctDone}%` }} />
            <div className="h-full bg-amber-400/60 transition-all duration-500" style={{ width: `${pctInProgress}%` }} />
          </div>
        </div>
        <span className="text-xs text-text-muted tabular-nums w-8 text-right">{pctDone}%</span>
      </button>

      {/* Stories list */}
      {open && (
        <div>
          {sprint.goal && (
            <div className="px-4 py-2 text-xs text-text-muted border-b border-white/[0.04]" style={{ background: "rgba(255,255,255,0.015)" }}>
              {sprint.goal}
            </div>
          )}
          {/* Column headers */}
          <div className="flex items-center gap-3 px-3 py-1.5 text-[11px] text-text-muted uppercase tracking-wider font-medium border-b border-white/[0.04]" style={{ background: "rgba(255,255,255,0.015)" }}>
            <span className="w-4 shrink-0" />
            <span className="flex-1">Titulo</span>
            <span className="hidden sm:block">Prioridad</span>
            <span className="w-8 text-right">Pts</span>
          </div>
          {sprint.stories.map((story) => (
            <StoryRow
              key={story.id}
              story={story}
              onToggleStatus={handleToggleStatus}
              saving={saving}
            />
          ))}
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
    <div className="space-y-3">
      {/* Project header */}
      <button
        className="w-full flex items-center gap-4 text-left group"
        onClick={() => setOpen(!open)}
      >
        <IconChevron open={open} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-text-primary">{project.project_name}</h3>
            {project.client_name && (
              <span className="text-sm text-text-muted">{project.client_name}</span>
            )}
          </div>
        </div>

        {/* Project-level stats */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-emerald-400 font-medium">{doneStories}</span>
            <span className="text-text-muted">/</span>
            <span className="text-text-muted">{totalStories}</span>
          </div>
          <div className="w-32 shrink-0">
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <span className="text-sm font-medium text-text-primary tabular-nums w-10 text-right">{pct}%</span>
        </div>
      </button>

      {/* Sprints */}
      {open && (
        <div className="space-y-2 ml-6">
          {sprints.map((sprint) => (
            <SprintSection
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary tracking-tight">Seguimiento</h2>
          <p className="text-sm text-text-muted mt-0.5">
            {projects.length} proyecto{projects.length !== 1 ? "s" : ""} activo{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-text-muted hover:text-text-primary disabled:opacity-50"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {loading ? <IconLoader className="w-3.5 h-3.5" /> : <IconRefresh className="w-3.5 h-3.5" />}
          Actualizar
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <IconLoader className="w-5 h-5 text-text-muted" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-lg p-12 text-center" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-text-secondary font-medium">Sin proyectos activos</p>
          <p className="text-sm text-text-muted mt-1">
            Activa un proyecto desde Planificacion para verlo aca.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {projects.map((p) => (
            <ProjectPanel key={p.id} project={p} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
