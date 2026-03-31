const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface LinkedInProfile {
  full_name: string;
  headline: string;
  summary: string;
  industry: string;
  location: string;
  country: string;
  current_company: string;
  current_role: string;
  experiences: { company: string; title: string; description: string }[];
  skills: string[];
  languages: string[];
}

export interface ProfileAnalysis {
  person_summary: string;
  industry: string;
  role_level: string;
  company_size_guess: string;
  pain_points: string[];
  interests: string[];
  connection_hooks: string[];
  services_relevance: {
    software_a_medida: string;
    mobile_apps: string;
    ai_automation: string;
    saas: string;
    erp: string;
  };
  best_approach: string;
  language: string;
}

export interface VideoData {
  video_id: string;
  status: string;
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
}

export interface OutreachResponse {
  outreach_id: string;
  linkedin_url?: string;
  profile: LinkedInProfile;
  analysis: ProfileAnalysis;
  message: string;
  video: VideoData | null;
}

export interface OutreachMessage {
  id: string;
  outreach_id: string;
  sender: "me" | "client";
  content: string;
  created_at: string;
}

export interface OutreachRecord {
  id: string;
  linkedin_url: string;
  profile: LinkedInProfile;
  analysis: ProfileAnalysis;
  message: string;
  video_data: VideoData | null;
  result: string;
  created_at: string;
}

export interface Avatar {
  avatar_id: string;
  avatar_name: string;
  preview_image_url: string;
}

export interface Voice {
  voice_id: string;
  name: string;
  language: string;
  gender: string;
  preview_audio: string;
}

export async function processOutreach(params: {
  linkedin_url?: string;
  profile_text?: string;
  tone?: string;
  goal?: string;
  generate_video?: boolean;
  avatar_id?: string;
  voice_id?: string;
}): Promise<OutreachResponse> {
  const res = await fetch(`${API_BASE}/coldduck/outreach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Error procesando outreach" }));
    throw new Error(err.detail || "Error procesando outreach");
  }
  return res.json();
}

export async function getOutreach(): Promise<OutreachRecord[]> {
  const res = await fetch(`${API_BASE}/coldduck/outreach`);
  if (!res.ok) throw new Error("Error al obtener outreach");
  const data = await res.json();
  return data.outreach;
}

export async function markOutreachResult(
  outreachId: string,
  result: "replied" | "ignored" | "connected" | "meeting" | "pending" | "done"
): Promise<void> {
  const res = await fetch(`${API_BASE}/coldduck/mark-result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outreach_id: outreachId, result }),
  });
  if (!res.ok) throw new Error("Error al marcar resultado");
}

export async function checkVideoStatus(
  videoId: string,
  outreachId: string
): Promise<VideoData> {
  const res = await fetch(`${API_BASE}/coldduck/video-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_id: videoId, outreach_id: outreachId }),
  });
  if (!res.ok) throw new Error("Error checking video status");
  return res.json();
}

export async function deleteOutreach(outreachId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/coldduck/outreach/${outreachId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Error al eliminar outreach");
}

export async function getMessages(outreachId: string): Promise<OutreachMessage[]> {
  const res = await fetch(`${API_BASE}/coldduck/messages/${outreachId}`);
  if (!res.ok) throw new Error("Error al obtener mensajes");
  const data = await res.json();
  return data.messages;
}

export async function addMessage(
  outreachId: string,
  sender: "me" | "client",
  content: string
): Promise<OutreachMessage> {
  const res = await fetch(`${API_BASE}/coldduck/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outreach_id: outreachId, sender, content }),
  });
  if (!res.ok) throw new Error("Error al guardar mensaje");
  const data = await res.json();
  return data.message;
}

export async function deleteMessage(messageId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/coldduck/messages/${messageId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Error al eliminar mensaje");
}

export async function getAvatars(): Promise<Avatar[]> {
  const res = await fetch(`${API_BASE}/coldduck/avatars`);
  if (!res.ok) throw new Error("Error al obtener avatars");
  const data = await res.json();
  return data.avatars;
}

export async function getVoices(): Promise<Voice[]> {
  const res = await fetch(`${API_BASE}/coldduck/voices`);
  if (!res.ok) throw new Error("Error al obtener voices");
  const data = await res.json();
  return data.voices;
}
