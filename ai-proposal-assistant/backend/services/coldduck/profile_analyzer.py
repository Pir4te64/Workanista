import json
from pathlib import Path
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from config import MODEL_NAME, OPENAI_API_KEY
from utils.logger import logger


class ProfileAnalyzer:
    def __init__(self):
        self.llm = ChatOpenAI(
            model=MODEL_NAME,
            api_key=OPENAI_API_KEY,
            temperature=0.3,
        )
        prompt_path = Path(__file__).parent.parent.parent / "prompts" / "coldduck_analysis_prompt.txt"
        self.prompt_template = PromptTemplate(
            input_variables=["profile_data"],
            template=prompt_path.read_text(encoding="utf-8"),
        )
        self.chain = self.prompt_template | self.llm

    async def analyze(self, profile: dict) -> dict:
        """Analyze a LinkedIn profile to understand the person and find connection points."""
        logger.info(f"Analyzing profile: {profile.get('full_name', 'Unknown')}")

        profile_text = json.dumps(profile, ensure_ascii=False, indent=2)
        result = await self.chain.ainvoke({"profile_data": profile_text})
        content = result.content.strip()

        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()

        try:
            analysis = json.loads(content)
        except json.JSONDecodeError:
            logger.warning("Failed to parse profile analysis as JSON")
            analysis = {"raw_analysis": content}

        return analysis
