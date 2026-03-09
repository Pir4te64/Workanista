from openai import AsyncOpenAI
from config import OPENAI_API_KEY, EMBEDDING_MODEL
from utils.logger import logger


class EmbeddingService:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        self.model = EMBEDDING_MODEL

    async def generate_embedding(self, text: str) -> list[float]:
        logger.info("Generating embedding...")
        response = await self.client.embeddings.create(
            model=self.model,
            input=text,
        )
        return response.data[0].embedding
