"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "./Toast";
import { saveBudget, listBudgets, getBudget, deleteBudget } from "@/lib/api";
import type { BudgetSummary } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BulletItem {
  id: string;
  text: string;
}

interface PhaseSection {
  id: string;
  title: string;
  bullets: BulletItem[];
}

interface Phase {
  id: string;
  name: string;
  subtitle: string;
  objective: string;
  sections: PhaseSection[];
}

interface BudgetItem {
  id: string;
  concept: string;
  hours: string;
  rate: string;
  subtotal: string;
}

interface Deliverable {
  id: string;
  text: string;
}

interface ProposalData {
  clientName: string;
  clientEmail: string;
  projectName: string;
  documentType: string;
  date: string;
  currency: string;
  phases: Phase[];
  deliverables: Deliverable[];
  budgetIntro: string;
  budgetItems: BudgetItem[];
  totalLabel: string;
  totalValue: string;
  costNote: string;
  paymentTerms: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const uid = () => crypto.randomUUID();

const emptyBullet = (): BulletItem => ({ id: uid(), text: "" });
const emptySection = (): PhaseSection => ({ id: uid(), title: "", bullets: [emptyBullet()] });
const emptyPhase = (): Phase => ({
  id: uid(),
  name: "",
  subtitle: "",
  objective: "",
  sections: [emptySection()],
});
const emptyBudgetItem = (): BudgetItem => ({ id: uid(), concept: "", hours: "", rate: "", subtotal: "" });
const emptyDeliverable = (): Deliverable => ({ id: uid(), text: "" });

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD ($)" },
  { value: "ARS", label: "ARS ($)" },
  { value: "EUR", label: "EUR (€)" },
];

function formatDateStr(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

async function loadLogoBase64(): Promise<string | null> {
  try {
    const resp = await fetch("/LogoCruznegra.svg");
    const svgText = await resp.text();
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const img = new Image();
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    return new Promise((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 600, 120);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch {
    return null;
  }
}

// ─── PDF Generation ──────────────────────────────────────────────────────────

async function generateProposalPDF(data: ProposalData, addToast: (type: "success" | "error" | "info", msg: string) => void) {
  const jsPDF = (await import("jspdf")).default;
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.getWidth(); // 210
  const PH = doc.internal.pageSize.getHeight(); // 297
  const M = 15; // margin
  const CW = PW - M * 2; // content width = 180
  const logoBase64 = await loadLogoBase64();

  // Colors (matching Python template)
  const BLACK = [10, 10, 10] as const;
  const DARK_GRAY = [26, 26, 26] as const;
  const MID_GRAY = [74, 74, 74] as const;
  const LIGHT_GRAY = [232, 232, 232] as const;
  const WHITE = [255, 255, 255] as const;
  const GRAY_888 = [136, 136, 136] as const;
  const GRAY_999 = [153, 153, 153] as const;
  const GRAY_BBB = [187, 187, 187] as const;
  const ROW_ALT = [244, 244, 244] as const;
  const GREEN = [26, 122, 26] as const;

  let y = 12; // current Y position

  // ─── Utility fns ───

  const setColor = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2]);
  const setFill = (c: readonly number[]) => doc.setFillColor(c[0], c[1], c[2]);

  function addPageFooter() {
    doc.setFontSize(7.5);
    setColor(GRAY_888);
    doc.setFont("helvetica", "normal");
    doc.text(
      "CruzNegraDev LLC · 1007 N Orange St, 4th Floor, STE 229, Wilmington, DE 19801 · admin@cruznegradev.com",
      PW / 2, PH - 10, { align: "center" }
    );
  }

  function addPageHeader() {
    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", M, 8, 52, 10);
    } else {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      setColor(BLACK);
      doc.text("CruzNegraDev", M, 14);
    }
  }

  function checkPage(needed: number) {
    if (y + needed > PH - 22) {
      addPageFooter();
      doc.addPage();
      y = 12;
      addPageHeader();
      y = 26;
    }
  }

  function drawHR(thickness = 0.5, color = LIGHT_GRAY) {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(thickness);
    doc.line(M, y, M + CW, y);
    y += 4;
  }

  // ─── Page 1: Header ───

  // White header with logo and subtle bottom border
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", M, 10, 52, 10);
  } else {
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    setColor(BLACK);
    doc.text("CruzNegraDev LLC", M, 22);
  }

  // Right side: contact
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  setColor(GRAY_888);
  doc.text("admin@cruznegradev.com", PW - M, 16, { align: "right" });
  doc.text("cruznegradev.com", PW - M, 22, { align: "right" });

  // Header bottom line
  doc.setDrawColor(LIGHT_GRAY[0], LIGHT_GRAY[1], LIGHT_GRAY[2]);
  doc.setLineWidth(0.6);
  doc.line(M, 28, M + CW, 28);

  y = 34;

  // ─── Meta info rows ───
  // Row 1: CLIENT | DOCUMENT TYPE
  doc.setFontSize(7.5);
  setColor(GRAY_999);
  doc.setFont("helvetica", "normal");
  doc.text("CLIENTE", M, y);
  doc.text("TIPO DE DOCUMENTO", M + 90, y);
  y += 4;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  setColor(BLACK);
  doc.text(data.clientName || "—", M, y);
  doc.text(data.documentType || "Propuesta Tecnica", M + 90, y);
  y += 5;

  // Row 2: PREPARED BY | DATE
  doc.setFontSize(7.5);
  setColor(GRAY_999);
  doc.setFont("helvetica", "normal");
  doc.text("ELABORADO POR", M, y);
  doc.text("FECHA", M + 90, y);
  y += 4;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  setColor(BLACK);
  doc.text("CruzNegraDev LLC", M, y);
  doc.text(formatDateStr(data.date) || "—", M + 90, y);
  y += 6;

  // Thick HR
  doc.setDrawColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.setLineWidth(0.8);
  doc.line(M, y, M + CW, y);
  y += 6;

  // ─── Phases ───
  for (const phase of data.phases) {
    if (!phase.name.trim()) continue;

    checkPage(30);

    // Phase header bar (dark)
    setFill(DARK_GRAY);
    doc.rect(M, y, CW, 14, "F");

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    setColor(WHITE);
    doc.text(phase.name, M + 14, y + 6);

    if (phase.subtitle) {
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      setColor(GRAY_BBB);
      const subLines = doc.splitTextToSize(phase.subtitle, CW - 28);
      doc.text(subLines[0] || "", M + 14, y + 11);
    }

    y += 18;

    // Objective
    if (phase.objective.trim()) {
      checkPage(16);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      setColor(BLACK);
      doc.text("Objetivo", M, y);
      y += 6;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      setColor(MID_GRAY);
      const objLines = doc.splitTextToSize(phase.objective, CW);
      doc.text(objLines, M, y);
      y += objLines.length * 4.5 + 4;
    }

    // Sections with bullets
    for (const section of phase.sections) {
      if (!section.title.trim()) continue;

      checkPage(12);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      setColor(BLACK);
      doc.text(section.title, M, y);
      y += 5;

      for (const bullet of section.bullets) {
        if (!bullet.text.trim()) continue;
        checkPage(8);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        setColor(MID_GRAY);
        const bulletLines = doc.splitTextToSize(bullet.text, CW - 10);
        doc.text("—", M + 4, y);
        doc.text(bulletLines, M + 10, y);
        y += bulletLines.length * 4.2 + 1.5;
      }
      y += 2;
    }
    y += 4;
  }

  // ─── Deliverables ───
  if (data.deliverables.some((d) => d.text.trim())) {
    checkPage(20);
    drawHR(0.5, LIGHT_GRAY);
    y += 2;

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    setColor(BLACK);
    doc.text("Entregables del Proyecto", M, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    setColor(MID_GRAY);
    doc.text("Al finalizar el proyecto, se entregara:", M, y);
    y += 5;

    for (const d of data.deliverables) {
      if (!d.text.trim()) continue;
      checkPage(8);
      const dLines = doc.splitTextToSize(d.text, CW - 10);
      doc.text("—", M + 4, y);
      doc.text(dLines, M + 10, y);
      y += dLines.length * 4.2 + 1.5;
    }
    y += 4;
  }

  // ─── Budget section ───
  if (data.budgetItems.some((b) => b.concept.trim())) {
    checkPage(40);

    doc.setDrawColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.setLineWidth(0.8);
    doc.line(M, y, M + CW, y);
    y += 6;

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    setColor(BLACK);
    doc.text("Presupuesto e Inversion", M, y);
    y += 6;

    if (data.budgetIntro.trim()) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      setColor(MID_GRAY);
      const introLines = doc.splitTextToSize(data.budgetIntro, CW);
      doc.text(introLines, M, y);
      y += introLines.length * 4.5 + 4;
    }

    // Budget table
    const colW = [70, 25, 38, 47];
    const tableHead = [["CONCEPTO", "HORAS", `TARIFA (${data.currency})`, "SUBTOTAL"]];
    const tableBody = data.budgetItems
      .filter((b) => b.concept.trim())
      .map((b) => [b.concept, b.hours, b.rate, b.subtotal]);

    autoTable(doc, {
      startY: y,
      head: tableHead,
      body: tableBody,
      margin: { left: M, right: M },
      styles: {
        fontSize: 9,
        cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
        lineColor: [...LIGHT_GRAY],
        lineWidth: 0.4,
        textColor: [...DARK_GRAY],
        font: "helvetica",
      },
      headStyles: {
        fillColor: [...BLACK],
        textColor: [...WHITE],
        fontSize: 9,
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: {
        fillColor: [...WHITE],
      },
      alternateRowStyles: {
        fillColor: [...ROW_ALT],
      },
      columnStyles: {
        0: { cellWidth: colW[0], halign: "left", fontStyle: "normal" },
        1: { cellWidth: colW[1], halign: "center" },
        2: { cellWidth: colW[2], halign: "center" },
        3: { cellWidth: colW[3], halign: "center" },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      didParseCell: (hookData: any) => {
        const lastRowIdx = tableBody.length - 1;
        if (hookData.section === "body" && hookData.column.index === 3) {
          const val = tableBody[hookData.row.index]?.[3] || "";
          if (val.toUpperCase().includes("GRATIS")) {
            hookData.cell.styles.textColor = [...GREEN];
            hookData.cell.styles.fontStyle = "bold";
          }
        }
        if (hookData.section === "body" && hookData.row.index === lastRowIdx && hookData.column.index === 0) {
          hookData.cell.styles.fontStyle = "bold";
        }
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

    // Total block
    if (data.totalValue.trim()) {
      checkPage(20);
      setFill(BLACK);
      doc.rect(M, y, CW, 16, "F");

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      setColor(WHITE);
      doc.text(data.totalLabel || "INVERSION TOTAL DEL PROYECTO", M + 14, y + 10);

      doc.setFontSize(14);
      doc.text(data.totalValue, PW - M - 14, y + 10, { align: "right" });
      y += 20;
    }

    // Cost note
    if (data.costNote.trim()) {
      checkPage(16);
      y += 2;
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      setColor(MID_GRAY);
      const noteLines = doc.splitTextToSize(data.costNote, CW);
      doc.text(noteLines, M, y);
      y += noteLines.length * 3.5 + 4;
    }
  }

  // ─── Payment terms ───
  if (data.paymentTerms.trim()) {
    checkPage(16);
    y += 2;
    drawHR(0.5, LIGHT_GRAY);

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    setColor(BLACK);
    doc.text("Condiciones de Pago", M, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    setColor(MID_GRAY);
    const payLines = doc.splitTextToSize(data.paymentTerms, CW);
    doc.text(payLines, M, y);
    y += payLines.length * 4.5 + 4;
  }

  // ─── Footer on all pages ───
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalPages = (doc as any).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).setPage(p);
    addPageFooter();
    if (p > 1) addPageHeader();
  }

  const fileName = `Propuesta_${data.projectName.replace(/\s+/g, "_") || "proyecto"}.pdf`;
  doc.save(fileName);
  addToast("success", "PDF generado correctamente");
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BudgetTab() {
  const { addToast } = useToast();
  const [generating, setGenerating] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const [data, setData] = useState<ProposalData>({
    clientName: "",
    clientEmail: "",
    projectName: "",
    documentType: "Hoja de Ruta del Proyecto",
    date: today,
    currency: "USD",
    phases: [emptyPhase()],
    deliverables: [emptyDeliverable()],
    budgetIntro: "El proyecto se ha cotizado en base a un esquema de dedicacion exclusiva mensual de 160 horas por mes.",
    budgetItems: [emptyBudgetItem()],
    totalLabel: "INVERSION TOTAL DEL PROYECTO",
    totalValue: "",
    costNote: "",
    paymentTerms: "50% al inicio del proyecto, 50% al finalizar.",
  });

  // ─── Updaters ───

  const updateField = <K extends keyof ProposalData>(key: K, val: ProposalData[K]) =>
    setData((p) => ({ ...p, [key]: val }));

  const updatePhase = (phaseId: string, field: keyof Phase, val: string) =>
    setData((p) => ({
      ...p,
      phases: p.phases.map((ph) => (ph.id === phaseId ? { ...ph, [field]: val } : ph)),
    }));

  const addPhase = () => setData((p) => ({ ...p, phases: [...p.phases, emptyPhase()] }));
  const removePhase = (id: string) => {
    if (data.phases.length <= 1) return;
    setData((p) => ({ ...p, phases: p.phases.filter((ph) => ph.id !== id) }));
  };

  const addSection = (phaseId: string) =>
    setData((p) => ({
      ...p,
      phases: p.phases.map((ph) =>
        ph.id === phaseId ? { ...ph, sections: [...ph.sections, emptySection()] } : ph
      ),
    }));

  const updateSection = (phaseId: string, secId: string, val: string) =>
    setData((p) => ({
      ...p,
      phases: p.phases.map((ph) =>
        ph.id === phaseId
          ? { ...ph, sections: ph.sections.map((s) => (s.id === secId ? { ...s, title: val } : s)) }
          : ph
      ),
    }));

  const removeSection = (phaseId: string, secId: string) =>
    setData((p) => ({
      ...p,
      phases: p.phases.map((ph) =>
        ph.id === phaseId ? { ...ph, sections: ph.sections.filter((s) => s.id !== secId) } : ph
      ),
    }));

  const addBullet = (phaseId: string, secId: string) =>
    setData((p) => ({
      ...p,
      phases: p.phases.map((ph) =>
        ph.id === phaseId
          ? {
              ...ph,
              sections: ph.sections.map((s) =>
                s.id === secId ? { ...s, bullets: [...s.bullets, emptyBullet()] } : s
              ),
            }
          : ph
      ),
    }));

  const updateBullet = (phaseId: string, secId: string, bulletId: string, val: string) =>
    setData((p) => ({
      ...p,
      phases: p.phases.map((ph) =>
        ph.id === phaseId
          ? {
              ...ph,
              sections: ph.sections.map((s) =>
                s.id === secId
                  ? { ...s, bullets: s.bullets.map((b) => (b.id === bulletId ? { ...b, text: val } : b)) }
                  : s
              ),
            }
          : ph
      ),
    }));

  const removeBullet = (phaseId: string, secId: string, bulletId: string) =>
    setData((p) => ({
      ...p,
      phases: p.phases.map((ph) =>
        ph.id === phaseId
          ? {
              ...ph,
              sections: ph.sections.map((s) =>
                s.id === secId ? { ...s, bullets: s.bullets.filter((b) => b.id !== bulletId) } : s
              ),
            }
          : ph
      ),
    }));

  // Budget items
  const updateBudgetItem = (id: string, field: keyof BudgetItem, val: string) =>
    setData((p) => ({
      ...p,
      budgetItems: p.budgetItems.map((b) => (b.id === id ? { ...b, [field]: val } : b)),
    }));
  const addBudgetItem = () => setData((p) => ({ ...p, budgetItems: [...p.budgetItems, emptyBudgetItem()] }));
  const removeBudgetItem = (id: string) => {
    if (data.budgetItems.length <= 1) return;
    setData((p) => ({ ...p, budgetItems: p.budgetItems.filter((b) => b.id !== id) }));
  };

  // Deliverables
  const updateDeliverable = (id: string, val: string) =>
    setData((p) => ({
      ...p,
      deliverables: p.deliverables.map((d) => (d.id === id ? { ...d, text: val } : d)),
    }));
  const addDeliverable = () => setData((p) => ({ ...p, deliverables: [...p.deliverables, emptyDeliverable()] }));
  const removeDeliverable = (id: string) => {
    if (data.deliverables.length <= 1) return;
    setData((p) => ({ ...p, deliverables: p.deliverables.filter((d) => d.id !== id) }));
  };

  const [aiLoading, setAiLoading] = useState(false);
  const [rawText, setRawText] = useState("");
  const [showAiPanel, setShowAiPanel] = useState(false);

  // ─── Saved budgets ───
  const [savedBudgets, setSavedBudgets] = useState<BudgetSummary[]>([]);
  const [currentBudgetId, setCurrentBudgetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [loadingBudget, setLoadingBudget] = useState(false);

  const fetchBudgets = useCallback(async () => {
    try {
      const list = await listBudgets();
      setSavedBudgets(list);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveBudget(data as unknown as Record<string, unknown>, currentBudgetId || undefined);
      setCurrentBudgetId(saved.id);
      addToast("success", currentBudgetId ? "Presupuesto actualizado" : "Presupuesto guardado al historial");
      fetchBudgets();
    } catch {
      addToast("error", "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async (id: string) => {
    setLoadingBudget(true);
    try {
      const budget = await getBudget(id);
      const d = budget.data as Record<string, unknown>;
      setData({
        clientName: (d.clientName as string) || "",
        clientEmail: (d.clientEmail as string) || "",
        projectName: (d.projectName as string) || "",
        documentType: (d.documentType as string) || "Hoja de Ruta del Proyecto",
        date: (d.date as string) || today,
        currency: (d.currency as string) || "USD",
        phases: ((d.phases as Phase[]) || []).length > 0
          ? (d.phases as Phase[])
          : [emptyPhase()],
        deliverables: ((d.deliverables as Deliverable[]) || []).length > 0
          ? (d.deliverables as Deliverable[])
          : [emptyDeliverable()],
        budgetIntro: (d.budgetIntro as string) || "",
        budgetItems: ((d.budgetItems as BudgetItem[]) || []).length > 0
          ? (d.budgetItems as BudgetItem[])
          : [emptyBudgetItem()],
        totalLabel: (d.totalLabel as string) || "INVERSION TOTAL DEL PROYECTO",
        totalValue: (d.totalValue as string) || "",
        costNote: (d.costNote as string) || "",
        paymentTerms: (d.paymentTerms as string) || "",
      });
      setCurrentBudgetId(id);
      setShowSaved(false);
      addToast("success", "Presupuesto cargado");
    } catch {
      addToast("error", "Error al cargar presupuesto");
    } finally {
      setLoadingBudget(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBudget(id);
      if (currentBudgetId === id) setCurrentBudgetId(null);
      addToast("success", "Presupuesto eliminado");
      fetchBudgets();
    } catch {
      addToast("error", "Error al eliminar");
    }
  };

  const handleNew = () => {
    setCurrentBudgetId(null);
    setData({
      clientName: "",
      clientEmail: "",
      projectName: "",
      documentType: "Hoja de Ruta del Proyecto",
      date: today,
      currency: "USD",
      phases: [emptyPhase()],
      deliverables: [emptyDeliverable()],
      budgetIntro: "El proyecto se ha cotizado en base a un esquema de dedicacion exclusiva mensual de 160 horas por mes.",
      budgetItems: [emptyBudgetItem()],
      totalLabel: "INVERSION TOTAL DEL PROYECTO",
      totalValue: "",
      costNote: "",
      paymentTerms: "50% al inicio del proyecto, 50% al finalizar.",
    });
    setShowSaved(false);
    addToast("info", "Nuevo presupuesto");
  };

  const canGenerate = data.clientName.trim() && data.projectName.trim();

  const autoSave = async (d: ProposalData) => {
    if (!d.projectName.trim()) return;
    try {
      const saved = await saveBudget(d as unknown as Record<string, unknown>, currentBudgetId || undefined);
      setCurrentBudgetId(saved.id);
      fetchBudgets();
    } catch {
      // silent - don't block the main action
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateProposalPDF(data, addToast);
      await autoSave(data);
    } catch (err) {
      console.error("PDF generation error:", err);
      addToast("error", "Error al generar el PDF");
    } finally {
      setGenerating(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!rawText.trim()) return;
    setAiLoading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_BASE}/budget/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: rawText.trim(), currency: data.currency }),
      });
      if (!res.ok) throw new Error("Error del servidor");
      const result = await res.json();

      // Map AI result to form state, adding IDs
      setData((prev) => ({
        ...prev,
        clientName: result.clientName || prev.clientName,
        clientEmail: result.clientEmail || prev.clientEmail,
        projectName: result.projectName || prev.projectName,
        documentType: result.documentType || prev.documentType,
        phases: (result.phases || []).length > 0
          ? result.phases.map((ph: { name?: string; subtitle?: string; objective?: string; sections?: { title?: string; bullets?: string[] }[] }) => ({
              id: uid(),
              name: ph.name || "",
              subtitle: ph.subtitle || "",
              objective: ph.objective || "",
              sections: (ph.sections || []).map((s: { title?: string; bullets?: string[] }) => ({
                id: uid(),
                title: s.title || "",
                bullets: (s.bullets || []).map((b: string) => ({ id: uid(), text: b })),
              })),
            }))
          : prev.phases,
        deliverables: (result.deliverables || []).length > 0
          ? result.deliverables.map((d: string) => ({ id: uid(), text: d }))
          : prev.deliverables,
        budgetIntro: result.budgetIntro || prev.budgetIntro,
        budgetItems: (result.budgetItems || []).length > 0
          ? result.budgetItems.map((b: { concept?: string; hours?: string; rate?: string; subtotal?: string }) => ({
              id: uid(),
              concept: b.concept || "",
              hours: b.hours || "",
              rate: b.rate || "",
              subtotal: b.subtotal || "",
            }))
          : prev.budgetItems,
        totalLabel: result.totalLabel || prev.totalLabel,
        totalValue: result.totalValue || prev.totalValue,
        costNote: result.costNote || prev.costNote,
        paymentTerms: result.paymentTerms || prev.paymentTerms,
      }));

      addToast("success", "Propuesta estructurada con IA");
      setShowAiPanel(false);

      // Auto-save to history
      if (result.projectName) {
        try {
          const saved = await saveBudget(result as Record<string, unknown>, currentBudgetId || undefined);
          setCurrentBudgetId(saved.id);
          fetchBudgets();
        } catch { /* silent */ }
      }
    } catch {
      addToast("error", "Error al generar con IA");
    } finally {
      setAiLoading(false);
    }
  };

  // ─── UI ───

  const labelClass = "text-xs text-text-secondary mb-1 block";
  const inputClass = "input-premium w-full text-sm";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary tracking-tight">Presupuestos</h2>
          <p className="text-sm text-text-muted mt-1">
            Arma propuestas profesionales y descargalas en PDF
            {currentBudgetId && (
              <span className="ml-2 text-brand-mint text-[10px] font-semibold uppercase">en historial</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowSaved(!showSaved); setShowAiPanel(false); }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
              showSaved
                ? "bg-white/10 text-text-primary"
                : "bg-white/5 text-text-muted hover:bg-white/10 hover:text-text-primary"
            }`}
          >
            Historial {savedBudgets.length > 0 && `(${savedBudgets.length})`}
          </button>
          <button
            onClick={() => { setShowAiPanel(!showAiPanel); setShowSaved(false); }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
              showAiPanel
                ? "bg-brand-mint text-text-dark"
                : "bg-brand-mint/15 text-brand-mint hover:bg-brand-mint/25"
            }`}
          >
            {showAiPanel ? "Cerrar IA" : "Generar con IA"}
          </button>
        </div>
      </div>

      {/* ─── Saved Budgets Panel ─── */}
      {showSaved && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Historial de presupuestos
            </p>
            <button
              onClick={handleNew}
              className="px-3 py-1.5 text-xs font-semibold bg-brand-mint/15 text-brand-mint hover:bg-brand-mint/25 rounded-lg transition-colors"
            >
              + Nuevo
            </button>
          </div>
          {savedBudgets.length === 0 ? (
            <p className="text-sm text-text-muted py-4 text-center">No hay presupuestos en el historial todavia</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {savedBudgets.map((b) => (
                <div
                  key={b.id}
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer ${
                    currentBudgetId === b.id
                      ? "bg-brand-mint/10 border border-brand-mint/20"
                      : "bg-white/[0.03] hover:bg-white/[0.06] border border-transparent"
                  }`}
                  onClick={() => handleLoad(b.id)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {b.project_name || "Sin nombre"}
                    </p>
                    <p className="text-xs text-text-muted truncate">
                      {b.client_name || "Sin cliente"} · {new Date(b.updated_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(b.id); }}
                    className="ml-3 p-1.5 text-text-muted hover:text-red-400 transition-colors rounded"
                    title="Eliminar"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3,6 5,6 21,6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          {loadingBudget && (
            <p className="text-xs text-text-muted mt-3 text-center">Cargando...</p>
          )}
        </div>
      )}

      {/* ─── AI Panel ─── */}
      {showAiPanel && (
        <div className="glass-card p-6" style={{ borderColor: "rgba(0,245,160,0.2)" }}>
          <p className="text-xs font-semibold text-brand-mint mb-2 uppercase tracking-wider">
            Generar con IA
          </p>
          <p className="text-xs text-text-muted mb-3">
            Pega el texto del cliente o la descripcion del proyecto. La IA va a estructurarlo en el formato de propuesta
            <strong className="text-text-secondary"> sin inventar nada</strong> — solo organiza lo que le des.
          </p>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={"Pega aca toda la info del proyecto: fases, tecnologias, horas, precios, entregables, condiciones de pago...\n\nLa IA NO va a inventar datos, solo le da formato a lo que escribas."}
            rows={8}
            className="input-premium w-full text-sm resize-y mb-3"
            disabled={aiLoading}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-muted">
              La IA solo organiza y formatea. No inventa datos ni precios.
            </span>
            <button
              onClick={handleAiGenerate}
              disabled={!rawText.trim() || aiLoading}
              className="px-5 py-2 bg-brand-mint hover:bg-brand-mint-dark disabled:bg-surface-border disabled:text-text-muted text-text-dark font-semibold rounded-lg transition-colors text-sm"
            >
              {aiLoading ? "Procesando..." : "Estructurar con IA"}
            </button>
          </div>
        </div>
      )}

      {/* ─── Info general ─── */}
      <div className="glass-card p-6">
        <p className="text-xs font-semibold text-brand-mint mb-4 uppercase tracking-wider">
          Informacion general
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Cliente *</label>
            <input type="text" value={data.clientName} onChange={(e) => updateField("clientName", e.target.value)} placeholder="Nombre del cliente" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email del cliente</label>
            <input type="email" value={data.clientEmail} onChange={(e) => updateField("clientEmail", e.target.value)} placeholder="cliente@email.com" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Proyecto *</label>
            <input type="text" value={data.projectName} onChange={(e) => updateField("projectName", e.target.value)} placeholder="Nombre del proyecto" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Tipo de documento</label>
            <input type="text" value={data.documentType} onChange={(e) => updateField("documentType", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Fecha</label>
            <input type="date" value={data.date} onChange={(e) => updateField("date", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Moneda</label>
            <select value={data.currency} onChange={(e) => updateField("currency", e.target.value)} className={inputClass}>
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── Fases ─── */}
      {data.phases.map((phase, pi) => (
        <div key={phase.id} className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-brand-mint uppercase tracking-wider">
              Fase {pi + 1}
            </p>
            {data.phases.length > 1 && (
              <button onClick={() => removePhase(phase.id)} className="text-xs text-red-400/70 hover:text-red-400 transition-colors">
                Eliminar fase
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelClass}>Nombre de la fase</label>
              <input type="text" value={phase.name} onChange={(e) => updatePhase(phase.id, "name", e.target.value)} placeholder="FASE 1 — Web App, Backend y Motor IA" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Subtitulo (duracion, tecnologias)</label>
              <input type="text" value={phase.subtitle} onChange={(e) => updatePhase(phase.id, "subtitle", e.target.value)} placeholder="Duracion: 1 Mes · 160 horas · Next.js · Supabase" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Objetivo</label>
              <textarea value={phase.objective} onChange={(e) => updatePhase(phase.id, "objective", e.target.value)} placeholder="Describir el objetivo principal de esta fase..." rows={2} className={`${inputClass} resize-y`} />
            </div>

            {/* Sections */}
            {phase.sections.map((sec, si) => (
              <div key={sec.id} className="ml-2 pl-4" style={{ borderLeft: "2px solid rgba(0,245,160,0.15)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs text-text-muted">Seccion {si + 1}</label>
                  {phase.sections.length > 1 && (
                    <button onClick={() => removeSection(phase.id, sec.id)} className="text-xs text-red-400/50 hover:text-red-400">×</button>
                  )}
                </div>
                <input type="text" value={sec.title} onChange={(e) => updateSection(phase.id, sec.id, e.target.value)} placeholder="Desarrollo Frontend Web (Next.js)" className={`${inputClass} mb-2`} />

                {sec.bullets.map((b) => (
                  <div key={b.id} className="flex items-start gap-2 mb-1">
                    <span className="text-text-muted text-xs mt-2">—</span>
                    <input type="text" value={b.text} onChange={(e) => updateBullet(phase.id, sec.id, b.id, e.target.value)} placeholder="Punto del entregable..." className={`${inputClass} flex-1`} />
                    {sec.bullets.length > 1 && (
                      <button onClick={() => removeBullet(phase.id, sec.id, b.id)} className="text-xs text-red-400/50 hover:text-red-400 mt-2">×</button>
                    )}
                  </div>
                ))}
                <button onClick={() => addBullet(phase.id, sec.id)} className="text-xs text-brand-mint/70 hover:text-brand-mint mt-1">+ Bullet</button>
              </div>
            ))}
            <button onClick={() => addSection(phase.id)} className="text-xs text-brand-mint/70 hover:text-brand-mint">+ Seccion</button>
          </div>
        </div>
      ))}
      <button onClick={addPhase} className="text-xs text-brand-mint hover:text-brand-mint-light font-medium">
        + Agregar fase
      </button>

      {/* ─── Entregables ─── */}
      <div className="glass-card p-6">
        <p className="text-xs font-semibold text-brand-mint mb-4 uppercase tracking-wider">
          Entregables
        </p>
        {data.deliverables.map((d) => (
          <div key={d.id} className="flex items-center gap-2 mb-2">
            <span className="text-text-muted text-xs">—</span>
            <input type="text" value={d.text} onChange={(e) => updateDeliverable(d.id, e.target.value)} placeholder="Repositorios completos en GitHub..." className={`${inputClass} flex-1`} />
            {data.deliverables.length > 1 && (
              <button onClick={() => removeDeliverable(d.id)} className="text-xs text-red-400/50 hover:text-red-400">×</button>
            )}
          </div>
        ))}
        <button onClick={addDeliverable} className="text-xs text-brand-mint/70 hover:text-brand-mint">+ Entregable</button>
      </div>

      {/* ─── Presupuesto ─── */}
      <div className="glass-card p-6">
        <p className="text-xs font-semibold text-brand-mint mb-4 uppercase tracking-wider">
          Presupuesto
        </p>
        <div className="mb-4">
          <label className={labelClass}>Introduccion del presupuesto</label>
          <textarea value={data.budgetIntro} onChange={(e) => updateField("budgetIntro", e.target.value)} rows={2} className={`${inputClass} resize-y`} />
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[1fr_80px_100px_100px_32px] gap-2 text-xs text-text-muted font-medium mb-2 px-1">
          <span>Concepto</span>
          <span className="text-center">Horas</span>
          <span className="text-center">Tarifa</span>
          <span className="text-center">Subtotal</span>
          <span />
        </div>
        {data.budgetItems.map((item) => (
          <div key={item.id} className="grid grid-cols-[1fr_80px_100px_100px_32px] gap-2 items-center mb-2">
            <input type="text" value={item.concept} onChange={(e) => updateBudgetItem(item.id, "concept", e.target.value)} placeholder="Fase 1: Web App..." className={inputClass} />
            <input type="text" value={item.hours} onChange={(e) => updateBudgetItem(item.id, "hours", e.target.value)} placeholder="160 hrs" className={`${inputClass} text-center`} />
            <input type="text" value={item.rate} onChange={(e) => updateBudgetItem(item.id, "rate", e.target.value)} placeholder="$17.00/hr" className={`${inputClass} text-center`} />
            <input type="text" value={item.subtotal} onChange={(e) => updateBudgetItem(item.id, "subtotal", e.target.value)} placeholder="$2,720.00" className={`${inputClass} text-center`} />
            {data.budgetItems.length > 1 && (
              <button onClick={() => removeBudgetItem(item.id)} className="text-text-muted hover:text-red-400 text-lg">×</button>
            )}
          </div>
        ))}
        <button onClick={addBudgetItem} className="text-xs text-brand-mint/70 hover:text-brand-mint mb-4">+ Item</button>

        <div className="grid grid-cols-2 gap-4 mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <label className={labelClass}>Etiqueta del total</label>
            <input type="text" value={data.totalLabel} onChange={(e) => updateField("totalLabel", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Valor total</label>
            <input type="text" value={data.totalValue} onChange={(e) => updateField("totalValue", e.target.value)} placeholder="$5,440.00 USD" className={inputClass} />
          </div>
        </div>

        <div className="mt-4">
          <label className={labelClass}>Nota aclaratoria de costos (opcional)</label>
          <textarea value={data.costNote} onChange={(e) => updateField("costNote", e.target.value)} placeholder="Este presupuesto cubre el 100% de la mano de obra..." rows={2} className={`${inputClass} resize-y`} />
        </div>
      </div>

      {/* ─── Condiciones de pago ─── */}
      <div className="glass-card p-6">
        <p className="text-xs font-semibold text-brand-mint mb-4 uppercase tracking-wider">
          Condiciones de pago
        </p>
        <textarea value={data.paymentTerms} onChange={(e) => updateField("paymentTerms", e.target.value)} rows={2} className={`${inputClass} resize-y`} />
      </div>

      {/* ─── Acciones ─── */}
      <div className="flex items-center justify-between pb-8">
        <button
          onClick={() => {
            setData({
              clientName: "", clientEmail: "", projectName: "", documentType: "Hoja de Ruta del Proyecto",
              date: today, currency: "USD", phases: [emptyPhase()], deliverables: [emptyDeliverable()],
              budgetIntro: "El proyecto se ha cotizado en base a un esquema de dedicacion exclusiva mensual de 160 horas por mes.",
              budgetItems: [emptyBudgetItem()], totalLabel: "INVERSION TOTAL DEL PROYECTO", totalValue: "",
              costNote: "", paymentTerms: "50% al inicio del proyecto, 50% al finalizar.",
            });
          }}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          Limpiar formulario
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || generating}
            className="px-6 py-2.5 bg-brand-mint hover:bg-brand-mint-dark disabled:bg-surface-border disabled:text-text-muted text-text-dark font-semibold rounded-lg transition-colors"
          >
            {generating ? "Generando..." : "Descargar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
