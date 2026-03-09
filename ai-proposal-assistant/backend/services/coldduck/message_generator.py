from pathlib import Path
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from config import MODEL_NAME, OPENAI_API_KEY
from utils.logger import logger
import json


class OutreachMessageGenerator:
    SPANISH_COUNTRIES = {
        "argentina", "mexico", "méxico", "colombia", "chile", "peru", "perú",
        "ecuador", "venezuela", "uruguay", "paraguay", "bolivia", "costa rica",
        "panama", "panamá", "guatemala", "honduras", "el salvador", "nicaragua",
        "cuba", "dominican republic", "república dominicana", "puerto rico",
        "spain", "españa",
    }

    def __init__(self):
        self.llm = ChatOpenAI(
            model=MODEL_NAME,
            api_key=OPENAI_API_KEY,
            temperature=0.7,
        )
        prompts_dir = Path(__file__).parent.parent.parent / "prompts"

        self.message_template = PromptTemplate(
            input_variables=["profile_data", "analysis", "message_tone", "message_goal", "language_instruction"],
            template=(prompts_dir / "coldduck_message_prompt.txt").read_text(encoding="utf-8"),
        )
        self.message_chain = self.message_template | self.llm

        self.video_template = PromptTemplate(
            input_variables=["profile_data", "analysis"],
            template=(prompts_dir / "coldduck_video_script_prompt.txt").read_text(encoding="utf-8"),
        )
        self.video_chain = self.video_template | self.llm

    def _detect_language(self, profile: dict, analysis: dict) -> str:
        """Detect language: Spanish for LATAM/Spain, English otherwise."""
        lang = analysis.get("language", "")

        country = (profile.get("country") or "").lower()
        location = (profile.get("location") or "").lower()

        for sc in self.SPANISH_COUNTRIES:
            if sc in country or sc in location:
                return "es"

        if lang in ("es", "pt"):
            return lang

        return "en"

    async def generate(
        self,
        profile: dict,
        analysis: dict,
        tone: str = "profesional y cercano",
        goal: str = "ofrecer servicios de desarrollo de software a medida",
    ) -> str:
        """Generate a personalized outreach text message."""
        logger.info(f"Generating outreach message for: {profile.get('full_name', 'Unknown')}")

        lang = self._detect_language(profile, analysis)
        if lang == "en":
            language_instruction = "WRITE THE ENTIRE MESSAGE IN ENGLISH. The person is not a Spanish speaker."
        elif lang == "pt":
            language_instruction = "WRITE THE ENTIRE MESSAGE IN PORTUGUESE. The person speaks Portuguese."
        else:
            language_instruction = "Escribe todo el mensaje en ESPAÑOL. La persona habla español."

        logger.info(f"Detected language: {lang}")

        profile_text = json.dumps(profile, ensure_ascii=False, indent=2)
        analysis_text = json.dumps(analysis, ensure_ascii=False, indent=2)

        result = await self.message_chain.ainvoke({
            "profile_data": profile_text,
            "analysis": analysis_text,
            "message_tone": tone,
            "message_goal": goal,
            "language_instruction": language_instruction,
        })

        return result.content.strip()

    async def generate_video_script(
        self,
        profile: dict,
        analysis: dict,
    ) -> str:
        """Generate a short ~20 second video script in English."""
        logger.info(f"Generating video script for: {profile.get('full_name', 'Unknown')}")

        profile_text = json.dumps(profile, ensure_ascii=False, indent=2)
        analysis_text = json.dumps(analysis, ensure_ascii=False, indent=2)

        result = await self.video_chain.ainvoke({
            "profile_data": profile_text,
            "analysis": analysis_text,
        })

        return result.content.strip()
