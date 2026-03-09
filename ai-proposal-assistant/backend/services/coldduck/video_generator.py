import httpx
from config import HEYGEN_API_KEY
from utils.logger import logger


class VideoGenerator:
    BASE_URL = "https://api.heygen.com"
    DEFAULT_AVATAR_ID = "2f02a0c1fa0b4595b94a9a1a075e73ab"  # Gabrielle (look prompt)
    DEFAULT_VOICE_ID = "e273b0dcbaf34113b177056e311dc2d2"  # Evelyn Harper - Friendly (English)

    def __init__(self):
        self.api_key = HEYGEN_API_KEY

    def _headers(self) -> dict:
        return {
            "X-Api-Key": self.api_key,
            "Content-Type": "application/json",
        }

    async def list_avatars(self) -> list[dict]:
        """List available HeyGen avatars."""
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{self.BASE_URL}/v2/avatars",
                headers=self._headers(),
            )
            response.raise_for_status()
            data = response.json()
            avatars = data.get("data", {}).get("avatars", [])
            return [
                {
                    "avatar_id": a.get("avatar_id"),
                    "avatar_name": a.get("avatar_name"),
                    "preview_image_url": a.get("preview_image_url"),
                }
                for a in avatars[:20]
            ]

    async def list_voices(self) -> list[dict]:
        """List available HeyGen voices."""
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{self.BASE_URL}/v2/voices",
                headers=self._headers(),
            )
            response.raise_for_status()
            data = response.json()
            voices = data.get("data", {}).get("voices", [])
            return [
                {
                    "voice_id": v.get("voice_id"),
                    "name": v.get("name"),
                    "language": v.get("language"),
                    "gender": v.get("gender"),
                    "preview_audio": v.get("preview_audio"),
                }
                for v in voices
                if v.get("language", "").startswith("es") or v.get("language", "").startswith("en")
            ]

    async def generate_video(
        self,
        script: str,
        avatar_id: str = "default",
        voice_id: str = "default",
    ) -> dict:
        """Start video generation with HeyGen API v2."""
        logger.info(f"Generating HeyGen video (avatar={avatar_id})...")

        if not self.api_key:
            raise ValueError("HEYGEN_API_KEY is not configured")

        if avatar_id == "default":
            avatar_id = self.DEFAULT_AVATAR_ID
        if voice_id == "default":
            voice_id = self.DEFAULT_VOICE_ID

        payload = {
            "video_inputs": [
                {
                    "character": {
                        "type": "avatar",
                        "avatar_id": avatar_id,
                        "avatar_style": "normal",
                    },
                    "voice": {
                        "type": "text",
                        "input_text": script,
                        "voice_id": voice_id,
                        "speed": 1.1,
                    },
                    "background": {
                        "type": "color",
                        "value": "#1a1a1a",
                    },
                }
            ],
            "dimension": {"width": 1280, "height": 720},
        }

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{self.BASE_URL}/v2/video/generate",
                headers=self._headers(),
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        video_id = data.get("data", {}).get("video_id", "")
        logger.info(f"Video generation started: {video_id}")

        return {
            "video_id": video_id,
            "status": "processing",
        }

    async def get_video_status(self, video_id: str) -> dict:
        """Check the status of a video generation."""
        logger.info(f"Checking video status: {video_id}")

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{self.BASE_URL}/v1/video_status.get",
                headers=self._headers(),
                params={"video_id": video_id},
            )
            response.raise_for_status()
            data = response.json()

        status_data = data.get("data", {})
        return {
            "video_id": video_id,
            "status": status_data.get("status", "unknown"),
            "video_url": status_data.get("video_url", ""),
            "thumbnail_url": status_data.get("thumbnail_url", ""),
            "duration": status_data.get("duration", 0),
        }
