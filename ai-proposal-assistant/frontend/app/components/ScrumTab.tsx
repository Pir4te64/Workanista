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
  <svg className={`${className} transition-transform ${open ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9,18 15,12 9,6" />
  </svg>
);
const IconEdit = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status, onClick }: { status: StoryStatus; onClick?: () => void }) {
  const styles = {
    pendiente: "text-text-muted bg-white/4 border-white/8 hover:border-white/16",
    en_progreso: "text-blue-400 bg-blue-400/10 border-blue-400/20 hover:bg-blue-400/20",
    completada: "text-brand-mint bg-brand-mint/10 border-brand-mint/20 hover:bg-brand-mint/20",
  };
  const labels = { pendiente: "Pendiente", en_progreso: "En progreso", completada: "Completada" };
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all duration-200 ${styles[status]}`}>
      {labels[status]}
    </button>
  );
}

function PriorityBadge({ priority, onChange }: { priority: StoryPriority; onChange?: (v: StoryPriority) => void }) {
  const styles = { alta: "text-red-400 bg-red-400/10 border-red-400/20", media: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", baja: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" };
  if (!onChange) return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${styles[priority]}`}>
      {priority}
    </span>
  );
  return (
    <select
      value={priority}
      onChange={(e) => onChange(e.target.value as StoryPriority)}
      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border bg-transparent cursor-pointer ${styles[priority]}`}
    >
      <option value="alta">Alta</option>
      <option value="media">Media</option>
      <option value="baja">Baja</option>
    </select>
  );
}

function PointsBadge({ points, onChange }: { points: number; onChange?: (v: number) => void }) {
  const color = points <= 3 ? "text-emerald-400" : points <= 8 ? "text-yellow-400" : "text-red-400";
  if (!onChange) return (
    <span className={`text-xs font-bold tabular-nums ${color}`}>{points}pt</span>
  );
  return (
    <select
      value={points}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`text-xs font-bold border-0 bg-transparent cursor-pointer rounded px-1 ${color}`}
      style={{ background: "rgba(255,255,255,0.04)" }}
    >
      {FIBONACCI.map((f) => <option key={f} value={f}>{f}pt</option>)}
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

  // ── Cover header ──
  setFill(DARK_BG);
  doc.rect(0, 0, PW, 52, "F");

  // Logo text
  setColor(MINT);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("CruzNegraDev LLC", M, y + 6);

  // Title
  setColor(WHITE);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("SPRINT PLANNING", PW - M, y + 6, { align: "right" });

  y += 16;
  setColor(LIGHT);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(project.project_name, M, y);

  y += 7;
  setColor([170, 170, 200] as [number,number,number]);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const meta: string[] = [];
  if (project.client_name) meta.push(`Cliente: ${project.client_name}`);
  meta.push(`Generado: ${new Date().toLocaleDateString("es-AR")}`);
  doc.text(meta.join("   ·   "), M, y);

  y = 60;

  // ── Summary ──
  if (project.data.summary) {
    setColor(BLACK);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(project.data.summary, CW);
    doc.text(lines, M, y);
    y += lines.length * 5 + 4;
  }

  // ── Global stats ──
  const totalSprints = project.data.sprints.length;
  const totalPoints = project.data.sprints.reduce((s, sp) => s + sprintPoints(sp), 0);
  const totalStories = project.data.sprints.reduce((s, sp) => s + sp.stories.length, 0);
  const velocity = project.data.recommended_velocity;

  autoTable(doc, {
    startY: y,
    head: [["Sprints", "Total Story Points", "User Stories", "Velocidad recomendada"]],
    body: [[
      `${totalSprints} sprints`,
      `${totalPoints} puntos`,
      `${totalStories} historias`,
      `${velocity} pts/sprint`,
    ]],
    margin: { left: M, right: M },
    headStyles: { fillColor: [0, 200, 130], textColor: [15, 15, 30], fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 9, textColor: BLACK, halign: "center" },
    columnStyles: { 0: { halign: "center" }, 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" } },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // ── Sprints ──
  for (const sprint of project.data.sprints) {
    const points = sprintPoints(sprint);
    const completedStories = sprint.stories.filter((s) => s.status === "completada").length;

    // Check page space
    if (y > PH - 60) {
      doc.addPage();
      y = M;
    }

    // Sprint header bar
    setFill(DARK_BG);
    doc.roundedRect(M, y, CW, 18, 2, 2, "F");

    setColor(MINT);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Sprint ${sprint.number}: ${sprint.name}`, M + 4, y + 7);

    setColor([170, 170, 200] as [number,number,number]);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`${points} pts  ·  ${sprint.stories.length} historias  ·  ${sprint.duration_weeks} semanas  ·  ${completedStories}/${sprint.stories.length} completadas`, PW - M - 4, y + 7, { align: "right" });

    // Goal
    if (sprint.goal) {
      setColor(GRAY);
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      const goalLines = doc.splitTextToSize(`Objetivo: ${sprint.goal}`, CW - 8);
      doc.text(goalLines, M + 4, y + 14);
      y += goalLines.length * 4;
    }

    y += 22;

    // Stories table
    if (sprint.stories.length > 0) {
      const rows = sprint.stories.map((story, i) => {
        const pts = story.story_points;
        const statusLabel = story.status === "completada" ? "✓ Completada" : story.status === "en_progreso" ? "► En progreso" : "○ Pendiente";
        return [
          `${i + 1}`,
          story.title || "(sin título)",
          story.acceptance_criteria.filter(Boolean).join("\n") || "—",
          `${pts}pt`,
          story.priority.toUpperCase(),
          statusLabel,
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [["#", "Historia de usuario", "Criterios de aceptación", "Pts", "Prior.", "Estado"]],
        body: rows,
        margin: { left: M, right: M },
        headStyles: { fillColor: [40, 40, 70], textColor: WHITE, fontStyle: "bold", fontSize: 7.5 },
        bodyStyles: { fontSize: 7.5, textColor: BLACK, valign: "top" },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 62 },
          2: { cellWidth: 58 },
          3: { cellWidth: 12, halign: "center" },
          4: { cellWidth: 14, halign: "center" },
          5: { cellWidth: 26, halign: "center" },
        },
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

    // Deliverables
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

  // ── Notes ──
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

  // ── Footer on all pages ──
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

// ─── Story Row (edit mode) ────────────────────────────────────────────────────

function StoryRow({
  story, onUpdate, onDelete, editMode,
}: {
  story: UserStory;
  onUpdate: (s: UserStory) => void;
  onDelete: () => void;
  editMode: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!editMode) {
    return (
      <div className={`glass-card p-3 transition-all duration-200 ${story.status === "completada" ? "opacity-60" : ""}`}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium leading-snug ${story.status === "completada" ? "line-through text-text-muted" : "text-text-primary"}`}>
              {story.title || "(sin título)"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PointsBadge points={story.story_points} />
            <PriorityBadge priority={story.priority} />
            <StatusBadge status={story.status} onClick={() => onUpdate({ ...story, status: nextStatus(story.status) })} />
          </div>
        </div>
        {story.acceptance_criteria.filter(Boolean).length > 0 && (
          <button onClick={() => setOpen(!open)} className="mt-2 text-[10px] text-text-muted hover:text-brand-mint transition-colors flex items-center gap-1">
            <IconChevron open={open} className="w-3 h-3" />
            {story.acceptance_criteria.filter(Boolean).length} criterios de aceptación
          </button>
        )}
        {open && (
          <ul className="mt-2 space-y-1">
            {story.acceptance_criteria.filter(Boolean).map((c, i) => (
              <li key={i} className="text-xs text-text-muted flex items-start gap-2">
                <span className="text-brand-mint mt-0.5">✓</span>{c}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={story.title}
          onChange={(e) => onUpdate({ ...story, title: e.target.value })}
          placeholder="Como [usuario] quiero [funcionalidad] para [beneficio]"
          className="input-premium flex-1 text-sm py-1.5"
        />
        <PointsBadge points={story.story_points} onChange={(v) => onUpdate({ ...story, story_points: v })} />
        <PriorityBadge priority={story.priority} onChange={(v) => onUpdate({ ...story, priority: v })} />
        <button onClick={onDelete} className="p-1.5 rounded text-text-muted hover:text-red-400 transition-colors">
          <IconTrash className="w-3.5 h-3.5" />
        </button>
      </div>
      <textarea
        value={story.description}
        onChange={(e) => onUpdate({ ...story, description: e.target.value })}
        placeholder="Descripción técnica..."
        rows={2}
        className="input-premium w-full text-xs resize-none py-1.5"
      />
      <div>
        <p className="text-[10px] text-text-muted mb-1.5">Criterios de aceptación</p>
        <div className="space-y-1.5">
          {story.acceptance_criteria.map((c, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-brand-mint text-xs">✓</span>
              <input
                type="text"
                value={c}
                onChange={(e) => {
                  const updated = [...story.acceptance_criteria];
                  updated[i] = e.target.value;
                  onUpdate({ ...story, acceptance_criteria: updated });
                }}
                placeholder={`Criterio ${i + 1}...`}
                className="input-premium flex-1 text-xs py-1"
              />
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
            className="text-[10px] text-brand-mint/70 hover:text-brand-mint transition-colors flex items-center gap-1"
          >
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
  const progress = sprint.stories.length > 0 ? Math.round((done / sprint.stories.length) * 100) : 0;

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
    <div className="glass-card overflow-hidden">
      {/* Sprint header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        style={{ borderBottom: collapsed ? "none" : "1px solid rgba(255,255,255,0.05)" }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-brand-mint shrink-0"
          style={{ background: "rgba(0,245,160,0.1)", border: "1px solid rgba(0,245,160,0.2)" }}>
          {sprint.number}
        </div>
        <div className="flex-1 min-w-0">
          {editMode ? (
            <input
              type="text"
              value={sprint.name}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onUpdate({ ...sprint, name: e.target.value })}
              className="input-premium text-sm font-semibold py-0.5 w-full"
            />
          ) : (
            <p className="text-sm font-semibold text-text-primary truncate">{sprint.name}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-brand-mint">{points} pts</p>
            <p className="text-[10px] text-text-muted">{sprint.duration_weeks} sem · {sprint.stories.length} historias</p>
          </div>
          <div className="w-16">
            <div className="h-1 bg-white/6 rounded-full overflow-hidden">
              <div className="h-full bg-brand-mint rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[9px] text-text-muted text-center mt-0.5">{progress}%</p>
          </div>
          {editMode && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 rounded text-text-muted hover:text-red-400 transition-colors">
              <IconTrash className="w-3.5 h-3.5" />
            </button>
          )}
          <IconChevron open={!collapsed} />
        </div>
      </div>

      {!collapsed && (
        <div className="p-4 space-y-4">
          {/* Goal */}
          <div>
            <p className="section-title mb-1.5">Objetivo del sprint</p>
            {editMode ? (
              <input type="text" value={sprint.goal}
                onChange={(e) => onUpdate({ ...sprint, goal: e.target.value })}
                placeholder="¿Qué quedará funcionando al terminar este sprint?"
                className="input-premium w-full text-sm" />
            ) : (
              <p className="text-sm text-text-secondary leading-relaxed">{sprint.goal || <span className="text-text-muted italic">Sin objetivo definido</span>}</p>
            )}
          </div>

          {/* Duration & dates */}
          {editMode && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="section-title mb-1.5">Duración (semanas)</p>
                <select value={sprint.duration_weeks}
                  onChange={(e) => onUpdate({ ...sprint, duration_weeks: Number(e.target.value) })}
                  className="input-premium w-full text-sm">
                  {[1, 2, 3, 4].map((w) => <option key={w} value={w}>{w} semana{w > 1 ? "s" : ""}</option>)}
                </select>
              </div>
              <div>
                <p className="section-title mb-1.5">Inicio</p>
                <input type="date" value={sprint.start_date}
                  onChange={(e) => onUpdate({ ...sprint, start_date: e.target.value })}
                  className="input-premium w-full text-sm" />
              </div>
              <div>
                <p className="section-title mb-1.5">Fin</p>
                <input type="date" value={sprint.end_date}
                  onChange={(e) => onUpdate({ ...sprint, end_date: e.target.value })}
                  className="input-premium w-full text-sm" />
              </div>
            </div>
          )}

          {/* User stories */}
          <div>
            <p className="section-title mb-2">User Stories ({sprint.stories.length})</p>
            <div className="space-y-2">
              {sprint.stories.map((story) => (
                <StoryRow key={story.id} story={story} editMode={editMode}
                  onUpdate={(s) => updateStory(story.id, s)}
                  onDelete={() => deleteStory(story.id)} />
              ))}
            </div>
            {editMode && (
              <button onClick={addStory}
                className="mt-2 w-full py-2 rounded-lg text-xs text-brand-mint/70 hover:text-brand-mint transition-colors flex items-center justify-center gap-1.5"
                style={{ border: "1px dashed rgba(0,245,160,0.2)" }}>
                <IconPlus className="w-3.5 h-3.5" />Agregar historia
              </button>
            )}
          </div>

          {/* Deliverables */}
          <div>
            <p className="section-title mb-2">Entregables</p>
            <div className="space-y-2">
              {sprint.deliverables.map((del) => (
                editMode ? (
                  <div key={del.id} className="flex gap-2">
                    <input type="text" value={del.title}
                      onChange={(e) => updateDeliverable(del.id, "title", e.target.value)}
                      placeholder="Nombre del entregable"
                      className="input-premium flex-1 text-sm py-1.5" />
                    <input type="text" value={del.description}
                      onChange={(e) => updateDeliverable(del.id, "description", e.target.value)}
                      placeholder="Descripción (opcional)"
                      className="input-premium flex-1 text-sm py-1.5" />
                    <button onClick={() => deleteDeliverable(del.id)}
                      className="p-1.5 text-text-muted hover:text-red-400 transition-colors">
                      <IconTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : del.title ? (
                  <div key={del.id} className="flex items-start gap-2">
                    <span className="text-brand-mint text-xs mt-0.5">→</span>
                    <div>
                      <p className="text-xs font-medium text-text-primary">{del.title}</p>
                      {del.description && <p className="text-xs text-text-muted">{del.description}</p>}
                    </div>
                  </div>
                ) : null
              ))}
            </div>
            {editMode && (
              <button onClick={addDeliverable}
                className="mt-2 w-full py-2 rounded-lg text-xs text-brand-mint/70 hover:text-brand-mint transition-colors flex items-center justify-center gap-1.5"
                style={{ border: "1px dashed rgba(0,245,160,0.2)" }}>
                <IconPlus className="w-3.5 h-3.5" />Agregar entregable
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
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

  // New project form
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
    if (!newDesc.trim()) { addToast("error", "Describí el proyecto"); return; }
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
      const saved = await saveScrum(
        current?.project_name || newName,
        current?.client_name || newClient,
        current?.description || newDesc,
        localData,
        current?.id || undefined,
      );
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
      addToast("success", status === "activo" ? "Proyecto activado — ya aparece en Seguimiento" : status === "completado" ? "Proyecto completado" : "Proyecto vuelto a borrador");
    } catch { addToast("error", "Error al cambiar estado"); }
  };

  const handleExportPDF = async () => {
    if (!current || !localData) return;
    setExporting(true);
    try {
      await exportToPDF({ ...current, data: localData });
    } catch (e) {
      addToast("error", "Error al exportar PDF");
      console.error(e);
    } finally { setExporting(false); }
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

  // Summary stats
  const totalPoints = localData?.sprints.reduce((t, s) => t + sprintPoints(s), 0) ?? 0;
  const totalDone = localData?.sprints.reduce((t, s) => t + s.stories.filter((x) => x.status === "completada").length, 0) ?? 0;
  const totalStories = localData?.sprints.reduce((t, s) => t + s.stories.length, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary tracking-tight">Sprints Scrum</h2>
          <p className="text-sm text-text-muted mt-1">Planificá sprints con IA o manualmente y exportá a PDF</p>
        </div>
        <button onClick={() => { setIsCreating(true); setCurrent(null); setLocalData(null); setEditMode(false); setNewName(""); setNewClient(""); setNewDesc(""); setMode("ai"); }}
          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          <IconPlus className="w-4 h-4" />Nuevo proyecto
        </button>
      </div>

      <div className="grid grid-cols-[260px_1fr] gap-6">
        {/* Sidebar */}
        <div className="space-y-2">
          <p className="section-title mb-3">Proyectos guardados</p>
          {loadingList ? (
            <div className="flex justify-center py-8"><IconLoader className="w-5 h-5 text-text-muted" /></div>
          ) : projects.length === 0 ? (
            <div className="glass-card p-5 text-center"><p className="text-xs text-text-muted">No hay proyectos aun</p></div>
          ) : projects.map((p) => (
            <div key={p.id} onClick={() => openProject(p.id)}
              className={`glass-card-hover p-3.5 cursor-pointer group ${current?.id === p.id ? "border-brand-mint/25" : ""}`}
              style={current?.id === p.id ? { borderColor: "rgba(0,245,160,0.2)" } : {}}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{p.project_name}</p>
                  {p.client_name && <p className="text-[10px] text-text-muted truncate">{p.client_name}</p>}
                  <p className="text-[10px] text-text-muted mt-0.5">{formatDate(p.created_at)}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                  className="p-1 rounded text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                  <IconTrash className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Main area */}
        <div className="min-w-0">
          {/* New project form */}
          {isCreating && (
            <div className="space-y-4">
              <div className="glass-card p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <IconSparkles className="w-5 h-5 text-brand-mint" />
                  <h3 className="text-base font-semibold text-text-primary">Nuevo plan de sprints</h3>
                </div>

                {/* Mode toggle */}
                <div className="flex gap-2">
                  {(["ai", "manual"] as const).map((m) => (
                    <button key={m} onClick={() => setMode(m)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === m ? "bg-brand-mint text-surface-black" : "bg-white/4 text-text-muted hover:text-text-primary"}`}>
                      {m === "ai" ? "✦ Generar con IA" : "✎ Manual"}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="section-title block mb-1.5">Nombre del proyecto</label>
                    <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                      placeholder="App de delivery, ERP..." className="input-premium w-full text-sm" />
                  </div>
                  <div>
                    <label className="section-title block mb-1.5">Cliente (opcional)</label>
                    <input type="text" value={newClient} onChange={(e) => setNewClient(e.target.value)}
                      placeholder="Nombre del cliente" className="input-premium w-full text-sm" />
                  </div>
                </div>

                {mode === "ai" && (
                  <>
                    <div>
                      <label className="section-title block mb-1.5">Descripción del proyecto</label>
                      <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={5}
                        placeholder="Describí el proyecto: funcionalidades, tecnologías, equipo, restricciones, objetivos de negocio..."
                        className="input-premium w-full text-sm resize-none" />
                    </div>
                    <button onClick={handleGenerate} disabled={generating || !newDesc.trim()}
                      className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50">
                      {generating ? <><IconLoader className="w-4 h-4" />Generando sprints...</> : <><IconSparkles className="w-4 h-4" />Generar plan de sprints</>}
                    </button>
                  </>
                )}

                {mode === "manual" && (
                  <button onClick={handleStartManual}
                    className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm">
                    <IconEdit className="w-4 h-4" />Crear en blanco
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Project view */}
          {localData && !isCreating && (
            <div className="space-y-5">
              {/* Project header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {editMode ? (
                    <div className="space-y-2">
                      <input type="text" value={current?.project_name ?? newName}
                        onChange={(e) => setCurrent((c) => c ? { ...c, project_name: e.target.value } : c)}
                        className="input-premium text-lg font-semibold w-full" />
                      <input type="text" value={current?.client_name ?? newClient}
                        onChange={(e) => setCurrent((c) => c ? { ...c, client_name: e.target.value } : c)}
                        placeholder="Cliente..." className="input-premium text-sm w-full" />
                    </div>
                  ) : (
                    <>
                      <h3 className="text-lg font-semibold text-text-primary">{current?.project_name}</h3>
                      {current?.client_name && <p className="text-xs text-text-muted mt-0.5">{current.client_name}</p>}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {/* Status badge */}
                  {current?.status && (
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${
                      current.status === "activo" ? "text-brand-mint border-brand-mint/30 bg-brand-mint/10" :
                      current.status === "completado" ? "text-blue-400 border-blue-400/30 bg-blue-400/10" :
                      "text-text-muted border-white/10 bg-white/4"
                    }`}>
                      {current.status === "activo" ? "● Activo" : current.status === "completado" ? "✓ Completado" : "Borrador"}
                    </span>
                  )}
                  {/* Status action buttons */}
                  {current?.id && current.status === "borrador" && (
                    <button onClick={() => handleSetStatus("activo")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all text-brand-mint border-brand-mint/30 bg-brand-mint/8 hover:bg-brand-mint/15">
                      Activar proyecto
                    </button>
                  )}
                  {current?.id && current.status === "activo" && (
                    <button onClick={() => handleSetStatus("completado")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all text-blue-400 border-blue-400/30 bg-blue-400/8 hover:bg-blue-400/15">
                      Completar
                    </button>
                  )}
                  {current?.id && current.status !== "borrador" && (
                    <button onClick={() => handleSetStatus("borrador")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all text-text-muted border-white/10 bg-white/4 hover:text-text-primary">
                      Volver a borrador
                    </button>
                  )}
                  <button onClick={() => setEditMode(!editMode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${editMode ? "text-brand-mint border-brand-mint/30 bg-brand-mint/8" : "text-text-muted border-white/8 bg-white/4 hover:text-text-primary"}`}>
                    <IconEdit className="w-3.5 h-3.5" />{editMode ? "Vista" : "Editar"}
                  </button>
                  {editMode && (
                    <button onClick={handleSave} disabled={saving}
                      className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs">
                      {saving ? <IconLoader className="w-3.5 h-3.5" /> : <IconSave className="w-3.5 h-3.5" />}
                      Guardar
                    </button>
                  )}
                  <button onClick={handleExportPDF} disabled={exporting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all text-red-400 border-red-400/20 bg-red-400/5 hover:bg-red-400/12 disabled:opacity-50">
                    {exporting ? <IconLoader className="w-3.5 h-3.5" /> : <IconPDF className="w-3.5 h-3.5" />}
                    PDF
                  </button>
                </div>
              </div>

              {/* Stats bar */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Sprints", value: localData.sprints.length },
                  { label: "Story Points", value: `${totalPoints} pts` },
                  { label: "User Stories", value: totalStories },
                  { label: "Completadas", value: `${totalDone}/${totalStories}` },
                ].map(({ label, value }) => (
                  <div key={label} className="glass-card p-3 text-center">
                    <p className="text-lg font-semibold text-brand-mint">{value}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Summary */}
              {editMode ? (
                <div className="glass-card p-4 space-y-2">
                  <p className="section-title">Resumen del proyecto</p>
                  <textarea value={localData.summary}
                    onChange={(e) => setLocalData({ ...localData, summary: e.target.value })}
                    rows={3} className="input-premium w-full text-sm resize-none"
                    placeholder="Resumen ejecutivo..." />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="section-title mb-1">Velocidad recomendada (pts/sprint)</p>
                      <input type="number" value={localData.recommended_velocity}
                        onChange={(e) => setLocalData({ ...localData, recommended_velocity: Number(e.target.value) })}
                        className="input-premium w-full text-sm" />
                    </div>
                    <div>
                      <p className="section-title mb-1">Notas</p>
                      <input type="text" value={localData.notes ?? ""}
                        onChange={(e) => setLocalData({ ...localData, notes: e.target.value })}
                        placeholder="Notas, riesgos, dependencias..."
                        className="input-premium w-full text-sm" />
                    </div>
                  </div>
                </div>
              ) : localData.summary && (
                <div className="glass-card p-4">
                  <p className="text-sm text-text-secondary leading-relaxed">{localData.summary}</p>
                  {localData.notes && <p className="text-xs text-text-muted mt-2 italic">{localData.notes}</p>}
                </div>
              )}

              {/* Sprints */}
              <div className="space-y-3">
                <p className="section-title">Sprints ({localData.sprints.length})</p>
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
                    className="w-full py-3 rounded-xl text-sm text-brand-mint/70 hover:text-brand-mint transition-colors flex items-center justify-center gap-2"
                    style={{ border: "1px dashed rgba(0,245,160,0.2)" }}>
                    <IconPlus className="w-4 h-4" />Agregar sprint
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isCreating && !localData && (
            <div className="glass-card p-12 text-center">
              <div className="text-text-muted mb-4"><IconSparkles className="w-10 h-10 mx-auto" /></div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">Sin proyecto seleccionado</h3>
              <p className="text-xs text-text-muted">Seleccioná un proyecto de la lista o creá uno nuevo.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
