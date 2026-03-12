"""
Diagram / Flowchart generation service.

Uses LangChain + OpenAI to generate React Flow compatible diagrams from
text descriptions, and provides CRUD operations via Supabase.
"""

import json
from pathlib import Path
from typing import Optional

from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate

from config import MODEL_NAME, OPENAI_API_KEY
from utils.logger import logger


class DiagramService:
    """Service for generating and managing AI-powered diagrams."""

    def __init__(self, db):
        self.db = db
        self.llm = ChatOpenAI(
            model=MODEL_NAME,
            api_key=OPENAI_API_KEY,
            temperature=0.3,
        )
        prompt_path = Path(__file__).parent.parent / "prompts" / "diagram_prompt.txt"
        self.prompt_template = PromptTemplate(
            input_variables=["description"],
            template=prompt_path.read_text(encoding="utf-8"),
        )
        self.chain = self.prompt_template | self.llm

    # ------------------------------------------------------------------ #
    #  AI Generation
    # ------------------------------------------------------------------ #

    async def generate_diagram(self, description: str) -> dict:
        """Generate flowchart nodes and edges from a text description."""
        logger.info("Generating diagram from description...")
        result = await self.chain.ainvoke({"description": description})
        content = result.content.strip()

        # Strip markdown fences if present
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()

        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            logger.error("Failed to parse diagram JSON: %s", content[:300])
            raise ValueError("La IA no devolvió un JSON válido para el diagrama")

        nodes = data.get("nodes", [])
        edges = data.get("edges", [])

        # Ensure proper vertical layout positioning
        for i, node in enumerate(nodes):
            if "position" not in node:
                node["position"] = {"x": 250, "y": i * 200}
            if "type" not in node:
                node["type"] = "custom"
            if "data" not in node:
                node["data"] = {"label": f"Step {node.get('id', i+1)}", "description": ""}

        # Ensure edge properties
        for edge in edges:
            edge.setdefault("type", "smoothstep")
            edge.setdefault("animated", True)

        logger.info("Diagram generated: %d nodes, %d edges", len(nodes), len(edges))
        return {"nodes": nodes, "edges": edges}

    # ------------------------------------------------------------------ #
    #  Persistence
    # ------------------------------------------------------------------ #

    def save(self, title: str, description: str, nodes: list, edges: list,
             scrum_project_id: Optional[str] = None) -> dict:
        """Save a new diagram."""
        payload = {
            "title": title,
            "description": description,
            "nodes": nodes,
            "edges": edges,
        }
        if scrum_project_id:
            payload["scrum_project_id"] = scrum_project_id

        result = self.db.client.table("diagrams").insert(payload).execute()
        if not result.data:
            raise RuntimeError("Failed to save diagram")
        return result.data[0]

    def list_all(self) -> list:
        """List all diagrams (summary only)."""
        result = (
            self.db.client.table("diagrams")
            .select("id, title, description, scrum_project_id, created_at, updated_at")
            .order("updated_at", desc=True)
            .execute()
        )
        return result.data or []

    def get(self, diagram_id: str) -> Optional[dict]:
        """Get a single diagram with full data."""
        result = (
            self.db.client.table("diagrams")
            .select("*")
            .eq("id", diagram_id)
            .execute()
        )
        if not result.data:
            return None
        return result.data[0]

    def update(self, diagram_id: str, data: dict) -> dict:
        """Update a diagram."""
        allowed_fields = {"title", "description", "nodes", "edges", "scrum_project_id"}
        payload = {k: v for k, v in data.items() if k in allowed_fields}

        result = (
            self.db.client.table("diagrams")
            .update(payload)
            .eq("id", diagram_id)
            .execute()
        )
        if not result.data:
            raise RuntimeError("Failed to update diagram")
        return result.data[0]

    def delete(self, diagram_id: str) -> None:
        """Delete a diagram."""
        self.db.client.table("diagrams").delete().eq("id", diagram_id).execute()
        logger.info("Deleted diagram %s", diagram_id)
