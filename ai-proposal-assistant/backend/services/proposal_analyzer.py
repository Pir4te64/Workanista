import json
from pathlib import Path
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from config import MODEL_NAME, OPENAI_API_KEY
from utils.logger import logger


class ProposalAnalyzer:
    def __init__(self):
        self.llm = ChatOpenAI(
            model=MODEL_NAME,
            api_key=OPENAI_API_KEY,
            temperature=0.3,
        )
        prompt_path = Path(__file__).parent.parent / "prompts" / "analysis_prompt.txt"
        self.prompt_template = PromptTemplate(
            input_variables=["client_text", "pricing_context"],
            template=prompt_path.read_text(encoding="utf-8"),
        )
        self.chain = self.prompt_template | self.llm

    async def analyze(self, client_text: str, pricing_context: str = "") -> dict:
        logger.info("Running proposal analysis...")
        if not pricing_context:
            pricing_context = "No hay datos de precios anteriores todavia."
        result = await self.chain.ainvoke({
            "client_text": client_text,
            "pricing_context": pricing_context,
        })
        content = result.content.strip()

        # Extract JSON from the response
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()

        try:
            analysis = json.loads(content)
        except json.JSONDecodeError:
            logger.warning("Failed to parse analysis as JSON, returning raw text")
            analysis = {"raw_analysis": content}

        return analysis
