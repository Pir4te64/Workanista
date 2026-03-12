"""
Scrum Sprint Planning service.

Handles AI-powered sprint generation and CRUD operations for scrum projects.
"""

import json
import uuid
from pathlib import Path
from typing import Optional

from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate

from config import MODEL_NAME, OPENAI_API_KEY
from utils.logger import logger


class ScrumService:
    """Service for generating and managing Scrum sprint plans."""

    def __init__(self, db):
        self.db = db
        self.llm = ChatOpenAI(
            model=MODEL_NAME,
            api_key=OPENAI_API_KEY,
            temperature=0.4,
        )
        prompt_path = Path(__file__).parent.parent / "prompts" / "scrum_prompt.txt"
        self.prompt_template = PromptTemplate(
            input_variables=["project_description"],
            template=prompt_path.read_text(encoding="utf-8"),
        )
        self.chain = self.prompt_template | self.llm

    # ------------------------------------------------------------------ #
    #  AI Generation
    # ------------------------------------------------------------------ #

    async def generate(self, project_description: str) -> dict:
        """Generate a full sprint plan from a project description."""
        logger.info("Generating scrum sprint plan...")
        result = await self.chain.ainvoke({"project_description": project_description})
        content = result.content.strip()

        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()

        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            logger.error("Failed to parse scrum JSON: %s", content[:300])
            raise ValueError("La IA no devolvió un JSON válido para el plan de sprints")

        # Ensure IDs and statuses are present
        for sprint in data.get("sprints", []):
            if not sprint.get("id"):
                sprint["id"] = f"sprint-{uuid.uuid4().hex[:8]}"
            for story in sprint.get("stories", []):
                if not story.get("id"):
                    story["id"] = f"story-{uuid.uuid4().hex[:8]}"
                story.setdefault("status", "pendiente")
                story.setdefault("acceptance_criteria", [])
            for deliverable in sprint.get("deliverables", []):
                if not deliverable.get("id"):
                    deliverable["id"] = f"del-{uuid.uuid4().hex[:8]}"

        total = sum(
            s.get("story_points", 0)
            for sprint in data.get("sprints", [])
            for s in sprint.get("stories", [])
        )
        data["total_estimated_points"] = total
        logger.info("Scrum plan generated: %d sprints, %d total points",
                    len(data.get("sprints", [])), total)
        return data

    # ------------------------------------------------------------------ #
    #  Persistence
    # ------------------------------------------------------------------ #

    def save(self, project_name: str, client_name: str, description: str,
             data: dict, project_id: Optional[str] = None) -> dict:
        payload = {
            "project_name": project_name,
            "client_name": client_name,
            "description": description,
            "data": data,
        }
        if project_id:
            result = (
                self.db.client.table("scrum_projects")
                .update(payload)
                .eq("id", project_id)
                .execute()
            )
        else:
            result = self.db.client.table("scrum_projects").insert(payload).execute()

        if not result.data:
            raise RuntimeError("Failed to save scrum project")
        return result.data[0]

    def list_all(self) -> list:
        result = (
            self.db.client.table("scrum_projects")
            .select("id, project_name, client_name, description, created_at, updated_at")
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []

    def get(self, project_id: str) -> Optional[dict]:
        result = (
            self.db.client.table("scrum_projects")
            .select("*")
            .eq("id", project_id)
            .execute()
        )
        if not result.data:
            return None
        return result.data[0]

    def update_data(self, project_id: str, data: dict) -> dict:
        """Replace the full data JSONB (sprints, stories, etc)."""
        result = (
            self.db.client.table("scrum_projects")
            .update({"data": data})
            .eq("id", project_id)
            .execute()
        )
        if not result.data:
            raise RuntimeError("Failed to update scrum project data")
        return result.data[0]

    def delete(self, project_id: str) -> None:
        self.db.client.table("scrum_projects").delete().eq("id", project_id).execute()
        logger.info("Deleted scrum project %s", project_id)
