import json
from datetime import datetime, timezone
from database.supabase_client import SupabaseClient
from database.vector_store import VectorStore
from services.embedding_service import EmbeddingService
from utils.logger import logger


class MemoryService:
    def __init__(
        self,
        db: SupabaseClient,
        vector_store: VectorStore,
        embedding_service: EmbeddingService,
    ):
        self.db = db
        self.vector_store = vector_store
        self.embedding_service = embedding_service

    def build_pricing_context(self, similar_proposals: list[dict]) -> str:
        """Build pricing context from similar proposals for the analyzer."""
        if not similar_proposals:
            return "No hay datos de precios anteriores todavia."

        parts = []
        for prop in similar_proposals:
            metadata = prop.get("metadata", {})
            price = metadata.get("price_charged")
            result = metadata.get("result", "sin resultado")
            analysis = metadata.get("analysis", {})
            project_type = analysis.get("project_type", "N/A") if isinstance(analysis, dict) else "N/A"
            complexity = analysis.get("complexity", "N/A") if isinstance(analysis, dict) else "N/A"

            if price:
                parts.append(
                    f"- Proyecto similar ({project_type}, complejidad: {complexity}): "
                    f"${price} USD (resultado: {result})"
                )

        if not parts:
            return "Hay propuestas similares pero sin precios registrados todavia."

        return "Precios cobrados en proyectos similares:\n" + "\n".join(parts)

    async def save_proposal(
        self,
        client_text: str,
        analysis: dict,
        response_text: str,
        embedding: list[float],
    ) -> str:
        logger.info("Saving proposal to database...")

        # 1. Save proposal
        proposal_data = {
            "client_text": client_text,
            "analysis": json.dumps(analysis, ensure_ascii=False),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        proposal_result = self.db.client.table("proposals").insert(proposal_data).execute()
        proposal_id = proposal_result.data[0]["id"]

        # 2. Save response
        response_data = {
            "proposal_id": proposal_id,
            "response_text": response_text,
            "result": "no_response",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self.db.client.table("responses").insert(response_data).execute()

        # 3. Save embedding
        await self.vector_store.store_embedding(
            content=client_text,
            embedding=embedding,
            metadata={
                "proposal_id": proposal_id,
                "response_text": response_text,
                "analysis": analysis,
            },
        )

        return proposal_id

    async def get_all_proposals(self) -> list[dict]:
        logger.info("Fetching all proposals...")
        proposals = (
            self.db.client.table("proposals")
            .select("*, responses(*)")
            .order("created_at", desc=True)
            .execute()
        )
        return proposals.data

    async def mark_result(self, proposal_id: str, result: str) -> None:
        logger.info(f"Marking proposal {proposal_id} as {result}")
        self.db.client.table("responses").update(
            {"result": result}
        ).eq("proposal_id", proposal_id).execute()

        self._update_embedding_metadata(proposal_id, {"result": result})

    async def update_price(self, proposal_id: str, price_charged: float) -> None:
        logger.info(f"Updating price for proposal {proposal_id}: ${price_charged}")
        self.db.client.table("responses").update(
            {"price_charged": price_charged}
        ).eq("proposal_id", proposal_id).execute()

        self._update_embedding_metadata(proposal_id, {"price_charged": price_charged})

    def _update_embedding_metadata(self, proposal_id: str, updates: dict) -> None:
        """Update metadata in embeddings table for learning."""
        try:
            rows = (
                self.db.client.table("embeddings")
                .select("id, metadata")
                .filter("metadata->>proposal_id", "eq", proposal_id)
                .execute()
            )
            for row in rows.data:
                metadata = row.get("metadata", {})
                if isinstance(metadata, str):
                    metadata = json.loads(metadata)
                metadata.update(updates)
                self.db.client.table("embeddings").update(
                    {"metadata": json.dumps(metadata, ensure_ascii=False)}
                ).eq("id", row["id"]).execute()
        except Exception as e:
            logger.warning(f"Could not update embedding metadata: {e}")
