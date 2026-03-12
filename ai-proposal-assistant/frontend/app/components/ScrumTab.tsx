"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "./Toast";
import {
  generateScrum, saveScrum, listScrum, getScrum, deleteScrum, updateScrumStatus,
} from "@/lib/scrum-api";
import type {
  ScrumData, ScrumFull, ScrumSummary, Sprint, UserStory, SprintDeliverable,
  StoryStatus, StoryPriority, ProjectStatus,
} from "@/lib/scrum-api";
import { FIBONACCI } from "@/lib/scrum-api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => `id-${crypto.randomUUID().slice(0, 8)}`;

const STATUS_CYCLE: StoryStatus[] = ["pendiente", "en_progreso", "completada"];
const nextStatus = (s: StoryStatus): StoryStatus =>
  STATUS_CYCLE[(STATUS_CYCLE.indexOf(s) + 1) % STATUS_CYCLE.length];

const sprintPoints = (sprint: Sprint) =>
  sprint.stories.reduce((sum, s) => sum + (s.story_points || 0), 0);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });

const emptyStory = (): UserStory => ({
  id: uid(), title: "", description: "", acceptance_criteria: [""],
  story_points: 3, priority: "media", status: "pendiente",
});

const emptySprint = (number: number): Sprint => ({
  id: uid(), number, name: `Sprint ${number}`, goal: "",
  duration_weeks: 2, start_date: "", end_date: "",
  stories: [emptyStory()],
  deliverables: [{ id: uid(), title: "", description: "" }],
});

const emptyProject = (): ScrumData => ({
  summary: "", recommended_velocity: 30, total_estimated_points: 0,
  sprints: [emptySprint(1)], notes: "",
});

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconSparkles = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
    <path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75z" />
    <path d="M5 3l.5 1.5L7 5l-1.5.5L5 7l-.5-1.5L3 5l1.5-.5z" />
  </svg>
);
const IconPlus = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconTrash = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3,6 5,6 21,6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
);
const IconSave = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
  </svg>
);
const IconPDF = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14,2 14,8 20,8" />
    <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);
const IconLoader = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);
const IconChevron = ({ open, className = "w-4 h-4" }: { open: boolean; className?: string }) => (
  <svg className={`${className} transition-transform duration-200 ${open ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9,18 15,12 9,6" />
  </svg>
);
const IconEdit = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

// ─── Inline badges (Linear-style) ────────────────────────────────────────────

function StatusDot({ status, onClick }: { status: StoryStatus; onClick?: () => void }) {
  const cfg: Record<StoryStatus, string> = {
    pendiente: "border-zinc-500 hover:border-zinc-400",
    en_progreso: "border-amber-400 bg-amber-400/20",
    completada: "border-emerald-400 bg-emerald-400",
  };
  return (
    <button onClick={onClick} className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${cfg[status]}`}
      title={status === "pendiente" ? "Pendiente" : status === "en_progreso" ? "En progreso" : "Completada"}>
      {status === "completada" && (
        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 6l3 3 5-5" />
        </svg>
      )}
      {status === "en_progreso" && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
    </button>
  );
}

function PrioritySelect({ priority, onChange }: { priority: StoryPriority; onChange?: (v: StoryPriority) => void }) {
  const colors: Record<StoryPriority, string> = {
    alta: "text-red-400",
    media: "text-amber-400",
    baja: "text-zinc-500",
  };
  if (!onChange) {
    return <span className={`text-xs font-medium uppercase tracking-wide ${colors[priority]}`}>{priority}</span>;
  }
  return (
    <select value={priority} onChange={(e) => onChange(e.target.value as StoryPriority)}
      className={`text-xs font-medium uppercase tracking-wide bg-transparent cursor-pointer border-0 outline-none ${colors[priority]}`}>
      <option value="alta">Alta</option>
      <option value="media">Media</option>
      <option value="baja">Baja</option>
    </select>
  );
}

function PointsSelect({ points, onChange }: { points: number; onChange?: (v: number) => void }) {
  const color = points <= 3 ? "text-emerald-400" : points <= 8 ? "text-amber-400" : "text-red-400";
  if (!onChange) return <span className={`text-xs font-mono font-bold tabular-nums ${color}`}>{points}</span>;
  return (
    <select value={points} onChange={(e) => onChange(Number(e.target.value))}
      className={`text-xs font-mono font-bold bg-transparent cursor-pointer border-0 outline-none ${color}`}>
      {FIBONACCI.map((f) => <option key={f} value={f}>{f}</option>)}
    </select>
  );
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

async function exportToPDF(project: ScrumFull) {
  const jsPDF = (await import("jspdf")).default;
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 15;
  const CW = PW - M * 2;

  type RGB = [number, number, number];
  const BLACK: RGB = [15, 15, 30];
  const MINT: RGB = [0, 200, 130];
  const GRAY: RGB = [120, 120, 140];
  const LIGHT: RGB = [240, 240, 248];
  const WHITE: RGB = [255, 255, 255];
  const DARK_BG: RGB = [28, 28, 54];

  const setColor = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2]);
  const setFill = (c: readonly number[]) => doc.setFillColor(c[0], c[1], c[2]);

  let y = M;

  setFill(DARK_BG);
  doc.rect(0, 0, PW, 52, "F");
  setColor(MINT);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("CruzNegraDev LLC", M, y + 6);
  setColor(WHITE);
  doc.setFontSize(22);
  doc.text("SPRINT PLANNING", PW - M, y + 6, { align: "right" });
  y += 16;
  setColor(LIGHT);
  doc.setFontSize(13);
  doc.text(project.project_name, M, y);
  y += 7;
  setColor([170, 170, 200] as RGB);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const meta: string[] = [];
  if (project.client_name) meta.push(`Cliente: ${project.client_name}`);
  meta.push(`Generado: ${new Date().toLocaleDateString("es-AR")}`);
  doc.text(meta.join("   ·   "), M, y);
  y = 60;

  if (project.data.summary) {
    setColor(BLACK);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(project.data.summary, CW);
    doc.text(lines, M, y);
    y += lines.length * 5 + 4;
  }

  const totalSprints = project.data.sprints.length;
  const totalPoints = project.data.sprints.reduce((s, sp) => s + sprintPoints(sp), 0);
  const totalStories = project.data.sprints.reduce((s, sp) => s + sp.stories.length, 0);
  const velocity = project.data.recommended_velocity;

  autoTable(doc, {
    startY: y,
    head: [["Sprints", "Total Story Points", "User Stories", "Velocidad recomendada"]],
    body: [[`${totalSprints} sprints`, `${totalPoints} puntos`, `${totalStories} historias`, `${velocity} pts/sprint`]],
    margin: { left: M, right: M },
    headStyles: { fillColor: [0, 200, 130], textColor: [15, 15, 30], fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 9, textColor: BLACK, halign: "center" },
    columnStyles: { 0: { halign: "center" }, 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" } },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  for (const sprint of project.data.sprints) {
    const points = sprintPoints(sprint);
    const completedStories = sprint.stories.filter((s) => s.status === "completada").length;
    if (y > PH - 60) { doc.addPage(); y = M; }

    setFill(DARK_BG);
    doc.roundedRect(M, y, CW, 18, 2, 2, "F");
    setColor(MINT);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Sprint ${sprint.number}: ${sprint.name}`, M + 4, y + 7);
    setColor([170, 170, 200] as RGB);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`${points} pts  ·  ${sprint.stories.length} historias  ·  ${sprint.duration_weeks} semanas  ·  ${completedStories}/${sprint.stories.length} completadas`, PW - M - 4, y + 7, { align: "right" });

    if (sprint.goal) {
      setColor(GRAY);
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      const goalLines = doc.splitTextToSize(`Objetivo: ${sprint.goal}`, CW - 8);
      doc.text(goalLines, M + 4, y + 14);
      y += goalLines.length * 4;
    }
    y += 22;

    if (sprint.stories.length > 0) {
      const rows = sprint.stories.map((story, i) => {
        const statusLabel = story.status === "completada" ? "✓ Completada" : story.status === "en_progreso" ? "► En progreso" : "○ Pendiente";
        return [`${i + 1}`, story.title || "(sin título)", story.acceptance_criteria.filter(Boolean).join("\n") || "—", `${story.story_points}pt`, story.priority.toUpperCase(), statusLabel];
      });
      autoTable(doc, {
        startY: y,
        head: [["#", "Historia de usuario", "Criterios de aceptación", "Pts", "Prior.", "Estado"]],
        body: rows,
        margin: { left: M, right: M },
        headStyles: { fillColor: [40, 40, 70], textColor: WHITE, fontStyle: "bold", fontSize: 7.5 },
        bodyStyles: { fontSize: 7.5, textColor: BLACK, valign: "top" },
        columnStyles: { 0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 62 }, 2: { cellWidth: 58 }, 3: { cellWidth: 12, halign: "center" }, 4: { cellWidth: 14, halign: "center" }, 5: { cellWidth: 26, halign: "center" } },
        alternateRowStyles: { fillColor: [245, 245, 252] },
        didParseCell: (data) => {
          if (data.column.index === 3) {
            const val = Number(String(data.cell.text).replace("pt", ""));
            if (val >= 13) data.cell.styles.textColor = [200, 60, 60];
            else if (val >= 5) data.cell.styles.textColor = [180, 140, 0];
            else data.cell.styles.textColor = [30, 160, 100];
          }
          if (data.column.index === 4) {
            const v = String(data.cell.text).toLowerCase();
            if (v === "alta") data.cell.styles.textColor = [200, 60, 60];
            else if (v === "media") data.cell.styles.textColor = [180, 140, 0];
            else data.cell.styles.textColor = [30, 160, 100];
          }
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    }

    if (sprint.deliverables.filter((d) => d.title).length > 0) {
      if (y > PH - 30) { doc.addPage(); y = M; }
      setColor([80, 80, 100] as [number,number,number]);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Entregables del sprint:", M, y + 4);
      y += 8;
      for (const del of sprint.deliverables.filter((d) => d.title)) {
        setColor(GRAY);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.text(`• ${del.title}${del.description ? `: ${del.description}` : ""}`, M + 3, y);
        y += 5;
      }
    }
    y += 8;
  }

  if (project.data.notes) {
    if (y > PH - 30) { doc.addPage(); y = M; }
    setColor([80, 80, 100] as [number,number,number]);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Notas y consideraciones:", M, y);
    y += 5;
    setColor(GRAY);
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(project.data.notes, CW);
    doc.text(noteLines, M, y);
  }

  const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    setColor([150, 150, 170] as [number,number,number]);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("CruzNegraDev LLC  ·  Victor Manuel Moreira", M, PH - 8);
    doc.text(`${i} / ${totalPages}`, PW - M, PH - 8, { align: "right" });
    doc.setDrawColor(50, 50, 80);
    doc.setLineWidth(0.3);
    doc.line(M, PH - 12, PW - M, PH - 12);
  }

  const name = `SprintPlan_${project.project_name.replace(/\s+/g, "_") || "draft"}.pdf`;
  doc.save(name);
}

// ─── Story Row (view mode — Jira backlog style) ──────────────────────────────

function StoryRowView({ story, onUpdate }: { story: UserStory; onUpdate: (s: UserStory) => void }) {
  const [expanded, setExpanded] = useState(false);
  const criteria = story.acceptance_criteria.filter(Boolean);

  return (
    <div className={`transition-colors ${story.status === "completada" ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.03] border-b border-white/[0.04]">
        <StatusDot status={story.status} onClick={() => onUpdate({ ...story, status: nextStatus(story.status) })} />

        <p className={`flex-1 text-sm truncate ${story.status === "completada" ? "line-through text-text-muted" : "text-text-primary"}`}>
          {story.title || "(sin titulo)"}
        </p>

        {criteria.length > 0 && (
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-text-muted hover:text-text-secondary transition-colors">
            {criteria.length} AC
          </button>
        )}

        <PrioritySelect priority={story.priority} />
        <PointsSelect points={story.story_points} />
      </div>

      {expanded && criteria.length > 0 && (
        <div className="px-10 py-2 space-y-1 border-b border-white/[0.04]" style={{ background: "rgba(255,255,255,0.015)" }}>
          {criteria.map((c, i) => (
            <p key={i} className="text-xs text-text-muted flex items-start gap-2">
              <span className="text-emerald-400 mt-px">✓</span>{c}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Story Row (edit mode) ───────────────────────────────────────────────────

function StoryRowEdit({
  story, onUpdate, onDelete,
}: {
  story: UserStory;
  onUpdate: (s: UserStory) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg p-3 space-y-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex items-center gap-2">
        <input type="text" value={story.title}
          onChange={(e) => onUpdate({ ...story, title: e.target.value })}
          placeholder="Como [usuario] quiero [funcionalidad] para [beneficio]"
          className="input-premium flex-1 text-sm py-1.5" />
        <PointsSelect points={story.story_points} onChange={(v) => onUpdate({ ...story, story_points: v })} />
        <PrioritySelect priority={story.priority} onChange={(v) => onUpdate({ ...story, priority: v })} />
        <button onClick={onDelete} className="p-1.5 rounded text-text-muted hover:text-red-400 transition-colors">
          <IconTrash className="w-3.5 h-3.5" />
        </button>
      </div>
      <textarea value={story.description}
        onChange={(e) => onUpdate({ ...story, description: e.target.value })}
        placeholder="Descripcion tecnica..."
        rows={2} className="input-premium w-full text-xs resize-none py-1.5" />
      <div>
        <p className="text-xs text-text-muted mb-1.5 font-medium">Criterios de aceptacion</p>
        <div className="space-y-1">
          {story.acceptance_criteria.map((c, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-emerald-400 text-xs">✓</span>
              <input type="text" value={c}
                onChange={(e) => {
                  const updated = [...story.acceptance_criteria];
                  updated[i] = e.target.value;
                  onUpdate({ ...story, acceptance_criteria: updated });
                }}
                placeholder={`Criterio ${i + 1}...`}
                className="input-premium flex-1 text-xs py-1" />
              <button onClick={() => {
                const updated = story.acceptance_criteria.filter((_, j) => j !== i);
                onUpdate({ ...story, acceptance_criteria: updated.length ? updated : [""] });
              }} className="text-text-muted hover:text-red-400 transition-colors">
                <IconTrash className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => onUpdate({ ...story, acceptance_criteria: [...story.acceptance_criteria, ""] })}
            className="text-xs text-brand-mint/70 hover:text-brand-mint transition-colors flex items-center gap-1 mt-1">
            <IconPlus className="w-3 h-3" />Agregar criterio
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sprint Card ──────────────────────────────────────────────────────────────

function SprintCard({
  sprint, editMode, onUpdate, onDelete,
}: {
  sprint: Sprint;
  editMode: boolean;
  onUpdate: (s: Sprint) => void;
  onDelete: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const points = sprintPoints(sprint);
  const done = sprint.stories.filter((s) => s.status === "completada").length;
  const inProgress = sprint.stories.filter((s) => s.status === "en_progreso").length;
  const total = sprint.stories.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const updateStory = (id: string, story: UserStory) =>
    onUpdate({ ...sprint, stories: sprint.stories.map((s) => (s.id === id ? story : s)) });
  const deleteStory = (id: string) =>
    onUpdate({ ...sprint, stories: sprint.stories.filter((s) => s.id !== id) });
  const addStory = () =>
    onUpdate({ ...sprint, stories: [...sprint.stories, emptyStory()] });
  const updateDeliverable = (id: string, field: keyof SprintDeliverable, val: string) =>
    onUpdate({ ...sprint, deliverables: sprint.deliverables.map((d) => d.id === id ? { ...d, [field]: val } : d) });
  const deleteDeliverable = (id: string) =>
    onUpdate({ ...sprint, deliverables: sprint.deliverables.filter((d) => d.id !== id) });
  const addDeliverable = () =>
    onUpdate({ ...sprint, deliverables: [...sprint.deliverables, { id: uid(), title: "", description: "" }] });

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Sprint header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer bg-surface-card/50 hover:bg-surface-card/70 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <IconChevron open={!collapsed} />

        {editMode ? (
          <input type="text" value={sprint.name}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onUpdate({ ...sprint, name: e.target.value })}
            className="input-premium text-sm font-semibold py-1 flex-1" />
        ) : (
          <span className="text-sm font-semibold text-text-primary flex-1">{sprint.name}</span>
        )}

        <div className="flex items-center gap-3 shrink-0 text-xs">
          <span className="text-brand-mint font-medium">{points} pts</span>
          {done > 0 && <span className="text-emerald-400">{done} done</span>}
          {inProgress > 0 && <span className="text-amber-400">{inProgress} wip</span>}
          <span className="text-text-muted">{total} items</span>
        </div>

        <div className="w-20 shrink-0">
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden flex">
            <div className="h-full bg-emerald-400" style={{ width: `${progress}%` }} />
            <div className="h-full bg-amber-400/60" style={{ width: `${total ? Math.round((inProgress / total) * 100) : 0}%` }} />
          </div>
        </div>

        {editMode && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded text-text-muted hover:text-red-400 transition-colors">
            <IconTrash className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {!collapsed && (
        <div>
          {/* Goal */}
          {editMode ? (
            <div className="px-4 py-2 border-b border-white/[0.04]">
              <input type="text" value={sprint.goal}
                onChange={(e) => onUpdate({ ...sprint, goal: e.target.value })}
                placeholder="Objetivo del sprint..."
                className="input-premium w-full text-sm py-1.5" />
            </div>
          ) : sprint.goal && (
            <div className="px-4 py-2 text-sm text-text-muted border-b border-white/[0.04]" style={{ background: "rgba(255,255,255,0.015)" }}>
              {sprint.goal}
            </div>
          )}

          {/* Duration & dates (edit) */}
          {editMode && (
            <div className="grid grid-cols-3 gap-3 px-4 py-3 border-b border-white/[0.04]">
              <div>
                <label className="text-xs text-text-muted font-medium block mb-1">Duracion</label>
                <select value={sprint.duration_weeks}
                  onChange={(e) => onUpdate({ ...sprint, duration_weeks: Number(e.target.value) })}
                  className="input-premium w-full text-sm py-1.5">
                  {[1, 2, 3, 4].map((w) => <option key={w} value={w}>{w} semana{w > 1 ? "s" : ""}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted font-medium block mb-1">Inicio</label>
                <input type="date" value={sprint.start_date}
                  onChange={(e) => onUpdate({ ...sprint, start_date: e.target.value })}
                  className="input-premium w-full text-sm py-1.5" />
              </div>
              <div>
                <label className="text-xs text-text-muted font-medium block mb-1">Fin</label>
                <input type="date" value={sprint.end_date}
                  onChange={(e) => onUpdate({ ...sprint, end_date: e.target.value })}
                  className="input-premium w-full text-sm py-1.5" />
              </div>
            </div>
          )}

          {/* Stories header */}
          {!editMode && (
            <div className="flex items-center gap-3 px-3 py-1.5 text-[11px] text-text-muted uppercase tracking-wider font-medium border-b border-white/[0.04]" style={{ background: "rgba(255,255,255,0.015)" }}>
              <span className="w-4 shrink-0" />
              <span className="flex-1">Historia</span>
              <span>Prior.</span>
              <span className="w-6 text-right">Pts</span>
            </div>
          )}

          {/* Stories */}
          <div className={editMode ? "p-3 space-y-2" : ""}>
            {sprint.stories.map((story) => editMode ? (
              <StoryRowEdit key={story.id} story={story}
                onUpdate={(s) => updateStory(story.id, s)}
                onDelete={() => deleteStory(story.id)} />
            ) : (
              <StoryRowView key={story.id} story={story}
                onUpdate={(s) => updateStory(story.id, s)} />
            ))}
          </div>

          {editMode && (
            <div className="px-3 pb-3">
              <button onClick={addStory}
                className="w-full py-2 rounded-lg text-xs text-text-muted hover:text-brand-mint transition-colors flex items-center justify-center gap-1.5"
                style={{ border: "1px dashed rgba(255,255,255,0.08)" }}>
                <IconPlus className="w-3.5 h-3.5" />Agregar historia
              </button>
            </div>
          )}

          {/* Deliverables */}
          {(editMode || sprint.deliverables.some((d) => d.title)) && (
            <div className="px-4 py-3 border-t border-white/[0.04]">
              <p className="text-xs text-text-muted font-medium mb-2">Entregables</p>
              <div className="space-y-1.5">
                {sprint.deliverables.map((del) => (
                  editMode ? (
                    <div key={del.id} className="flex gap-2">
                      <input type="text" value={del.title}
                        onChange={(e) => updateDeliverable(del.id, "title", e.target.value)}
                        placeholder="Entregable" className="input-premium flex-1 text-sm py-1" />
                      <input type="text" value={del.description}
                        onChange={(e) => updateDeliverable(del.id, "description", e.target.value)}
                        placeholder="Descripcion" className="input-premium flex-1 text-sm py-1" />
                      <button onClick={() => deleteDeliverable(del.id)}
                        className="p-1 text-text-muted hover:text-red-400 transition-colors">
                        <IconTrash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : del.title ? (
                    <p key={del.id} className="text-sm text-text-secondary flex items-start gap-2">
                      <span className="text-brand-mint">→</span>
                      {del.title}{del.description && <span className="text-text-muted">— {del.description}</span>}
                    </p>
                  ) : null
                ))}
              </div>
              {editMode && (
                <button onClick={addDeliverable}
                  className="mt-2 text-xs text-text-muted hover:text-brand-mint transition-colors flex items-center gap-1">
                  <IconPlus className="w-3 h-3" />Agregar entregable
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Project Status Badge ────────────────────────────────────────────────────

function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const cfg: Record<ProjectStatus, { label: string; cls: string }> = {
    borrador: { label: "Borrador", cls: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20" },
    activo: { label: "Activo", cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
    completado: { label: "Completado", cls: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  };
  const c = cfg[status];
  return <span className={`px-2 py-0.5 rounded text-xs font-medium border ${c.cls}`}>{c.label}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScrumTab() {
  const { addToast } = useToast();

  const [projects, setProjects] = useState<ScrumSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [current, setCurrent] = useState<ScrumFull | null>(null);
  const [localData, setLocalData] = useState<ScrumData | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [generating, setGenerating] = useState(false);
  const [mode, setMode] = useState<"ai" | "manual">("ai");

  const loadList = useCallback(async () => {
    try { setProjects(await listScrum()); }
    catch { addToast("error", "Error al cargar proyectos"); }
    finally { setLoadingList(false); }
  }, [addToast]);

  useEffect(() => { loadList(); }, [loadList]);

  const openProject = async (id: string) => {
    setIsCreating(false);
    setEditMode(false);
    try {
      const data = await getScrum(id);
      setCurrent(data);
      setLocalData(data.data);
    } catch { addToast("error", "Error al cargar proyecto"); }
  };

  const handleGenerate = async () => {
    if (!newDesc.trim()) { addToast("error", "Describi el proyecto"); return; }
    setGenerating(true);
    try {
      const data = await generateScrum(newDesc);
      if (!newName.trim()) setNewName("Mi proyecto");
      setCurrent({ id: "", project_name: newName || "Mi proyecto", client_name: newClient, description: newDesc, data, status: "borrador", started_at: null, created_at: "", updated_at: "" });
      setLocalData(data);
      setEditMode(true);
      setIsCreating(false);
    } catch { addToast("error", "Error al generar el plan"); }
    finally { setGenerating(false); }
  };

  const handleStartManual = () => {
    const data = emptyProject();
    setCurrent({ id: "", project_name: newName || "Mi proyecto", client_name: newClient, description: newDesc, data, status: "borrador", started_at: null, created_at: "", updated_at: "" });
    setLocalData(data);
    setEditMode(true);
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!localData) return;
    setSaving(true);
    try {
      const saved = await saveScrum(current?.project_name || newName, current?.client_name || newClient, current?.description || newDesc, localData, current?.id || undefined);
      addToast("success", "Proyecto guardado");
      await loadList();
      setCurrent(saved);
      setLocalData(saved.data);
      setEditMode(false);
    } catch { addToast("error", "Error al guardar"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteScrum(id);
      addToast("success", "Proyecto eliminado");
      setProjects((p) => p.filter((x) => x.id !== id));
      if (current?.id === id) { setCurrent(null); setLocalData(null); }
    } catch { addToast("error", "Error al eliminar"); }
  };

  const handleSetStatus = async (status: ProjectStatus) => {
    if (!current?.id) return;
    try {
      const updated = await updateScrumStatus(current.id, status);
      setCurrent(updated);
      setProjects((p) => p.map((x) => x.id === updated.id ? { ...x, status: updated.status } : x));
      addToast("success", status === "activo" ? "Proyecto activado" : status === "completado" ? "Proyecto completado" : "Vuelto a borrador");
    } catch { addToast("error", "Error al cambiar estado"); }
  };

  const handleExportPDF = async () => {
    if (!current || !localData) return;
    setExporting(true);
    try { await exportToPDF({ ...current, data: localData }); }
    catch (e) { addToast("error", "Error al exportar PDF"); console.error(e); }
    finally { setExporting(false); }
  };

  const deleteSprint = (id: string) => {
    if (!localData) return;
    setLocalData({ ...localData, sprints: localData.sprints.filter((s) => s.id !== id) });
  };

  const addSprint = () => {
    if (!localData) return;
    const num = (localData.sprints[localData.sprints.length - 1]?.number ?? 0) + 1;
    setLocalData({ ...localData, sprints: [...localData.sprints, emptySprint(num)] });
  };

  const totalPoints = localData?.sprints.reduce((t, s) => t + sprintPoints(s), 0) ?? 0;
  const totalDone = localData?.sprints.reduce((t, s) => t + s.stories.filter((x) => x.status === "completada").length, 0) ?? 0;
  const totalStories = localData?.sprints.reduce((t, s) => t + s.stories.length, 0) ?? 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary tracking-tight">Planificacion</h2>
          <p className="text-sm text-text-muted mt-0.5">Sprints con IA o manuales</p>
        </div>
        <button onClick={() => { setIsCreating(true); setCurrent(null); setLocalData(null); setEditMode(false); setNewName(""); setNewClient(""); setNewDesc(""); setMode("ai"); }}
          className="btn-primary flex items-center gap-2 text-sm">
          <IconPlus className="w-4 h-4" />Nuevo proyecto
        </button>
      </div>

      <div className="grid grid-cols-[240px_1fr] gap-5">
        {/* Project list sidebar */}
        <div className="space-y-1">
          <p className="text-xs text-text-muted font-medium uppercase tracking-wider mb-2 px-1">Proyectos</p>
          {loadingList ? (
            <div className="flex justify-center py-8"><IconLoader className="w-5 h-5 text-text-muted" /></div>
          ) : projects.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">Sin proyectos</p>
          ) : projects.map((p) => (
            <div key={p.id} onClick={() => openProject(p.id)}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                current?.id === p.id ? "bg-brand-mint/10 text-brand-mint" : "hover:bg-white/[0.04] text-text-primary"
              }`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.project_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {p.client_name && <span className="text-xs text-text-muted truncate">{p.client_name}</span>}
                  <ProjectStatusBadge status={p.status} />
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                className="p-1 rounded text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                <IconTrash className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Main area */}
        <div className="min-w-0">
          {/* New project form */}
          {isCreating && (
            <div className="rounded-lg p-5 space-y-4" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2">
                <IconSparkles className="w-5 h-5 text-brand-mint" />
                <h3 className="text-base font-semibold text-text-primary">Nuevo plan de sprints</h3>
              </div>

              {/* Mode toggle */}
              <div className="flex gap-1 p-0.5 rounded-lg w-fit" style={{ background: "rgba(255,255,255,0.04)" }}>
                {(["ai", "manual"] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                      mode === m ? "bg-brand-mint text-surface-black shadow-sm" : "text-text-muted hover:text-text-primary"
                    }`}>
                    {m === "ai" ? "Generar con IA" : "Manual"}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-text-muted font-medium block mb-1">Proyecto</label>
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                    placeholder="App de delivery, ERP..." className="input-premium w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs text-text-muted font-medium block mb-1">Cliente</label>
                  <input type="text" value={newClient} onChange={(e) => setNewClient(e.target.value)}
                    placeholder="Opcional" className="input-premium w-full text-sm" />
                </div>
              </div>

              {mode === "ai" && (
                <>
                  <div>
                    <label className="text-xs text-text-muted font-medium block mb-1">Descripcion del proyecto</label>
                    <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={4}
                      placeholder="Funcionalidades, tecnologias, equipo, restricciones..."
                      className="input-premium w-full text-sm resize-none" />
                  </div>
                  <button onClick={handleGenerate} disabled={generating || !newDesc.trim()}
                    className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
                    {generating ? <><IconLoader className="w-4 h-4" />Generando...</> : <><IconSparkles className="w-4 h-4" />Generar sprints</>}
                  </button>
                </>
              )}

              {mode === "manual" && (
                <button onClick={handleStartManual} className="btn-primary flex items-center gap-2 text-sm">
                  <IconEdit className="w-4 h-4" />Crear en blanco
                </button>
              )}
            </div>
          )}

          {/* Project view */}
          {localData && !isCreating && (
            <div className="space-y-4">
              {/* Project header bar */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  {editMode ? (
                    <input type="text" value={current?.project_name ?? newName}
                      onChange={(e) => setCurrent((c) => c ? { ...c, project_name: e.target.value } : c)}
                      className="input-premium text-lg font-semibold py-1 w-64" />
                  ) : (
                    <h3 className="text-lg font-semibold text-text-primary">{current?.project_name}</h3>
                  )}
                  {current?.status && <ProjectStatusBadge status={current.status} />}
                  {current?.client_name && !editMode && (
                    <span className="text-sm text-text-muted">{current.client_name}</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {current?.id && current.status === "borrador" && (
                    <button onClick={() => handleSetStatus("activo")}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-emerald-400 hover:bg-emerald-400/10"
                      style={{ border: "1px solid rgba(52,211,153,0.2)" }}>
                      Activar
                    </button>
                  )}
                  {current?.id && current.status === "activo" && (
                    <button onClick={() => handleSetStatus("completado")}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-blue-400 hover:bg-blue-400/10"
                      style={{ border: "1px solid rgba(96,165,250,0.2)" }}>
                      Completar
                    </button>
                  )}
                  {current?.id && current.status !== "borrador" && (
                    <button onClick={() => handleSetStatus("borrador")}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-text-muted hover:text-text-primary"
                      style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                      Borrador
                    </button>
                  )}
                  <button onClick={() => setEditMode(!editMode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      editMode ? "text-brand-mint bg-brand-mint/10" : "text-text-muted hover:text-text-primary"
                    }`} style={{ border: `1px solid ${editMode ? "rgba(74,234,170,0.2)" : "rgba(255,255,255,0.06)"}` }}>
                    <IconEdit className="w-3.5 h-3.5" />{editMode ? "Vista" : "Editar"}
                  </button>
                  {editMode && (
                    <button onClick={handleSave} disabled={saving}
                      className="btn-primary flex items-center gap-1.5 text-xs">
                      {saving ? <IconLoader className="w-3.5 h-3.5" /> : <IconSave className="w-3.5 h-3.5" />}
                      Guardar
                    </button>
                  )}
                  <button onClick={handleExportPDF} disabled={exporting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-red-400 hover:bg-red-400/10 disabled:opacity-50"
                    style={{ border: "1px solid rgba(248,113,113,0.2)" }}>
                    {exporting ? <IconLoader className="w-3.5 h-3.5" /> : <IconPDF className="w-3.5 h-3.5" />}
                    PDF
                  </button>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-6 px-1 text-sm">
                <div><span className="font-semibold text-text-primary">{localData.sprints.length}</span> <span className="text-text-muted">sprints</span></div>
                <div><span className="font-semibold text-brand-mint">{totalPoints}</span> <span className="text-text-muted">pts</span></div>
                <div><span className="font-semibold text-text-primary">{totalStories}</span> <span className="text-text-muted">historias</span></div>
                <div><span className="font-semibold text-emerald-400">{totalDone}</span><span className="text-text-muted">/{totalStories} completadas</span></div>
                {localData.recommended_velocity > 0 && (
                  <div className="text-text-muted">vel: <span className="text-text-secondary">{localData.recommended_velocity} pts/sprint</span></div>
                )}
              </div>

              {/* Summary */}
              {editMode ? (
                <div className="rounded-lg p-4 space-y-3" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                  <textarea value={localData.summary}
                    onChange={(e) => setLocalData({ ...localData, summary: e.target.value })}
                    rows={2} className="input-premium w-full text-sm resize-none"
                    placeholder="Resumen ejecutivo..." />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-text-muted font-medium block mb-1">Velocidad (pts/sprint)</label>
                      <input type="number" value={localData.recommended_velocity}
                        onChange={(e) => setLocalData({ ...localData, recommended_velocity: Number(e.target.value) })}
                        className="input-premium w-full text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted font-medium block mb-1">Notas</label>
                      <input type="text" value={localData.notes ?? ""}
                        onChange={(e) => setLocalData({ ...localData, notes: e.target.value })}
                        placeholder="Riesgos, dependencias..."
                        className="input-premium w-full text-sm" />
                    </div>
                  </div>
                </div>
              ) : localData.summary && (
                <div className="text-sm text-text-secondary px-1 leading-relaxed">
                  {localData.summary}
                  {localData.notes && <span className="text-text-muted ml-2">· {localData.notes}</span>}
                </div>
              )}

              {/* Sprints */}
              <div className="space-y-3">
                {localData.sprints.map((sprint) => (
                  <SprintCard key={sprint.id} sprint={sprint} editMode={editMode}
                    onUpdate={(s) => {
                      const updated = { ...localData, sprints: localData.sprints.map((x) => x.id === s.id ? s : x) };
                      updated.total_estimated_points = updated.sprints.reduce((t, sp) => t + sprintPoints(sp), 0);
                      setLocalData(updated);
                    }}
                    onDelete={() => deleteSprint(sprint.id)} />
                ))}
                {editMode && (
                  <button onClick={addSprint}
                    className="w-full py-2.5 rounded-lg text-sm text-text-muted hover:text-brand-mint transition-colors flex items-center justify-center gap-2"
                    style={{ border: "1px dashed rgba(255,255,255,0.08)" }}>
                    <IconPlus className="w-4 h-4" />Agregar sprint
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isCreating && !localData && (
            <div className="rounded-lg p-12 text-center" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-text-muted mb-3"><IconSparkles className="w-8 h-8 mx-auto" /></div>
              <h3 className="text-sm font-medium text-text-primary">Sin proyecto seleccionado</h3>
              <p className="text-sm text-text-muted mt-1">Selecciona un proyecto o crea uno nuevo.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
