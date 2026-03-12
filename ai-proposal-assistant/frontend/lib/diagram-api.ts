const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface DiagramNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: { label: string; description?: string };
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
  label?: string;
}

export interface Diagram {
  id: string;
  title: string;
  description?: string;
  scrum_project_id?: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  created_at: string;
  updated_at: string;
}

export async function generateDiagram(description: string): Promise<{ nodes: DiagramNode[]; edges: DiagramEdge[] }> {
  const res = await fetch(`${API_BASE}/api/diagrams/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  if (!res.ok) throw new Error("Error al generar diagrama");
  return res.json();
}

export async function listDiagrams(): Promise<Diagram[]> {
  const res = await fetch(`${API_BASE}/api/diagrams`);
  if (!res.ok) throw new Error("Error al obtener diagramas");
  const json = await res.json();
  return json.diagrams;
}

export async function getDiagram(id: string): Promise<Diagram> {
  const res = await fetch(`${API_BASE}/api/diagrams/${id}`);
  if (!res.ok) throw new Error("Error al obtener diagrama");
  const json = await res.json();
  return json.diagram;
}

export async function saveDiagram(data: {
  title: string;
  description?: string;
  scrum_project_id?: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}): Promise<Diagram> {
  const res = await fetch(`${API_BASE}/api/diagrams`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Error al guardar diagrama");
  const json = await res.json();
  return json.diagram;
}

export async function updateDiagram(
  id: string,
  data: { title?: string; description?: string; nodes?: DiagramNode[]; edges?: DiagramEdge[] }
): Promise<Diagram> {
  const res = await fetch(`${API_BASE}/api/diagrams/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Error al actualizar diagrama");
  const json = await res.json();
  return json.diagram;
}

export async function deleteDiagram(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/diagrams/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Error al eliminar diagrama");
}
