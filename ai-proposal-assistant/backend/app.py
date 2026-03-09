from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from services.proposal_analyzer import ProposalAnalyzer
from services.proposal_generator import ProposalGenerator
from services.embedding_service import EmbeddingService
from services.memory_service import MemoryService
from services.coldduck.coldduck_service import ColdDuckService
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
