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

// ── Budgets ──

export interface BudgetSummary {
  id: string;
  client_name: string;
  project_name: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetFull {
  id: string;
  client_name: string;
  project_name: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function saveBudget(
  data: Record<string, unknown>,
  budgetId?: string
): Promise<BudgetFull> {
  const res = await fetch(`${API_BASE}/budgets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, budget_id: budgetId || null }),
  });
  if (!res.ok) throw new Error("Error al guardar presupuesto");
  const json = await res.json();
  return json.budget;
}

export async function listBudgets(): Promise<BudgetSummary[]> {
  const res = await fetch(`${API_BASE}/budgets`);
  if (!res.ok) throw new Error("Error al obtener presupuestos");
  const json = await res.json();
  return json.budgets;
}

export async function getBudget(budgetId: string): Promise<BudgetFull> {
  const res = await fetch(`${API_BASE}/budgets/${budgetId}`);
  if (!res.ok) throw new Error("Error al obtener presupuesto");
  const json = await res.json();
  return json.budget;
}

export async function deleteBudget(budgetId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/budgets/${budgetId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Error al eliminar presupuesto");
}

export interface BudgetAnalytics {
  kpis: {
    total_budgets: number;
    avg_hourly_rate: number;
    min_hourly_rate: number;
    max_hourly_rate: number;
    avg_total: number;
    total_billed: number;
    currencies: Record<string, number>;
  };
  budget_summary: {
    project: string;
    client: string;
    currency: string;
    rates: number[];
    avg_rate: number;
    total: number;
  }[];
  ai_analysis: {
    market_position: string;
    market_range_min: number;
    market_range_max: number;
    score: number;
    summary: string;
    suggestions: string[];
    risks: string[];
    opportunities: string[];
  } | null;
}

export async function getBudgetAnalytics(): Promise<BudgetAnalytics> {
  const res = await fetch(`${API_BASE}/budgets/analytics`);
  if (!res.ok) throw new Error("Error al obtener analytics de presupuestos");
  return res.json();
}
