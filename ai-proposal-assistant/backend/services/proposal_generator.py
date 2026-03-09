import json
from pathlib import Path
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from config import MODEL_NAME, OPENAI_API_KEY
from utils.logger import logger


class ProposalGenerator:
    def __init__(self):
        self.llm = ChatOpenAI(
            model=MODEL_NAME,
            api_key=OPENAI_API_KEY,
            temperature=0.7,
        )
        prompt_path = Path(__file__).parent.parent / "prompts" / "proposal_prompt.txt"
        self.prompt_template = PromptTemplate(
            input_variables=["client_text", "analysis", "similar_context"],
            template=prompt_path.read_text(encoding="utf-8"),
        )
        self.chain = self.prompt_template | self.llm

    async def generate(
        self,
        client_text: str,
        analysis: dict,
        similar_proposals: list[dict],
    ) -> str:
        logger.info("Generating optimized proposal response...")

        similar_context = self._format_similar_proposals(similar_proposals)
        analysis_text = json.dumps(analysis, ensure_ascii=False, indent=2)

        result = await self.chain.ainvoke({
            "client_text": client_text,
            "analysis": analysis_text,
            "similar_context": similar_context,
        })

        return result.content.strip()

    def _format_similar_proposals(self, similar_proposals: list[dict]) -> str:
        if not similar_proposals:
            return "No hay propuestas similares anteriores."

        parts = []
        for i, prop in enumerate(similar_proposals, 1):
            metadata = prop.get("metadata", {})
            result = metadata.get("result", "sin resultado")
            parts.append(
                f"Propuesta {i} (resultado: {result}):\n"
                f"  Texto: {prop.get('content', 'N/A')[:200]}...\n"
                f"  Respuesta: {metadata.get('response_text', 'N/A')[:200]}..."
            )
        return "\n\n".join(parts)
