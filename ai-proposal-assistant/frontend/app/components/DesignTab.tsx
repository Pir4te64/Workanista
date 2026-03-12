"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  BackgroundVariant,
  useReactFlow,
  getNodesBounds,
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
  blue:   { bg: "rgba(59,130,246,0.12)",   border: "rgba(59,130,246,0.35)",  accent: "#3B82F6", text: "#1E40AF" },
  green:  { bg: "rgba(34,197,94,0.12)",    border: "rgba(34,197,94,0.35)",   accent: "#22C55E", text: "#166534" },
  purple: { bg: "rgba(168,85,247,0.12)",   border: "rgba(168,85,247,0.35)",  accent: "#A855F7", text: "#6B21A8" },
  orange: { bg: "rgba(249,115,22,0.12)",   border: "rgba(249,115,22,0.35)",  accent: "#F97316", text: "#9A3412" },
  red:    { bg: "rgba(239,68,68,0.12)",    border: "rgba(239,68,68,0.35)",   accent: "#EF4444", text: "#991B1B" },
  cyan:   { bg: "rgba(6,182,212,0.12)",    border: "rgba(6,182,212,0.35)",   accent: "#06B6D4", text: "#155E75" },
  pink:   { bg: "rgba(236,72,153,0.12)",   border: "rgba(236,72,153,0.35)",  accent: "#EC4899", text: "#9D174D" },
};

const COLOR_NAMES: Record<string, string> = {
  blue: "Azul", green: "Verde", purple: "Morado", orange: "Naranja",
  red: "Rojo", cyan: "Cyan", pink: "Rosa",
};

const DEFAULT_COLOR = NODE_COLORS.blue;

// ─── Context Menu ────────────────────────────────────────────────────────────

interface ContextMenuData {
  nodeId: string;
  x: number;
  y: number;
}

function NodeContextMenu({
  data, onClose, onEdit, onChangeColor, onDuplicate, onAddChild, onDelete,
}: {
  data: ContextMenuData;
  onClose: () => void;
  onEdit: (id: string) => void;
  onChangeColor: (id: string, color: string) => void;
  onDuplicate: (id: string) => void;
  onAddChild: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [showColors, setShowColors] = useState(false);

  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [onClose]);

  const menuStyle: React.CSSProperties = {
    position: "fixed", left: data.x, top: data.y, zIndex: 1000,
    background: "#fff", borderRadius: 10, padding: 4,
    boxShadow: "0 8px 30px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1)",
    border: "1px solid rgba(0,0,0,0.08)", minWidth: 180,
  };

  const itemClass = "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors hover:bg-gray-100 text-gray-700";

  return (
    <div style={menuStyle} onClick={(e) => e.stopPropagation()}>
      <button className={itemClass} onClick={() => { onEdit(data.nodeId); onClose(); }}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
        Editar texto
      </button>
      <button className={itemClass} onClick={() => setShowColors(!showColors)}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="10" /><path d="M12 2a10 10 0 0110 10" /><path d="M2 12h20" /></svg>
        Cambiar color
        <svg className="w-3 h-3 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="9,18 15,12 9,6" /></svg>
      </button>
      {showColors && (
        <div className="flex gap-1.5 px-3 py-2">
          {Object.entries(NODE_COLORS).map(([key, c]) => (
            <button key={key} title={COLOR_NAMES[key]}
              className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
              style={{ background: c.accent }}
              onClick={() => { onChangeColor(data.nodeId, key); onClose(); }} />
          ))}
        </div>
      )}
      <button className={itemClass} onClick={() => { onAddChild(data.nodeId); onClose(); }}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        Agregar sub-pantalla
      </button>
      <button className={itemClass} onClick={() => { onDuplicate(data.nodeId); onClose(); }}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
        Duplicar
      </button>
      <div className="border-t border-gray-100 my-1" />
      <button className={`${itemClass} !text-red-500 hover:!bg-red-50`} onClick={() => { onDelete(data.nodeId); onClose(); }}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><polyline points="3,6 5,6 21,6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
        Eliminar
      </button>
    </div>
  );
}

// ─── Shared edit hooks for nodes ─────────────────────────────────────────────

function useNodeEdit(id: string, label: string, description: string) {
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(label);
  const [editDesc, setEditDesc] = useState(description);
  const { setNodes } = useReactFlow();

  useEffect(() => {
    // handled externally
  }, []);

  const syncEditing = useCallback((dataEditing: unknown) => {
    if (dataEditing && !editing) {
      setEditLabel(label);
      setEditDesc(description);
      setEditing(true);
      setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, _editing: false } } : n));
    }
  }, [editing, id, label, description, setNodes]);

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !collapsed;
    setCollapsed(next);
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, _collapsed: next } } : n));
  };

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditLabel(label);
    setEditDesc(description);
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, label: editLabel, description: editDesc } } : n));
  };

  return { collapsed, editing, editLabel, editDesc, setEditLabel, setEditDesc, syncEditing, toggleCollapse, startEditing, commitEdit };
}

// ─── Main Section Node (large filled card — like reference image) ────────────

function MainNode({ id, data, selected }: NodeProps) {
  const label = String(data.label ?? "");
  const description = data.description ? String(data.description) : "";
  const colorKey = String(data.color ?? "blue");
  const c = NODE_COLORS[colorKey] ?? DEFAULT_COLOR;
  const { collapsed, editing, editLabel, editDesc, setEditLabel, setEditDesc, syncEditing, toggleCollapse, startEditing, commitEdit } = useNodeEdit(id, label, description);

  useEffect(() => { syncEditing(data._editing); }, [data._editing, syncEditing]);

  return (
    <div
      className="rounded-2xl min-w-[180px] max-w-[280px] transition-all duration-200"
      style={{
        background: c.accent,
        border: `2px solid ${selected ? "#fff" : c.accent}`,
        boxShadow: selected ? `0 0 24px ${c.accent}60, 0 4px 20px rgba(0,0,0,0.15)` : `0 4px 20px rgba(0,0,0,0.12)`,
      }}
    >
      <Handle type="target" position={Position.Left} id="left"
        style={{ background: "#fff", width: 10, height: 10, border: `2px solid ${c.accent}` }} />

      <div className="px-5 py-4">
        <div className="flex items-center gap-2">
          {editing ? (
            <input className="text-base font-bold bg-white/20 border-b border-white/40 rounded-none px-0 outline-none flex-1 min-w-0 text-white placeholder-white/50"
              value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
              onBlur={commitEdit} onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); }}
              autoFocus />
          ) : (
            <p className="text-base font-bold leading-tight flex-1 cursor-text text-white"
              onDoubleClick={startEditing}>{label}</p>
          )}
          <button onClick={toggleCollapse} className="shrink-0 opacity-70 hover:opacity-100 transition-opacity p-0.5 text-white">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              {collapsed ? <polyline points="6,9 12,15 18,9" /> : <polyline points="6,15 12,9 18,15" />}
            </svg>
          </button>
        </div>
        {!collapsed && (
          editing ? (
            <textarea className="text-xs leading-relaxed mt-1.5 bg-white/20 border-b border-white/40 rounded-none px-0 outline-none w-full resize-none text-white/80 placeholder-white/40"
              value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
              onBlur={commitEdit} rows={2} />
          ) : description ? (
            <p className="text-xs leading-relaxed mt-1.5 cursor-text text-white/70"
              onDoubleClick={startEditing}>{description}</p>
          ) : (
            <p className="text-xs leading-relaxed mt-1.5 cursor-text italic text-white/40"
              onDoubleClick={startEditing}>Doble click para editar</p>
          )
        )}
      </div>

      <Handle type="source" position={Position.Right} id="right"
        style={{ background: "#fff", width: 10, height: 10, border: `2px solid ${c.accent}` }} />
    </div>
  );
}

// ─── Custom Sub-Node (outlined card — white with thin border) ────────────────

function CustomNode({ id, data, selected }: NodeProps) {
  const label = String(data.label ?? "");
  const description = data.description ? String(data.description) : "";
  const colorKey = String(data.color ?? "blue");
  const c = NODE_COLORS[colorKey] ?? DEFAULT_COLOR;
  const { collapsed, editing, editLabel, editDesc, setEditLabel, setEditDesc, syncEditing, toggleCollapse, startEditing, commitEdit } = useNodeEdit(id, label, description);

  useEffect(() => { syncEditing(data._editing); }, [data._editing, syncEditing]);

  return (
    <div
      className="rounded-xl min-w-[140px] max-w-[260px] transition-all duration-200"
      style={{
        background: "#fff",
        border: `1.5px solid ${selected ? c.accent : "rgba(0,0,0,0.15)"}`,
        boxShadow: selected ? `0 0 16px ${c.accent}30, 0 2px 8px rgba(0,0,0,0.08)` : `0 1px 6px rgba(0,0,0,0.06)`,
      }}
    >
      <Handle type="target" position={Position.Left} id="left"
        style={{ background: c.accent, width: 8, height: 8, border: "2px solid #fff" }} />

      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          {editing ? (
            <input className="text-sm font-semibold bg-gray-50 border rounded px-1 outline-none flex-1 min-w-0"
              style={{ color: "#333", borderColor: c.accent }}
              value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
              onBlur={commitEdit} onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); }}
              autoFocus />
          ) : (
            <p className="text-sm font-semibold leading-tight flex-1 cursor-text" style={{ color: "#333" }}
              onDoubleClick={startEditing}>{label}</p>
          )}
          <button onClick={toggleCollapse} className="shrink-0 opacity-40 hover:opacity-80 transition-opacity p-0.5"
            style={{ color: "#666" }}>
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              {collapsed ? <polyline points="6,9 12,15 18,9" /> : <polyline points="6,15 12,9 18,15" />}
            </svg>
          </button>
        </div>
        {!collapsed && (
          editing ? (
            <textarea className="text-[11px] leading-relaxed mt-1 bg-gray-50 border rounded px-1 outline-none w-full resize-none text-gray-500"
              style={{ borderColor: "rgba(0,0,0,0.15)" }}
              value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
              onBlur={commitEdit} rows={2} />
          ) : description ? (
            <p className="text-[11px] leading-relaxed mt-1 cursor-text" style={{ color: "#888" }}
              onDoubleClick={startEditing}>{description}</p>
          ) : null
        )}
      </div>

      <Handle type="source" position={Position.Right} id="right"
        style={{ background: c.accent, width: 8, height: 8, border: "2px solid #fff" }} />
    </div>
  );
}

const nodeTypes = { custom: CustomNode, main: MainNode };

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

// ─── Inner Flow (needs ReactFlowProvider) ────────────────────────────────────

function DesignTabInner() {
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
  const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();
  const reactFlowInstance = useReactFlow();

  const edgeStyle = { stroke: "#22B8CF", strokeWidth: 1.5 };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({
      ...params, type: "smoothstep", animated: false, style: edgeStyle,
    }, eds)),
    [setEdges]
  );

  // Right-click on node
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
  }, []);

  // Left-click on node also shows menu (single click)
  const onNodeClick = useCallback((_event: React.MouseEvent, _node: Node) => {
    // Single click selects — context menu is on right-click only
  }, []);

  // Close context menu on pane click
  const onPaneClick = useCallback(() => { setContextMenu(null); }, []);

  // Context menu actions
  const handleContextEdit = (nodeId: string) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, _editing: true } } : n));
  };

  const handleContextChangeColor = (nodeId: string, color: string) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, color } } : n));
  };

  const handleContextDuplicate = (nodeId: string) => {
    const orig = nodes.find((n) => n.id === nodeId);
    if (!orig) return;
    const newId = `n-${Date.now()}`;
    const newNode: Node = {
      ...orig,
      id: newId,
      position: { x: orig.position.x + 40, y: orig.position.y + 40 },
      data: { ...orig.data, label: `${orig.data.label} (copia)` },
      selected: false,
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleContextAddChild = (nodeId: string) => {
    const parent = nodes.find((n) => n.id === nodeId);
    if (!parent) return;
    const newId = `n-${Date.now()}`;
    const newNode: Node = {
      id: newId,
      type: "custom",
      position: { x: parent.position.x + 300, y: parent.position.y },
      data: { label: "Nueva pantalla", description: "", color: parent.data.color || "blue" },
    };
    const newEdge: Edge = {
      id: `e-${nodeId}-${newId}`,
      source: nodeId,
      target: newId,
      sourceHandle: "right",
      targetHandle: "left",
      type: "smoothstep",
      animated: false,
      style: edgeStyle,
    };
    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [...eds, newEdge]);
  };

  const handleContextDelete = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  };

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

  const handleAddNode = () => {
    const id = `n-${Date.now()}`;
    const colors = Object.keys(NODE_COLORS);
    const color = colors[nodes.length % colors.length];
    // Place node at center of current viewport
    const container = containerRef.current;
    const centerX = container ? container.clientWidth / 2 : 400;
    const centerY = container ? container.clientHeight / 2 : 300;
    const position = reactFlowInstance.screenToFlowPosition({ x: centerX + (container?.getBoundingClientRect().left ?? 0), y: centerY + (container?.getBoundingClientRect().top ?? 0) });
    const newNode: Node = {
      id, type: "custom",
      position,
      data: { label: "Nueva pantalla", description: "", color },
    };
    setNodes((prev) => [...prev, newNode]);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const result = await generateDiagram(prompt);
      const flowNodes: Node[] = result.nodes.map((n: DiagramNode) => ({
        id: n.id, type: n.type || "custom", position: n.position, data: n.data,
      }));
      const flowEdges: Edge[] = result.edges.map((e: DiagramEdge) => ({
        id: e.id, source: e.source, target: e.target,
        sourceHandle: "right", targetHandle: "left",
        type: e.type || "smoothstep", animated: e.animated ?? true,
        style: edgeStyle,
      }));
      setNodes(flowNodes);
      setEdges(flowEdges);
      setSelectedId(undefined);
      addToast("success", "Mapa de pantallas generado");
    } catch (err) {
      console.error(err);
      addToast("error", "Error al generar el diagrama");
    } finally {
      setGenerating(false);
    }
  };

  const handleLoadFromScrum = (project: ScrumSummary) => {
    setPrompt(
      `Genera el mapa de pantallas del proyecto "${project.project_name}" para el cliente "${project.client_name}". Descripcion: ${project.description}`
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        title, description: prompt,
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
      style: edgeStyle,
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

  // ─── Helper: load SVG logo as PNG data URL ──────────────────────────────
  const loadLogoPng = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        // Logo SVG viewBox is 192x34.3
        const scale = 4;
        canvas.width = 192 * scale;
        canvas.height = 34.3 * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject("No canvas ctx"); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = "/LogoCruznegra.svg";
    });
  };

  // ─── PDF Export (captures ALL nodes, not just viewport) ──────────────────
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const jsPDF = (await import("jspdf")).default;

      if (nodes.length === 0) return;

      // Load logo in parallel
      let logoPng: string | null = null;
      try { logoPng = await loadLogoPng(); } catch { /* fallback to text */ }

      // Calculate bounds of all nodes
      const bounds = getNodesBounds(nodes);
      const padding = 60;
      const fullW = bounds.width + padding * 2;
      const fullH = bounds.height + padding * 2;

      // Save current viewport, then fit everything
      const prevViewport = reactFlowInstance.getViewport();
      reactFlowInstance.fitView({ padding: 0.1, duration: 0 });
      await new Promise((r) => setTimeout(r, 200));

      const el = containerRef.current?.querySelector(".react-flow__viewport") as HTMLElement | null;
      if (!el) return;

      const dataUrl = await toPng(el, {
        backgroundColor: "#FFFFFF",
        pixelRatio: 2,
        width: fullW,
        height: fullH,
        style: {
          width: `${fullW}px`,
          height: `${fullH}px`,
          transform: `translate(${-bounds.x + padding}px, ${-bounds.y + padding}px) scale(1)`,
        },
        filter: (node) => {
          const cls = (node as HTMLElement).classList;
          if (!cls) return true;
          return !cls.contains("react-flow__controls") && !cls.contains("react-flow__panel") && !cls.contains("react-flow__minimap");
        },
      });

      reactFlowInstance.setViewport(prevViewport, { duration: 0 });

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const PW = doc.internal.pageSize.getWidth();
      const PH = doc.internal.pageSize.getHeight();
      const M = 10;

      // ── Header: Logo + date ──
      if (logoPng) {
        // Logo: 192x34.3 aspect ratio → ~48mm x 8.5mm
        doc.addImage(logoPng, "PNG", M, M, 48, 8.5);
      } else {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text("CRUZNEGRA DEV LLC", M, M + 6);
      }
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(new Date().toLocaleDateString("es-AR"), PW - M, M + 6, { align: "right" });

      // ── Title ──
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(title || "Mapa de Pantallas", M, M + 16);

      // ── Separator line (black) ──
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.line(M, M + 19, PW - M, M + 19);

      // ── Diagram image ──
      const imgTop = M + 23;
      const availW = PW - M * 2;
      const availH = PH - imgTop - 12;
      const ratio = Math.min(availW / img.width, availH / img.height);
      const imgW = img.width * ratio;
      const imgH = img.height * ratio;
      const imgX = M + (availW - imgW) / 2;
      doc.addImage(dataUrl, "PNG", imgX, imgTop, imgW, imgH);

      // ── Footer (black) ──
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.2);
      doc.line(M, PH - 10, PW - M, PH - 10);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text("CruzNegraDev LLC  |  Victor Manuel Moreira", M, PH - 6);
      doc.text("Pag. 1 / 1", PW - M, PH - 6, { align: "right" });

      doc.save(`Diagrama_${title.replace(/\s+/g, "_") || "flow"}.pdf`);
      addToast("success", "PDF exportado");
    } catch (err) {
      console.error(err);
      addToast("error", "Error al exportar PDF");
    } finally {
      setExporting(false);
    }
  };

  const handleNew = () => { setNodes([]); setEdges([]); setTitle("Sin titulo"); setPrompt(""); setSelectedId(undefined); };

  const btnStyle: React.CSSProperties = { background: "rgba(255,255,255,0.92)", border: "1px solid rgba(0,0,0,0.1)", color: "#444", borderRadius: 8 };

  return (
    <div className="space-y-2">
      {/* Compact toolbar: title + prompt + actions all in one row */}
      <div className="glass-card px-3 py-2 flex items-center gap-2">
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Nombre" className="input-premium w-36 text-sm py-1" />
        <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe la app... Ej: 'E-commerce con login, productos, carrito'"
          className="input-premium flex-1 text-sm py-1"
          onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }} />
        {scrumProjects.length > 0 && (
          <select className="input-premium w-auto text-xs py-1" defaultValue=""
            onChange={(e) => { const p = scrumProjects.find((x) => x.id === e.target.value); if (p) handleLoadFromScrum(p); }}>
            <option value="" disabled>Proyecto...</option>
            {scrumProjects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
          </select>
        )}
        <button onClick={handleGenerate} disabled={generating || !prompt.trim()}
          className="btn-primary shrink-0 flex items-center gap-1.5 text-sm py-1.5 px-3">
          {generating ? <IconLoader className="w-4 h-4" /> : <IconSpark className="w-4 h-4" />}
          Generar
        </button>
        <div className="w-px h-6 bg-white/10 shrink-0" />
        <button onClick={() => setShowList(!showList)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all text-text-muted hover:text-text-primary shrink-0"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <IconList className="w-3.5 h-3.5" />
          {diagrams.length}
        </button>
        <button onClick={handleNew}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all text-text-muted hover:text-text-primary shrink-0"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <IconPlus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main canvas area — takes almost full height */}
      <div className="flex gap-2" style={{ height: "calc(100vh - 145px)" }}>
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
        <div ref={containerRef} className="flex-1 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeContextMenu={onNodeContextMenu}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            nodesDraggable
            nodesConnectable
            edgesReconnectable
            deleteKeyCode="Delete"
            defaultEdgeOptions={{
              type: "smoothstep",
              animated: false,
              style: edgeStyle,
            }}
            style={{ background: "#F5F3EF" }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(0,0,0,0.06)" />
            <Controls
              style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10 }}
              showInteractive={false}
            />
            <MiniMap
              nodeColor={(n) => {
                const ck = String(n.data?.color ?? "blue");
                return NODE_COLORS[ck]?.accent ?? "#3B82F6";
              }}
              style={{ background: "#FAFAF8", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10 }}
              maskColor="rgba(0,0,0,0.12)"
            />

            {/* Toolbar */}
            <Panel position="top-right" className="flex items-center gap-1.5">
              <button onClick={handleAddNode}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40"
                style={{ ...btnStyle, color: "#166534" }}>
                <IconPlus className="w-3.5 h-3.5" /> Nodo
              </button>
              <button onClick={handleSave} disabled={saving || nodes.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40"
                style={btnStyle}>
                {saving ? <IconLoader className="w-3.5 h-3.5" /> : <IconSave className="w-3.5 h-3.5" />} Guardar
              </button>
              <button onClick={handleExportPDF} disabled={exporting || nodes.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40"
                style={btnStyle}>
                {exporting ? <IconLoader className="w-3.5 h-3.5" /> : <IconPDF className="w-3.5 h-3.5" />} PDF
              </button>
            </Panel>

            {/* Keyboard hint */}
            <Panel position="bottom-left">
              <div className="text-[10px] px-2 py-1 rounded-md" style={{ background: "rgba(255,255,255,0.8)", color: "#999" }}>
                Click derecho = opciones &nbsp;|&nbsp; Doble click = editar &nbsp;|&nbsp; Delete = eliminar seleccion
              </div>
            </Panel>

            {/* Empty state */}
            {nodes.length === 0 && (
              <Panel position="top-center" className="mt-24">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(74,234,170,0.1)", border: "1px solid rgba(74,234,170,0.2)" }}>
                    <IconSpark className="w-7 h-7 text-brand-mint" />
                  </div>
                  <p className="text-sm font-medium" style={{ color: "#555" }}>Describe tu app para generar el mapa de pantallas</p>
                  <p className="text-xs mt-1.5" style={{ color: "#999" }}>Cada nodo es una pantalla, cada conexion es navegacion</p>
                  <div className="flex items-center justify-center gap-4 mt-4">
                    {Object.entries(NODE_COLORS).slice(0, 7).map(([key, c]) => (
                      <div key={key} className="flex flex-col items-center gap-1">
                        <div className="w-3 h-3 rounded-full" style={{ background: c.accent }} />
                        <span className="text-[9px]" style={{ color: "#aaa" }}>{COLOR_NAMES[key]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <NodeContextMenu
          data={contextMenu}
          onClose={() => setContextMenu(null)}
          onEdit={handleContextEdit}
          onChangeColor={handleContextChangeColor}
          onDuplicate={handleContextDuplicate}
          onAddChild={handleContextAddChild}
          onDelete={handleContextDelete}
        />
      )}
    </div>
  );
}

// ─── Wrapper with Provider ───────────────────────────────────────────────────

export default function DesignTab() {
  return (
    <ReactFlowProvider>
      <DesignTabInner />
    </ReactFlowProvider>
  );
}
