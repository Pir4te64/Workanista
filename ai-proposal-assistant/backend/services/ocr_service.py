"""
OCR Component Generator Service
Uses OpenAI GPT-4o vision to analyze UI images and generate React + Tailwind components.
"""

import os
import json
import re
from datetime import datetime
from openai import OpenAI
from utils.logger import logger

COMPONENTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "components-library")
INDEX_FILE = os.path.join(COMPONENTS_DIR, "index.json")

SYSTEM_PROMPT = """You are an expert React + Tailwind CSS developer. Your job is to analyze UI design images and generate production-ready React functional components.

Rules:
- Analyze the visual design carefully — colors, spacing, typography, layout, icons, shadows
- Generate a complete, self-contained React functional component using TypeScript
- Use ONLY Tailwind CSS classes (no inline styles, no CSS modules, no styled-components)
- Handle hover/active/focus states when appropriate
- Use realistic placeholder content that matches the design
- Return ONLY raw JSX/TSX code — no explanation, no markdown fences, no commentary
- Start directly with: const ComponentName = () => {
- End with export default ComponentName;
- If the design has icons, use simple SVG inline or describe them with Tailwind
- Make the component responsive when possible
- Use semantic HTML elements (nav, header, section, article, etc.)"""

REFINEMENT_PROMPT = """You are an expert React + Tailwind CSS developer. The user wants to refine an existing React component.

Current component code:
```tsx
{code}
```

Apply the user's correction and return the COMPLETE updated component code.
Rules:
- Return ONLY the full updated component code — no explanation, no markdown fences
- Start directly with: const ComponentName = () => {
- End with export default ComponentName;
- Use ONLY Tailwind CSS classes
- Preserve all existing functionality unless the user explicitly asks to change it"""


class OcrService:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = os.getenv("MODEL_NAME", "gpt-4o")

    def generate_component(self, image_base64: str, mime_type: str, description: str = "") -> str:
        """Generate a React component from an image using GPT-4o vision."""
        try:
            user_content = []

            # Add the image
            user_content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:{mime_type};base64,{image_base64}",
                    "detail": "high"
                }
            })

            # Add description if provided
            text_prompt = "Analyze this UI design image and generate a production-ready React + Tailwind CSS component that replicates it as closely as possible."
            if description:
                text_prompt += f"\n\nAdditional context from the user: {description}"

            user_content.append({
                "type": "text",
                "text": text_prompt
            })

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content}
                ],
                max_tokens=4096,
                temperature=0.2
            )

            code = response.choices[0].message.content.strip()
            # Clean markdown fences if model added them
            code = self._clean_code(code)
            return code

        except Exception as e:
            logger.error(f"Error generating component: {e}")
            raise

    def refine_component(self, code: str, correction: str, history: list = None) -> str:
        """Refine an existing component based on user feedback."""
        try:
            messages = [
                {"role": "system", "content": REFINEMENT_PROMPT.replace("{code}", code)}
            ]

            # Add conversation history if provided
            if history:
                for msg in history:
                    messages.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })

            messages.append({
                "role": "user",
                "content": correction
            })

            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=4096,
                temperature=0.2
            )

            code = response.choices[0].message.content.strip()
            code = self._clean_code(code)
            return code

        except Exception as e:
            logger.error(f"Error refining component: {e}")
            raise

    def save_component(self, name: str, code: str, tags: list = None, description: str = "") -> dict:
        """Save a component to the local library."""
        os.makedirs(COMPONENTS_DIR, exist_ok=True)

        # Load or create index
        index = self._load_index()

        # Save the .tsx file
        file_path = os.path.join(COMPONENTS_DIR, f"{name}.tsx")
        with open(file_path, "w") as f:
            f.write(code)

        # Update index
        entry = {
            "name": name,
            "tags": tags or [],
            "description": description,
            "created_at": datetime.now().isoformat(),
            "file": f"{name}.tsx"
        }

        # Replace if exists, otherwise append
        index = [c for c in index if c["name"] != name]
        index.append(entry)

        self._save_index(index)
        logger.info(f"Component '{name}' saved to library")
        return entry

    def list_components(self) -> list:
        """List all saved components."""
        return self._load_index()

    def get_component(self, name: str) -> dict:
        """Get a specific component's code and metadata."""
        index = self._load_index()
        meta = next((c for c in index if c["name"] == name), None)
        if not meta:
            return None

        file_path = os.path.join(COMPONENTS_DIR, f"{name}.tsx")
        if not os.path.exists(file_path):
            return None

        with open(file_path, "r") as f:
            code = f.read()

        return {**meta, "code": code}

    def delete_component(self, name: str) -> bool:
        """Delete a component from the library."""
        index = self._load_index()
        new_index = [c for c in index if c["name"] != name]

        if len(new_index) == len(index):
            return False

        file_path = os.path.join(COMPONENTS_DIR, f"{name}.tsx")
        if os.path.exists(file_path):
            os.remove(file_path)

        self._save_index(new_index)
        logger.info(f"Component '{name}' deleted from library")
        return True

    def _load_index(self) -> list:
        if os.path.exists(INDEX_FILE):
            with open(INDEX_FILE, "r") as f:
                return json.load(f)
        return []

    def _save_index(self, index: list):
        os.makedirs(COMPONENTS_DIR, exist_ok=True)
        with open(INDEX_FILE, "w") as f:
            json.dump(index, f, indent=2)

    def _clean_code(self, code: str) -> str:
        """Remove markdown fences if present."""
        code = re.sub(r'^```(?:tsx?|jsx?|react)?\s*\n?', '', code)
        code = re.sub(r'\n?```\s*$', '', code)
        return code.strip()
