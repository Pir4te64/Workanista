from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from services.proposal_analyzer import ProposalAnalyzer
from services.proposal_generator import ProposalGenerator
from services.embedding_service import EmbeddingService
from services.memory_service import MemoryService
from services.coldduck.coldduck_service import ColdDuckService
from services.google_calendar_service import GoogleCalendarService
from services.planning_service import PlanningService
from services.scrum_service import ScrumService
from services.diagram_service import DiagramService
from database.supabase_client import SupabaseClient
from database.vector_store import VectorStore
from utils.logger import logger
import os

app = FastAPI(title="AI Proposal Assistant", version="1.0.0")

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3004").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = SupabaseClient()
vector_store = VectorStore(db)
embedding_service = EmbeddingService()
memory_service = MemoryService(db, vector_store, embedding_service)
analyzer = ProposalAnalyzer()
generator = ProposalGenerator()
coldduck = ColdDuckService(db)
google_cal = GoogleCalendarService(db)
planning_svc = PlanningService(db)
scrum_svc = ScrumService(db)
diagram_svc = DiagramService(db)


class ProposalRequest(BaseModel):
    text: str


class MarkResultRequest(BaseModel):
    proposal_id: str
    result: str  # won | lost | no_response


class UpdatePriceRequest(BaseModel):
    proposal_id: str
    price_charged: float


class CheckDuplicateRequest(BaseModel):
    text: str


class ColdDuckRequest(BaseModel):
    linkedin_url: str = ""
    profile_text: str = ""  # Manual mode: paste profile text directly
    tone: str = "profesional y cercano"
    goal: str = "ofrecer servicios de desarrollo de software a medida"
    generate_video: bool = False
    avatar_id: str = "default"
    voice_id: str = "default"


class ColdDuckResultRequest(BaseModel):
    outreach_id: str
    result: str  # replied | ignored | connected | meeting


class ColdDuckVideoStatusRequest(BaseModel):
    video_id: str
    outreach_id: str


class ColdDuckMessageRequest(BaseModel):
    outreach_id: str
    sender: str  # 'me' or 'client'
    content: str


@app.post("/check-duplicate")
async def check_duplicate(request: CheckDuplicateRequest):
    try:
        embedding = await embedding_service.generate_embedding(request.text)
        similar = await vector_store.similarity_search(
            embedding, limit=1, threshold=0.92
        )
        if similar:
            return {
                "is_duplicate": True,
                "similarity": round(similar[0]["similarity"], 2),
                "original_text": similar[0]["content"][:200],
            }
        return {"is_duplicate": False}
    except Exception as e:
        logger.error(f"Error checking duplicate: {e}")
        return {"is_duplicate": False}


@app.post("/analyze-proposal")
async def analyze_proposal(request: ProposalRequest):
    try:
        logger.info("Analyzing proposal...")

        # 1. Generate embedding and find similar proposals
        embedding = await embedding_service.generate_embedding(request.text)
        similar_proposals = await vector_store.similarity_search(embedding)

        # 2. Build pricing context from similar proposals
        pricing_context = memory_service.build_pricing_context(similar_proposals)

        # 3. Analyze the proposal with pricing context
        analysis = await analyzer.analyze(request.text, pricing_context)

        # 4. Generate optimized response
        response_text = await generator.generate(
            client_text=request.text,
            analysis=analysis,
            similar_proposals=similar_proposals,
        )

        # 5. Save everything to Supabase
        proposal_id = await memory_service.save_proposal(
            client_text=request.text,
            analysis=analysis,
            response_text=response_text,
            embedding=embedding,
        )

        logger.info(f"Proposal processed successfully: {proposal_id}")

        return {
            "proposal_id": proposal_id,
            "analysis": analysis,
            "response": response_text,
        }

    except Exception as e:
        logger.error(f"Error processing proposal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/proposals")
async def get_proposals():
    try:
        proposals = await memory_service.get_all_proposals()
        return {"proposals": proposals}
    except Exception as e:
        logger.error(f"Error fetching proposals: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/mark-result")
async def mark_result(request: MarkResultRequest):
    if request.result not in ("won", "lost", "no_response"):
        raise HTTPException(
            status_code=400,
            detail="Result must be 'won', 'lost', or 'no_response'",
        )
    try:
        await memory_service.mark_result(request.proposal_id, request.result)
        return {"status": "ok", "proposal_id": request.proposal_id, "result": request.result}
    except Exception as e:
        logger.error(f"Error marking result: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analytics")
async def get_analytics():
    """Compute KPIs from all proposals for the analytics dashboard."""
    try:
        proposals = await memory_service.get_all_proposals()
        import json as _json
        from collections import Counter, defaultdict

        total = len(proposals)
        results_count = Counter()
        project_types = Counter()
        technologies = Counter()
        complexities = Counter()
        urgencies = Counter()
        tech_levels = Counter()
        monthly_counts: dict[str, dict] = defaultdict(lambda: {"total": 0, "won": 0, "lost": 0, "no_response": 0, "revenue": 0.0})
        total_revenue = 0.0
        prices_charged: list[float] = []
        price_accuracy: list[dict] = []
        # per project_type win tracking
        type_results: dict[str, dict] = defaultdict(lambda: {"won": 0, "lost": 0, "no_response": 0, "total": 0})
        tech_results: dict[str, dict] = defaultdict(lambda: {"won": 0, "lost": 0, "total": 0})

        for p in proposals:
            response = p.get("responses", [{}])[0] if p.get("responses") else {}
            result = response.get("result", "no_response")
            price = response.get("price_charged")
            results_count[result] += 1

            # Monthly
            created = p.get("created_at", "")[:7]  # YYYY-MM
            if created:
                monthly_counts[created]["total"] += 1
                monthly_counts[created][result] += 1
                if price:
                    monthly_counts[created]["revenue"] += price

            # Revenue
            if price:
                total_revenue += price
                prices_charged.append(price)

            # Parse analysis
            try:
                analysis = _json.loads(p.get("analysis", "{}")) if isinstance(p.get("analysis"), str) else (p.get("analysis") or {})
            except Exception:
                analysis = {}

            pt = analysis.get("project_type", "")
            if pt:
                project_types[pt] += 1
                type_results[pt]["total"] += 1
                type_results[pt][result] += 1

            techs = analysis.get("technologies", [])
            if isinstance(techs, list):
                for t in techs:
                    technologies[t] += 1
                    tech_results[t]["total"] += 1
                    if result in ("won", "lost"):
                        tech_results[t][result] += 1

            comp = analysis.get("complexity", "")
            if comp:
                complexities[comp] += 1

            urg = analysis.get("urgency", "")
            if urg:
                urgencies[urg] += 1

            tl = analysis.get("client_technical_level", "")
            if tl:
                tech_levels[tl] += 1

            # Price accuracy
            if price and analysis.get("suggested_price_min") is not None:
                price_accuracy.append({
                    "charged": price,
                    "suggested_min": analysis["suggested_price_min"],
                    "suggested_max": analysis.get("suggested_price_max", analysis["suggested_price_min"]),
                })

        # Build sorted monthly timeline
        monthly_sorted = sorted(monthly_counts.items())
        monthly_timeline = [{"month": m, **d} for m, d in monthly_sorted]

        # Win rate by type
        type_win_rates = []
        for pt, counts in type_results.items():
            decided = counts["won"] + counts["lost"]
            win_rate = round((counts["won"] / decided * 100) if decided > 0 else 0, 1)
            type_win_rates.append({"type": pt, "won": counts["won"], "lost": counts["lost"], "no_response": counts["no_response"], "total": counts["total"], "win_rate": win_rate})
        type_win_rates.sort(key=lambda x: x["total"], reverse=True)

        # Top technologies with win rate
        tech_stats = []
        for t, count in technologies.most_common(15):
            decided = tech_results[t]["won"] + tech_results[t]["lost"]
            win_rate = round((tech_results[t]["won"] / decided * 100) if decided > 0 else 0, 1)
            tech_stats.append({"tech": t, "count": count, "won": tech_results[t]["won"], "win_rate": win_rate})

        won = results_count.get("won", 0)
        lost = results_count.get("lost", 0)
        decided = won + lost
        overall_win_rate = round((won / decided * 100) if decided > 0 else 0, 1)
        avg_price = round(sum(prices_charged) / len(prices_charged), 2) if prices_charged else 0

        return {
            "total_proposals": total,
            "results": dict(results_count),
            "win_rate": overall_win_rate,
            "total_revenue": round(total_revenue, 2),
            "avg_price": avg_price,
            "project_types": type_win_rates,
            "technologies": tech_stats,
            "complexities": dict(complexities),
            "urgencies": dict(urgencies),
            "client_tech_levels": dict(tech_levels),
            "monthly_timeline": monthly_timeline,
            "price_accuracy": price_accuracy,
        }
    except Exception as e:
        logger.error(f"Error computing analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/update-price")
async def update_price(request: UpdatePriceRequest):
    try:
        await memory_service.update_price(request.proposal_id, request.price_charged)
        return {"status": "ok", "proposal_id": request.proposal_id, "price_charged": request.price_charged}
    except Exception as e:
        logger.error(f"Error updating price: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ColdDuck Endpoints ====================


@app.post("/coldduck/outreach")
async def coldduck_outreach(request: ColdDuckRequest):
    try:
        result = await coldduck.process_outreach(
            linkedin_url=request.linkedin_url,
            profile_text=request.profile_text,
            tone=request.tone,
            goal=request.goal,
            generate_video=request.generate_video,
            avatar_id=request.avatar_id,
            voice_id=request.voice_id,
        )
        return result
    except Exception as e:
        logger.error(f"ColdDuck error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/coldduck/outreach")
async def coldduck_get_outreach():
    try:
        outreach = await coldduck.get_all_outreach()
        return {"outreach": outreach}
    except Exception as e:
        logger.error(f"ColdDuck fetch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/coldduck/mark-result")
async def coldduck_mark_result(request: ColdDuckResultRequest):
    valid = ("replied", "ignored", "connected", "meeting", "pending")
    if request.result not in valid:
        raise HTTPException(status_code=400, detail=f"Result must be one of: {', '.join(valid)}")
    try:
        await coldduck.mark_outreach_result(request.outreach_id, request.result)
        return {"status": "ok", "outreach_id": request.outreach_id, "result": request.result}
    except Exception as e:
        logger.error(f"ColdDuck mark error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/coldduck/video-status")
async def coldduck_video_status(request: ColdDuckVideoStatusRequest):
    try:
        status = await coldduck.check_video_status(request.video_id, request.outreach_id)
        return status
    except Exception as e:
        logger.error(f"ColdDuck video status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/coldduck/avatars")
async def coldduck_avatars():
    try:
        avatars = await coldduck.get_avatars()
        return {"avatars": avatars}
    except Exception as e:
        logger.error(f"ColdDuck avatars error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/coldduck/voices")
async def coldduck_voices():
    try:
        voices = await coldduck.get_voices()
        return {"voices": voices}
    except Exception as e:
        logger.error(f"ColdDuck voices error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ColdDuck Messages ====================


@app.post("/coldduck/messages")
async def coldduck_add_message(request: ColdDuckMessageRequest):
    if request.sender not in ("me", "client"):
        raise HTTPException(status_code=400, detail="Sender must be 'me' or 'client'")
    try:
        result = db.client.table("coldduck_messages").insert({
            "outreach_id": request.outreach_id,
            "sender": request.sender,
            "content": request.content,
        }).execute()
        return {"status": "ok", "message": result.data[0]}
    except Exception as e:
        logger.error(f"ColdDuck message error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/coldduck/messages/{outreach_id}")
async def coldduck_get_messages(outreach_id: str):
    try:
        result = db.client.table("coldduck_messages").select("*").eq(
            "outreach_id", outreach_id
        ).order("created_at", desc=False).execute()
        return {"messages": result.data}
    except Exception as e:
        logger.error(f"ColdDuck messages fetch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/coldduck/messages/{message_id}")
async def coldduck_delete_message(message_id: str):
    try:
        db.client.table("coldduck_messages").delete().eq("id", message_id).execute()
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"ColdDuck message delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Budget / Proposal Generator ====================


class BudgetSaveRequest(BaseModel):
    data: dict
    budget_id: Optional[str] = None  # If provided, update existing


class BudgetGenerateRequest(BaseModel):
    raw_text: str
    currency: str = "USD"


@app.post("/budget/generate")
async def budget_generate(request: BudgetGenerateRequest):
    """Takes raw client text and structures it into a proposal, without inventing anything."""
    from openai import AsyncOpenAI
    from config import OPENAI_API_KEY, MODEL_NAME
    import json as _json

    client = AsyncOpenAI(api_key=OPENAI_API_KEY)

    system_prompt = """Sos un asistente que estructura propuestas tecnicas para CruzNegraDev LLC.

REGLA CRITICA: NO INVENTES NADA. Solo organiza y da formato a la informacion que el usuario te proporciona.
- Si el texto del cliente menciona fases, respeta esas fases exactamente.
- Si menciona tecnologias, usalas tal cual. NO agregues tecnologias que no estan en el texto.
- Si menciona precios, horas o tarifas, usalos exactamente. NO inventes precios.
- Si algo no esta en el texto (por ejemplo no hay entregables), deja ese campo como array vacio.
- Si el texto es ambiguo, usa exactamente las palabras del cliente.
- Firma siempre como: Victor Manuel Moreira - CruzNegraDev LLC

Responde UNICAMENTE con un JSON valido (sin markdown, sin comentarios) con esta estructura:
{
  "clientName": "nombre del cliente si aparece en el texto, sino vacio",
  "clientEmail": "email si aparece, sino vacio",
  "projectName": "nombre del proyecto extraido del texto",
  "documentType": "Hoja de Ruta del Proyecto",
  "phases": [
    {
      "name": "FASE 1 — nombre de la fase",
      "subtitle": "Duracion y tecnologias mencionadas",
      "objective": "objetivo de la fase tal como lo describe el cliente",
      "sections": [
        {
          "title": "Titulo de la seccion",
          "bullets": ["punto 1 tal cual del texto", "punto 2"]
        }
      ]
    }
  ],
  "deliverables": ["entregable 1", "entregable 2"],
  "budgetIntro": "texto introductorio del presupuesto basado en lo que dice el cliente",
  "budgetItems": [
    {
      "concept": "concepto",
      "hours": "160 hrs",
      "rate": "$17.00/hr",
      "subtotal": "$2,720.00 USD"
    }
  ],
  "totalLabel": "INVERSION TOTAL DEL PROYECTO",
  "totalValue": "monto total si se menciona",
  "costNote": "nota aclaratoria si es relevante",
  "paymentTerms": "condiciones de pago si se mencionan"
}"""

    try:
        response = await client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Estructura esta propuesta en formato JSON. Moneda: {request.currency}.\n\nTexto del cliente:\n{request.raw_text}"},
            ],
            temperature=0.1,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content or "{}"
        result = _json.loads(content)
        return result

    except Exception as e:
        logger.error(f"Budget generate error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Budget CRUD ====================


@app.post("/budgets")
async def save_budget(request: BudgetSaveRequest):
    """Save or update a budget document."""
    try:
        budget_data = request.data
        row = {
            "client_name": budget_data.get("clientName", ""),
            "project_name": budget_data.get("projectName", ""),
            "data": budget_data,
        }

        if request.budget_id:
            result = (
                db.client.table("budgets")
                .update(row)
                .eq("id", request.budget_id)
                .execute()
            )
        else:
            result = db.client.table("budgets").insert(row).execute()

        saved = result.data[0] if result.data else {}
        return {"status": "ok", "budget": saved}
    except Exception as e:
        logger.error(f"Budget save error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/budgets")
async def list_budgets():
    """List all saved budgets (summary only)."""
    try:
        result = (
            db.client.table("budgets")
            .select("id, client_name, project_name, created_at, updated_at")
            .order("updated_at", desc=True)
            .execute()
        )
        return {"budgets": result.data}
    except Exception as e:
        logger.error(f"Budget list error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/budgets/analytics")
async def budget_analytics():
    """Compute pricing KPIs from all saved budgets + AI market suggestions."""
    from openai import AsyncOpenAI
    from config import OPENAI_API_KEY, MODEL_NAME
    import json as _json
    import re

    try:
        result = db.client.table("budgets").select("data").execute()
        budgets = result.data or []

        if not budgets:
            return {
                "kpis": {
                    "total_budgets": 0,
                    "avg_hourly_rate": 0,
                    "min_hourly_rate": 0,
                    "max_hourly_rate": 0,
                    "avg_total": 0,
                    "total_billed": 0,
                    "currencies": {},
                },
                "budget_summary": [],
                "ai_analysis": None,
            }

        # Extract pricing data from all budgets
        rates: list[float] = []
        totals: list[float] = []
        budget_summaries = []
        currencies: dict[str, int] = {}

        def parse_number(s: str) -> float:
            """Extract numeric value from strings like '$17.00/hr', '$2,720.00 USD', etc."""
            if not s:
                return 0.0
            cleaned = re.sub(r"[^\d.,]", "", s.replace(",", ""))
            try:
                return float(cleaned) if cleaned else 0.0
            except ValueError:
                return 0.0

        for b in budgets:
            data = b.get("data", {})
            currency = data.get("currency", "USD")
            currencies[currency] = currencies.get(currency, 0) + 1

            budget_rates = []
            budget_total = parse_number(data.get("totalValue", ""))

            for item in data.get("budgetItems", []):
                rate_val = parse_number(item.get("rate", ""))
                subtotal_val = parse_number(item.get("subtotal", ""))
                if rate_val > 0:
                    rates.append(rate_val)
                    budget_rates.append(rate_val)
                if subtotal_val > 0:
                    totals.append(subtotal_val)

            if budget_total > 0:
                totals_sum = budget_total
            else:
                totals_sum = sum(parse_number(item.get("subtotal", "")) for item in data.get("budgetItems", []))

            budget_summaries.append({
                "project": data.get("projectName", "Sin nombre"),
                "client": data.get("clientName", ""),
                "currency": currency,
                "rates": budget_rates,
                "avg_rate": round(sum(budget_rates) / len(budget_rates), 2) if budget_rates else 0,
                "total": round(totals_sum, 2),
            })

        kpis = {
            "total_budgets": len(budgets),
            "avg_hourly_rate": round(sum(rates) / len(rates), 2) if rates else 0,
            "min_hourly_rate": round(min(rates), 2) if rates else 0,
            "max_hourly_rate": round(max(rates), 2) if rates else 0,
            "avg_total": round(sum(totals) / len(totals), 2) if totals else 0,
            "total_billed": round(sum(t["total"] for t in budget_summaries), 2),
            "currencies": currencies,
        }

        # AI analysis - market comparison
        summary_text = _json.dumps(budget_summaries, ensure_ascii=False, indent=2)

        client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        ai_response = await client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": """Sos un consultor de pricing para empresas de desarrollo de software en LATAM.

Analiza los presupuestos que te paso y responde en JSON con esta estructura exacta:
{
  "market_position": "bajo|competitivo|alto" (comparando con el mercado LATAM de desarrollo de software),
  "market_range_min": numero (tarifa hora minima del mercado LATAM en USD para este tipo de servicios),
  "market_range_max": numero (tarifa hora maxima del mercado LATAM en USD),
  "score": numero del 1 al 10 (que tan bien estan posicionados los precios),
  "summary": "Resumen corto de 2-3 oraciones sobre el posicionamiento",
  "suggestions": ["sugerencia 1", "sugerencia 2", "sugerencia 3"],
  "risks": ["riesgo 1 si los precios son bajos", "riesgo 2"],
  "opportunities": ["oportunidad 1", "oportunidad 2"]
}

Contexto del mercado LATAM 2024-2025:
- Desarrolladores junior LATAM: $8-15/hr
- Desarrolladores mid LATAM: $15-30/hr
- Desarrolladores senior LATAM: $30-60/hr
- Tech leads / arquitectos LATAM: $50-100/hr
- Agencias boutique LATAM: $20-50/hr
- Empresas US que tercerizan a LATAM: $35-80/hr

Compara con estos rangos y da recomendaciones concretas y accionables.
Responde UNICAMENTE con JSON valido."""},
                {"role": "user", "content": f"Analiza estos {len(budget_summaries)} presupuestos de CruzNegraDev LLC:\n\n{summary_text}"},
            ],
            temperature=0.3,
            response_format={"type": "json_object"},
        )

        ai_content = ai_response.choices[0].message.content or "{}"
        ai_analysis = _json.loads(ai_content)

        return {
            "kpis": kpis,
            "budget_summary": budget_summaries,
            "ai_analysis": ai_analysis,
        }

    except Exception as e:
        logger.error(f"Budget analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/budgets/{budget_id}")
async def get_budget(budget_id: str):
    """Get a single budget with full data."""
    try:
        result = (
            db.client.table("budgets")
            .select("*")
            .eq("id", budget_id)
            .single()
            .execute()
        )
        return {"budget": result.data}
    except Exception as e:
        logger.error(f"Budget get error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/budgets/{budget_id}")
async def delete_budget(budget_id: str):
    """Delete a budget."""
    try:
        db.client.table("budgets").delete().eq("id", budget_id).execute()
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Budget delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Google Calendar ====================


class CalendarEventRequest(BaseModel):
    email: str
    summary: str
    start: str  # ISO datetime
    end: str  # ISO datetime
    attendees: list[str] = []
    description: str = ""
    location: str = ""
    add_meet: bool = False


@app.get("/api/google/status")
async def google_status(email: str):
    try:
        connected = google_cal.is_connected(email)
        return {"connected": connected}
    except Exception as e:
        logger.error(f"Google status error: {e}")
        return {"connected": False}


@app.get("/api/google/auth-url")
async def google_auth_url(email: str):
    try:
        url = google_cal.get_auth_url(email)
        return {"url": url}
    except Exception as e:
        logger.error(f"Google auth URL error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/google/callback")
async def google_callback(code: str, state: str = ""):
    """OAuth callback - exchanges code for tokens and redirects to frontend."""
    from fastapi.responses import RedirectResponse
    try:
        google_cal.handle_callback(code, state)
        frontend_url = cors_origins[0] if cors_origins else "http://localhost:3004"
        return RedirectResponse(url=f"{frontend_url}?tab=calendar&google=connected")
    except Exception as e:
        logger.error(f"Google callback error: {e}")
        frontend_url = cors_origins[0] if cors_origins else "http://localhost:3004"
        return RedirectResponse(url=f"{frontend_url}?tab=calendar&google=error")


@app.get("/api/google/events")
async def google_events(email: str, time_min: str, time_max: str):
    try:
        events = google_cal.list_events(email, time_min, time_max)
        return {"events": events}
    except Exception as e:
        logger.error(f"Google events error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/google/events")
async def google_create_event(request: CalendarEventRequest):
    try:
        event_data = {
            "summary": request.summary,
            "start": {
                "dateTime": request.start,
                "timeZone": "America/Argentina/Buenos_Aires",
            },
            "end": {
                "dateTime": request.end,
                "timeZone": "America/Argentina/Buenos_Aires",
            },
        }
        if request.attendees:
            event_data["attendees"] = [{"email": a} for a in request.attendees]
        if request.description:
            event_data["description"] = request.description
        if request.location:
            event_data["location"] = request.location
        if request.add_meet:
            event_data["conferenceData"] = {
                "createRequest": {
                    "requestId": f"meet-{request.start}",
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            }

        event = google_cal.create_event(request.email, event_data, conference=request.add_meet)
        return {"event": event}
    except Exception as e:
        logger.error(f"Google create event error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/google/events/{event_id}")
async def google_delete_event(event_id: str, email: str):
    try:
        google_cal.delete_event(email, event_id)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Google delete event error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/google/availability")
async def google_availability(email: str, time_min: str, time_max: str):
    try:
        availability = google_cal.get_availability(email, time_min, time_max)
        return {"busy": availability}
    except Exception as e:
        logger.error(f"Google availability error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Planning ─────────────────────────────────────────────────────────────────

class PlanningGenerateRequest(BaseModel):
    project_description: str


class PlanningSaveRequest(BaseModel):
    project_name: str
    description: str
    data: dict
    planning_id: Optional[str] = None


class PlanningUpdateTasksRequest(BaseModel):
    tasks: list


@app.post("/plannings/generate")
async def planning_generate(request: PlanningGenerateRequest):
    try:
        data = await planning_svc.generate(request.project_description)
        return {"data": data}
    except Exception as e:
        logger.error(f"Planning generate error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/plannings")
async def planning_save(request: PlanningSaveRequest):
    try:
        record = planning_svc.save(
            project_name=request.project_name,
            description=request.description,
            data=request.data,
            planning_id=request.planning_id,
        )
        return {"planning": record}
    except Exception as e:
        logger.error(f"Planning save error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/plannings")
async def planning_list():
    try:
        plannings = planning_svc.list_all()
        return {"plannings": plannings}
    except Exception as e:
        logger.error(f"Planning list error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/plannings/{planning_id}")
async def planning_get(planning_id: str):
    try:
        record = planning_svc.get(planning_id)
        if not record:
            raise HTTPException(status_code=404, detail="Planning not found")
        return {"planning": record}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Planning get error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/plannings/{planning_id}/tasks")
async def planning_update_tasks(planning_id: str, request: PlanningUpdateTasksRequest):
    try:
        record = planning_svc.update_tasks(planning_id, request.tasks)
        return {"planning": record}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Planning update tasks error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/plannings/{planning_id}")
async def planning_delete(planning_id: str):
    try:
        planning_svc.delete(planning_id)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Planning delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Scrum ─────────────────────────────────────────────────────────────────────

class ScrumGenerateRequest(BaseModel):
    project_description: str


class ScrumSaveRequest(BaseModel):
    project_name: str
    client_name: str = ""
    description: str
    data: dict
    project_id: Optional[str] = None


class ScrumUpdateDataRequest(BaseModel):
    data: dict


@app.post("/scrum/generate")
async def scrum_generate(request: ScrumGenerateRequest):
    try:
        data = await scrum_svc.generate(request.project_description)
        return {"data": data}
    except Exception as e:
        logger.error(f"Scrum generate error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/scrum")
async def scrum_save(request: ScrumSaveRequest):
    try:
        record = scrum_svc.save(
            project_name=request.project_name,
            client_name=request.client_name,
            description=request.description,
            data=request.data,
            project_id=request.project_id,
        )
        return {"project": record}
    except Exception as e:
        logger.error(f"Scrum save error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/scrum")
async def scrum_list():
    try:
        projects = scrum_svc.list_all()
        return {"projects": projects}
    except Exception as e:
        logger.error(f"Scrum list error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/scrum/{project_id}")
async def scrum_get(project_id: str):
    try:
        record = scrum_svc.get(project_id)
        if not record:
            raise HTTPException(status_code=404, detail="Scrum project not found")
        return {"project": record}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Scrum get error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/scrum/{project_id}")
async def scrum_update(project_id: str, request: ScrumUpdateDataRequest):
    try:
        record = scrum_svc.update_data(project_id, request.data)
        return {"project": record}
    except Exception as e:
        logger.error(f"Scrum update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/scrum/{project_id}")
async def scrum_delete(project_id: str):
    try:
        scrum_svc.delete(project_id)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Scrum delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Diagrams ──────────────────────────────────────────────────────────────────


class DiagramGenerateRequest(BaseModel):
    description: str


class DiagramSaveRequest(BaseModel):
    title: str = "Sin título"
    description: str = ""
    nodes: list = []
    edges: list = []
    scrum_project_id: Optional[str] = None


class DiagramUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    nodes: Optional[list] = None
    edges: Optional[list] = None
    scrum_project_id: Optional[str] = None


@app.post("/api/diagrams/generate")
async def generate_diagram(request: DiagramGenerateRequest):
    """Generate a diagram from description using AI."""
    try:
        data = await diagram_svc.generate_diagram(request.description)
        return {"data": data}
    except Exception as e:
        logger.error(f"Diagram generate error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/diagrams")
async def list_diagrams():
    """List all saved diagrams."""
    try:
        diagrams = diagram_svc.list_all()
        return {"diagrams": diagrams}
    except Exception as e:
        logger.error(f"Diagram list error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/diagrams/{diagram_id}")
async def get_diagram(diagram_id: str):
    """Get a specific diagram."""
    try:
        record = diagram_svc.get(diagram_id)
        if not record:
            raise HTTPException(status_code=404, detail="Diagram not found")
        return {"diagram": record}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Diagram get error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/diagrams")
async def save_diagram(request: DiagramSaveRequest):
    """Save a diagram."""
    try:
        record = diagram_svc.save(
            title=request.title,
            description=request.description,
            nodes=request.nodes,
            edges=request.edges,
            scrum_project_id=request.scrum_project_id,
        )
        return {"diagram": record}
    except Exception as e:
        logger.error(f"Diagram save error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/diagrams/{diagram_id}")
async def update_diagram(diagram_id: str, request: DiagramUpdateRequest):
    """Update a diagram."""
    try:
        payload = {k: v for k, v in request.model_dump().items() if v is not None}
        record = diagram_svc.update(diagram_id, payload)
        return {"diagram": record}
    except Exception as e:
        logger.error(f"Diagram update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/diagrams/{diagram_id}")
async def delete_diagram(diagram_id: str):
    """Delete a diagram."""
    try:
        diagram_svc.delete(diagram_id)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Diagram delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)


class ScrumStatusRequest(BaseModel):
    status: str  # borrador | activo | completado


@app.patch("/scrum/{project_id}/status")
async def scrum_update_status(project_id: str, request: ScrumStatusRequest):
    try:
        if request.status not in ("borrador", "activo", "completado"):
            raise HTTPException(status_code=400, detail="Invalid status")
        payload: dict = {"status": request.status}
        if request.status == "activo":
            from datetime import datetime, timezone
            payload["started_at"] = datetime.now(timezone.utc).isoformat()
        result = (
            db.client.table("scrum_projects")
            .update(payload)
            .eq("id", project_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Project not found")
        return {"project": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Scrum status update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/scrum/active/list")
async def scrum_list_active():
    """Return all active projects with full data for the tracking view."""
    try:
        result = (
            db.client.table("scrum_projects")
            .select("*")
            .eq("status", "activo")
            .order("started_at", desc=True)
            .execute()
        )
        return {"projects": result.data or []}
    except Exception as e:
        logger.error(f"Scrum active list error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
