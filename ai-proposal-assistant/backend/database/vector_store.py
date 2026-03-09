import json
from datetime import datetime, timezone
from database.supabase_client import SupabaseClient
from utils.logger import logger


class VectorStore:
    def __init__(self, db: SupabaseClient):
        self.db = db

    async def store_embedding(
        self,
        content: str,
        embedding: list[float],
        metadata: dict,
    ) -> None:
        logger.info("Storing embedding in vector store...")
        data = {
            "content": content,
            "embedding": embedding,
            "metadata": json.dumps(metadata, ensure_ascii=False),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self.db.client.table("embeddings").insert(data).execute()

    async def similarity_search(
        self,
        query_embedding: list[float],
        limit: int = 3,
        threshold: float = 0.7,
    ) -> list[dict]:
        logger.info("Performing similarity search...")
        result = self.db.client.rpc(
            "match_embeddings",
            {
                "query_embedding": query_embedding,
                "match_threshold": threshold,
                "match_count": limit,
            },
        ).execute()

        if not result.data:
            return []

        entries = []
        for row in result.data:
            metadata = row.get("metadata", {})
            if isinstance(metadata, str):
                metadata = json.loads(metadata)
            entries.append({
                "content": row.get("content", ""),
                "metadata": metadata,
                "similarity": row.get("similarity", 0),
            })

        return entries
