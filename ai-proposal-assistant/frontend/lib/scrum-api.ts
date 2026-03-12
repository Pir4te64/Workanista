const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type StoryStatus = "pendiente" | "en_progreso" | "completada";
export type StoryPriority = "alta" | "media" | "baja";
export const FIBONACCI = [1, 2, 3, 5, 8, 13, 21] as const;

export interface UserStory {
  id: string;
  title: string;
  description: string;
  acceptance_criteria: string[];
  story_points: number;
  priority: StoryPriority;
  status: StoryStatus;
  assigned_to?: string;
}

export interface SprintDeliverable {
  id: string;
  title: string;
  description: string;
}

export interface Sprint {
  id: string;
  number: number;
  name: string;
  goal: string;
  duration_weeks: number;
  start_date: string;
  end_date: string;
  stories: UserStory[];
  deliverables: SprintDeliverable[];
}

export interface ScrumData {
  summary: string;
  recommended_velocity: number;
  total_estimated_points: number;
  sprints: Sprint[];
  notes?: string;
}

export interface ScrumSummary {
  id: string;
  project_name: string;
  client_name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface ScrumFull extends ScrumSummary {
  data: ScrumData;
}

export async function generateScrum(projectDescription: string): Promise<ScrumData> {
  const res = await fetch(`${API_BASE}/scrum/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_description: projectDescription }),
  });
  if (!res.ok) throw new Error("Error al generar el plan de sprints");
  const json = await res.json();
  return json.data;
}

export async function saveScrum(
  projectName: string,
  clientName: string,
  description: string,
  data: ScrumData,
  projectId?: string
): Promise<ScrumFull> {
  const res = await fetch(`${API_BASE}/scrum`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_name: projectName,
      client_name: clientName,
      description,
      data,
      project_id: projectId || null,
    }),
  });
  if (!res.ok) throw new Error("Error al guardar el proyecto");
  const json = await res.json();
  return json.project;
}

export async function listScrum(): Promise<ScrumSummary[]> {
  const res = await fetch(`${API_BASE}/scrum`);
  if (!res.ok) throw new Error("Error al obtener proyectos");
  const json = await res.json();
  return json.projects;
}

export async function getScrum(projectId: string): Promise<ScrumFull> {
  const res = await fetch(`${API_BASE}/scrum/${projectId}`);
  if (!res.ok) throw new Error("Error al obtener proyecto");
  const json = await res.json();
  return json.project;
}

export async function updateScrumData(projectId: string, data: ScrumData): Promise<ScrumFull> {
  const res = await fetch(`${API_BASE}/scrum/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error("Error al actualizar proyecto");
  const json = await res.json();
  return json.project;
}

export async function deleteScrum(projectId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/scrum/${projectId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Error al eliminar proyecto");
}
