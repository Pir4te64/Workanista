const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Analysis {
  project_type: string;
  technologies: string[];
  client_technical_level: string;
  complexity: string;
  urgency: string;
  suggested_architecture: string;
  suggested_price_min?: number;
  suggested_price_max?: number;
  price_reasoning?: string;
}

export interface ProposalResponse {
  proposal_id: string;
  analysis: Analysis;
  response: string;
}

export interface Proposal {
  id: string;
  client_text: string;
  analysis: string;
  created_at: string;
  responses: {
    id: string;
    response_text: string;
    result: string;
    price_charged: number | null;
    created_at: string;
  }[];
}

export interface DuplicateCheck {
  is_duplicate: boolean;
  similarity?: number;
  original_text?: string;
}

export async function checkDuplicate(text: string): Promise<DuplicateCheck> {
  const res = await fetch(`${API_BASE}/check-duplicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return { is_duplicate: false };
  return res.json();
}

export async function analyzeProposal(text: string): Promise<ProposalResponse> {
  const res = await fetch(`${API_BASE}/analyze-proposal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("Error al analizar la propuesta");
  return res.json();
}

export async function getProposals(): Promise<Proposal[]> {
  const res = await fetch(`${API_BASE}/proposals`);
  if (!res.ok) throw new Error("Error al obtener propuestas");
  const data = await res.json();
  return data.proposals;
}

export async function markResult(
  proposalId: string,
  result: "won" | "lost" | "no_response"
): Promise<void> {
  const res = await fetch(`${API_BASE}/mark-result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proposal_id: proposalId, result }),
  });
  if (!res.ok) throw new Error("Error al marcar resultado");
}

export interface AnalyticsData {
  total_proposals: number;
  results: Record<string, number>;
  win_rate: number;
  total_revenue: number;
  avg_price: number;
  project_types: { type: string; won: number; lost: number; no_response: number; total: number; win_rate: number }[];
  technologies: { tech: string; count: number; won: number; win_rate: number }[];
  complexities: Record<string, number>;
  urgencies: Record<string, number>;
  client_tech_levels: Record<string, number>;
  monthly_timeline: { month: string; total: number; won: number; lost: number; no_response: number; revenue: number }[];
  price_accuracy: { charged: number; suggested_min: number; suggested_max: number }[];
}

export async function getAnalytics(): Promise<AnalyticsData> {
  const res = await fetch(`${API_BASE}/analytics`);
  if (!res.ok) throw new Error("Error al obtener analytics");
  return res.json();
}

export async function updatePrice(
  proposalId: string,
  priceCharged: number
): Promise<void> {
  const res = await fetch(`${API_BASE}/update-price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proposal_id: proposalId, price_charged: priceCharged }),
  });
  if (!res.ok) throw new Error("Error al actualizar precio");
}
