from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from services.proposal_analyzer import ProposalAnalyzer
from services.proposal_generator import ProposalGenerator
from services.embedding_service import EmbeddingService
from services.memory_service import MemoryService
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


@app.post("/update-price")
async def update_price(request: UpdatePriceRequest):
    try:
        await memory_service.update_price(request.proposal_id, request.price_charged)
        return {"status": "ok", "proposal_id": request.proposal_id, "price_charged": request.price_charged}
    except Exception as e:
        logger.error(f"Error updating price: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
