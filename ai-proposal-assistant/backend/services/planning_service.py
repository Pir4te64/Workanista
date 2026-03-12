"""
Planning service.

Handles AI-powered project planning generation and persistence.
"""

import json
import uuid
from pathlib import Path
from typing import Optional

from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate

from config import MODEL_NAME, OPENAI_API_KEY
from utils.logger import logger


class PlanningService:
    """Service for generating and managing AI project plannings."""

    def __init__(self, db):
        self.db = db
        self.llm = ChatOpenAI(
            model=MODEL_NAME,
            api_key=OPENAI_API_KEY,
            temperature=0.4,
        )
        prompt_path = Path(__file__).parent.parent / "prompts" / "planning_prompt.txt"
        self.prompt_template = PromptTemplate(
            input_variables=["project_description"],
            template=prompt_path.read_text(encoding="utf-8"),
        )
        self.chain = self.prompt_template | self.llm

    # ------------------------------------------------------------------ #
    #  AI Generation
    # ------------------------------------------------------------------ #

    async def generate(self, project_description: str) -> dict:
        """Generate a planning from a project description using AI."""
        logger.info("Generating planning for project description...")
        result = await self.chain.ainvoke({"project_description": project_description})
        content = result.content.strip()

        # Strip markdown code blocks if present
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()

        try:
            planning_data = json.loads(content)
        except json.JSONDecodeError:
            logger.error("Failed to parse planning JSON: %s", content[:200])
            raise ValueError("La IA no devolvió un JSON válido para la planificación")

        # Ensure all tasks have a status field (default: sin_comenzar)
        for task in planning_data.get("tasks", []):
            task.setdefault("status", "sin_comenzar")
            if not task.get("id"):
                task["id"] = f"task-{uuid.uuid4().hex[:8]}"

        logger.info("Planning generated with %d tasks", len(planning_data.get("tasks", [])))
        return planning_data

    # ------------------------------------------------------------------ #
    #  Persistence
    # ------------------------------------------------------------------ #

    def save(self, project_name: str, description: str, data: dict, planning_id: Optional[str] = None) -> dict:
        """Save or update a planning. Returns the saved record."""
        payload = {
            "project_name": project_name,
            "description": description,
            "data": data,
        }

        if planning_id:
            result = (
                self.db.client.table("plannings")
                .update(payload)
                .eq("id", planning_id)
                .execute()
            )
        else:
            result = self.db.client.table("plannings").insert(payload).execute()

        if not result.data:
            raise RuntimeError("Failed to save planning")

        return result.data[0]

    def list_all(self) -> list:
        """Return all plannings sorted by creation date desc (without full data)."""
        result = (
            self.db.client.table("plannings")
            .select("id, project_name, description, created_at, updated_at")
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []

    def get(self, planning_id: str) -> Optional[dict]:
        """Return a single planning by ID."""
        result = (
            self.db.client.table("plannings")
            .select("*")
            .eq("id", planning_id)
            .execute()
        )
        if not result.data:
            return None
        return result.data[0]

    def update_tasks(self, planning_id: str, tasks: list) -> dict:
        """Patch only the tasks array inside data JSONB."""
        current = self.get(planning_id)
        if not current:
            raise ValueError(f"Planning {planning_id} not found")

        updated_data = {**current["data"], "tasks": tasks}
        result = (
            self.db.client.table("plannings")
            .update({"data": updated_data})
            .eq("id", planning_id)
            .execute()
        )
        if not result.data:
            raise RuntimeError("Failed to update tasks")
        return result.data[0]

    def delete(self, planning_id: str) -> None:
        """Delete a planning by ID."""
        self.db.client.table("plannings").delete().eq("id", planning_id).execute()
        logger.info("Deleted planning %s", planning_id)
