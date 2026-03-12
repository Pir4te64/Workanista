"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  BackgroundVariant,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useToast } from "./Toast";
import {
  generateDiagram,
  listDiagrams,
  saveDiagram,
  deleteDiagram,
  type Diagram,
  type DiagramNode,
  type DiagramEdge,
} from "@/lib/diagram-api";
import { listScrum, type ScrumSummary } from "@/lib/scrum-api";

// ─── Color palette for nodes ─────────────────────────────────────────────────

const NODE_COLORS: Record<string, { bg: string; border: string; accent: string; text: string }> = {
  blue:   { bg: "rgba(59,130,246,0.15)",  border: "rgba(59,130,246,0.4)",  accent: "#3B82F6", text: "#93C5FD" },
  green:  { bg: "rgba(34,197,94,0.15)",   border: "rgba(34,197,94,0.4)",   accent: "#22C55E", text: "#86EFAC" },
  purple: { bg: "rgba(168,85,247,0.15)",  border: "rgba(168,85,247,0.4)",  accent: "#A855F7", text: "#D8B4FE" },
  orange: { bg: "rgba(249,115,22,0.15)",  border: "rgba(249,115,22,0.4)",  accent: "#F97316", text: "#FDBA74" },
  red:    { bg: "rgba(239,68,68,0.15)",   border: "rgba(239,68,68,0.4)",   accent: "#EF4444", text: "#FCA5A5" },
  cyan:   { bg: "rgba(6,182,212,0.15)",   border: "rgba(6,182,212,0.4)",   accent: "#06B6D4", text: "#67E8F9" },
  pink:   { bg: "rgba(236,72,153,0.15)",  border: "rgba(236,72,153,0.4)",  accent: "#EC4899", text: "#F9A8D4" },
};

const DEFAULT_COLOR = NODE_COLORS.blue;

// ─── Custom Node (horizontal tree — handles left/right) ──────────────────────

function CustomNode({ data, selected }: NodeProps) {
  const label = String(data.label ?? "");
  const description = data.description ? String(data.description) : "";
  const colorKey = String(data.color ?? "blue");
  const c = NODE_COLORS[colorKey] ?? DEFAULT_COLOR;

  return (
    <div
      className="rounded-xl min-w-[170px] max-w-[240px] shadow-xl transition-shadow duration-200"
      style={{
        background: c.bg,
        border: `2px solid ${selected ? c.accent : c.border}`,
        boxShadow: selected ? `0 0 20px ${c.accent}40` : `0 4px 20px rgba(0,0,0,0.3)`,
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Left handle (input) */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ background: c.accent, width: 10, height: 10, border: `2px solid ${c.bg}` }}
      />

      {/* Content */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.accent }} />
          <p className="text-sm font-bold leading-tight" style={{ color: c.text }}>{label}</p>
        </div>
        {description && (
          <p className="text-[11px] leading-relaxed ml-[18px]" style={{ color: "rgba(255,255,255,0.5)" }}>
            {description}
          </p>
        )}
      </div>

      {/* Right handle (output) */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: c.accent, width: 10, height: 10, border: `2px solid ${c.bg}` }}
      />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconSpark = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

const IconSave = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <polyline points="17,21 17,13 7,13 7,21" />
    <polyline points="7,3 7,8 15,8" />
  </svg>
);

const IconPDF = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14,2 14,8 20,8" />
    <path d="M10 12h4M10 16h4M10 20h1" />
  </svg>
);

const IconTrash = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3,6 5,6 21,6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

const IconLoader = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
    <path d="M12 2a10 10 0 0110 10" strokeLinecap="round" />
  </svg>
);

const IconPlus = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconList = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

// ─── PDF Export ───────────────────────────────────────────────────────────────

async function exportDiagramToPDF(
  containerRef: React.RefObject<HTMLDivElement | null>,
  title: string
) {
  const { toPng } = await import("html-to-image");
  const jsPDF = (await import("jspdf")).default;

  const el = containerRef.current?.querySelector(".react-flow__viewport") as HTMLElement | null;
  if (!el) return;

  const dataUrl = await toPng(el, {
    backgroundColor: "#111118",
    pixelRatio: 2,
    filter: (node) => {
      const cls = (node as HTMLElement).classList;
      if (!cls) return true;
      return !cls.contains("react-flow__controls") && !cls.contains("react-flow__panel") && !cls.contains("react-flow__minimap");
    },
  });

  const img = new Image();
  img.src = dataUrl;
  await new Promise((resolve) => { img.onload = resolve; });

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 10;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("CRUZNEGRA DEV LLC", M, M + 4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(new Date().toLocaleDateString("es-AR"), PW - M, M + 4, { align: "right" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text(title || "Diagrama de Flujo", M, M + 12);

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(M, M + 15, PW - M, M + 15);

  const imgTop = M + 20;
  const availW = PW - M * 2;
  const availH = PH - imgTop - 15;
  const ratio = Math.min(availW / img.width, availH / img.height);
  const imgW = img.width * ratio;
  const imgH = img.height * ratio;
  const imgX = M + (availW - imgW) / 2;

  doc.addImage(dataUrl, "PNG", imgX, imgTop, imgW, imgH);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text("CruzNegraDev LLC  |  Victor Manuel Moreira", M, PH - 6);
  doc.text("1 / 1", PW - M, PH - 6, { align: "right" });

  doc.save(`Diagrama_${title.replace(/\s+/g, "_") || "flow"}.pdf`);
}

// ─── Saved diagrams sidebar ──────────────────────────────────────────────────

function DiagramList({
  diagrams, onSelect, onDelete, selectedId,
}: {
  diagrams: Diagram[];
  onSelect: (d: Diagram) => void;
  onDelete: (id: string) => void;
  selectedId?: string;
}) {
  if (diagrams.length === 0) {
    return <p className="text-xs text-text-muted px-3 py-4">Sin diagramas guardados.</p>;
  }
  return (
    <div className="space-y-1">
      {diagrams.map((d) => (
        <div
          key={d.id}
          className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${
            selectedId === d.id ? "bg-brand-mint/10 text-brand-mint" : "text-text-secondary hover:bg-white/[0.04]"
          }`}
          onClick={() => onSelect(d)}
        >
          <span className="flex-1 truncate">{d.title}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(d.id); }}
            className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-all p-0.5"
          >
            <IconTrash className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Main DesignTab ──────────────────────────────────────────────────────────

export default function DesignTab() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("Sin titulo");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [scrumProjects, setScrumProjects] = useState<ScrumSummary[]>([]);
  const [showList, setShowList] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({
      ...params,
      type: "smoothstep",
      animated: true,
      style: { stroke: "rgba(255,255,255,0.3)", strokeWidth: 2 },
    }, eds)),
    [setEdges]
  );

  // Load data
  useEffect(() => {
    async function load() {
      setLoadingList(true);
      try {
        const [diags, projects] = await Promise.allSettled([listDiagrams(), listScrum()]);
        if (diags.status === "fulfilled") setDiagrams(diags.value);
        if (projects.status === "fulfilled") setScrumProjects(projects.value);
      } catch { /* silent */ }
      finally { setLoadingList(false); }
    }
    load();
  }, []);

  // Add a new blank node on canvas
  const handleAddNode = () => {
    const id = `n-${Date.now()}`;
    const colors = Object.keys(NODE_COLORS);
    const color = colors[nodes.length % colors.length];
    const newNode: Node = {
      id,
      type: "custom",
      position: { x: 100 + nodes.length * 50, y: 200 + nodes.length * 30 },
      data: { label: "Nuevo paso", description: "Edita este nodo", color },
    };
    setNodes((prev) => [...prev, newNode]);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const result = await generateDiagram(prompt);
      const flowNodes: Node[] = result.nodes.map((n: DiagramNode) => ({
        id: n.id,
        type: n.type || "custom",
        position: n.position,
        data: n.data,
      }));
      const flowEdges: Edge[] = result.edges.map((e: DiagramEdge) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: "right",
        targetHandle: "left",
        type: e.type || "smoothstep",
        animated: e.animated ?? true,
        style: { stroke: "rgba(255,255,255,0.3)", strokeWidth: 2 },
      }));
      setNodes(flowNodes);
      setEdges(flowEdges);
      setSelectedId(undefined);
      addToast("success", "Diagrama generado");
    } catch (err) {
      console.error(err);
      addToast("error", "Error al generar el diagrama");
    } finally {
      setGenerating(false);
    }
  };

  const handleLoadFromScrum = (project: ScrumSummary) => {
    setPrompt(
      `Genera un diagrama de flujo del proyecto "${project.project_name}" para el cliente "${project.client_name}". Descripcion: ${project.description}`
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        title,
        description: prompt,
        nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })) as DiagramNode[],
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type, animated: e.animated })) as DiagramEdge[],
      };
      const saved = await saveDiagram(data);
      setSelectedId(saved.id);
      setDiagrams((prev) => {
        const exists = prev.find((d) => d.id === saved.id);
        return exists ? prev.map((d) => (d.id === saved.id ? saved : d)) : [saved, ...prev];
      });
      addToast("success", "Diagrama guardado");
    } catch { addToast("error", "Error al guardar"); }
    finally { setSaving(false); }
  };

  const handleSelect = (d: Diagram) => {
    setNodes(d.nodes.map((n) => ({ id: n.id, type: n.type || "custom", position: n.position, data: n.data })));
    setEdges(d.edges.map((e) => ({
      id: e.id, source: e.source, target: e.target,
      sourceHandle: "right", targetHandle: "left",
      type: e.type || "smoothstep", animated: e.animated ?? true,
      style: { stroke: "rgba(255,255,255,0.3)", strokeWidth: 2 },
    })));
    setTitle(d.title);
    setPrompt(d.description || "");
    setSelectedId(d.id);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDiagram(id);
      setDiagrams((prev) => prev.filter((d) => d.id !== id));
      if (selectedId === id) { setSelectedId(undefined); setNodes([]); setEdges([]); setTitle("Sin titulo"); setPrompt(""); }
      addToast("success", "Diagrama eliminado");
    } catch { addToast("error", "Error al eliminar"); }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try { await exportDiagramToPDF(containerRef, title); addToast("success", "PDF exportado"); }
    catch { addToast("error", "Error al exportar PDF"); }
    finally { setExporting(false); }
  };

  const handleNew = () => { setNodes([]); setEdges([]); setTitle("Sin titulo"); setPrompt(""); setSelectedId(undefined); };

  const btnStyle = { background: "rgba(34,34,64,0.9)", border: "1px solid rgba(255,255,255,0.1)" };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary tracking-tight">Diagramas</h2>
          <p className="text-sm text-text-muted mt-0.5">Genera diagramas de flujo con IA — arrastra y conecta nodos</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowList(!showList)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-text-muted hover:text-text-primary"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <IconList className="w-3.5 h-3.5" />
            {diagrams.length} guardados
          </button>
          <button onClick={handleNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-text-muted hover:text-text-primary"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <IconPlus className="w-3.5 h-3.5" /> Nuevo
          </button>
        </div>
      </div>

      {/* Generator input */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Nombre del diagrama" className="input-premium flex-1" />
          {scrumProjects.length > 0 && (
            <select className="input-premium w-auto text-xs" defaultValue=""
              onChange={(e) => { const p = scrumProjects.find((x) => x.id === e.target.value); if (p) handleLoadFromScrum(p); }}>
              <option value="" disabled>Cargar desde proyecto...</option>
              {scrumProjects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
          )}
        </div>
        <div className="flex gap-2">
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe el flujo que quieres generar... Ej: 'Proceso de onboarding: registro, verificacion, asignacion de equipo, kickoff, setup de herramientas'"
            className="input-premium flex-1 resize-none" rows={2} />
          <button onClick={handleGenerate} disabled={generating || !prompt.trim()}
            className="btn-primary shrink-0 flex items-center gap-1.5 self-end">
            {generating ? <IconLoader className="w-4 h-4" /> : <IconSpark className="w-4 h-4" />}
            Generar
          </button>
        </div>
      </div>

      {/* Main canvas area */}
      <div className="flex gap-3" style={{ height: "calc(100vh - 310px)" }}>
        {/* Saved list */}
        {showList && (
          <div className="w-52 shrink-0 rounded-lg overflow-y-auto"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="px-3 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-white/[0.06]">
              Guardados
            </div>
            {loadingList ? (
              <div className="flex justify-center py-6"><IconLoader className="w-4 h-4 text-text-muted" /></div>
            ) : (
              <DiagramList diagrams={diagrams} onSelect={handleSelect} onDelete={handleDelete} selectedId={selectedId} />
            )}
          </div>
        )}

        {/* React Flow canvas */}
        <div ref={containerRef} className="flex-1 rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            nodesDraggable
            nodesConnectable
            defaultEdgeOptions={{
              type: "smoothstep",
              animated: true,
              style: { stroke: "rgba(255,255,255,0.3)", strokeWidth: 2 },
            }}
            style={{ background: "#0D0D15" }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.04)" />
            <Controls
              style={{ background: "#1A1A30", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10 }}
              showInteractive={false}
            />
            <MiniMap
              nodeColor={(n) => {
                const c = String(n.data?.color ?? "blue");
                return NODE_COLORS[c]?.accent ?? "#3B82F6";
              }}
              style={{ background: "#0D0D15", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10 }}
              maskColor="rgba(0,0,0,0.6)"
            />

            {/* Toolbar in canvas */}
            <Panel position="top-right" className="flex items-center gap-2">
              <button onClick={handleAddNode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-brand-mint hover:text-white disabled:opacity-40"
                style={btnStyle}>
                <IconPlus className="w-3.5 h-3.5" /> Nodo
              </button>
              <button onClick={handleSave} disabled={saving || nodes.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-text-muted hover:text-text-primary disabled:opacity-40"
                style={btnStyle}>
                {saving ? <IconLoader className="w-3.5 h-3.5" /> : <IconSave className="w-3.5 h-3.5" />} Guardar
              </button>
              <button onClick={handleExportPDF} disabled={exporting || nodes.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-text-muted hover:text-text-primary disabled:opacity-40"
                style={btnStyle}>
                {exporting ? <IconLoader className="w-3.5 h-3.5" /> : <IconPDF className="w-3.5 h-3.5" />} PDF
              </button>
            </Panel>

            {/* Empty state */}
            {nodes.length === 0 && (
              <Panel position="top-center" className="mt-24">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(74,234,170,0.1)", border: "1px solid rgba(74,234,170,0.2)" }}>
                    <IconSpark className="w-7 h-7 text-brand-mint" />
                  </div>
                  <p className="text-sm text-text-secondary font-medium">Describe un proceso para generar el diagrama</p>
                  <p className="text-xs text-text-muted mt-1.5">Podes arrastrar nodos, conectarlos entre si, y agregar nuevos</p>
                  <div className="flex items-center justify-center gap-4 mt-4">
                    {Object.entries(NODE_COLORS).slice(0, 5).map(([key, c]) => (
                      <div key={key} className="w-3 h-3 rounded-full" style={{ background: c.accent }} title={key} />
                    ))}
                  </div>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
