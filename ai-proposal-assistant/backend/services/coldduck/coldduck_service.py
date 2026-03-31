from __future__ import annotations

import json
from datetime import datetime, timezone
from database.supabase_client import SupabaseClient
from services.coldduck.linkedin_scraper import LinkedInScraper
from services.coldduck.profile_analyzer import ProfileAnalyzer
from services.coldduck.message_generator import OutreachMessageGenerator
from services.coldduck.video_generator import VideoGenerator
from utils.logger import logger


class ColdDuckService:
    def __init__(self, db: SupabaseClient):
        self.db = db
        self.scraper = LinkedInScraper()
        self.analyzer = ProfileAnalyzer()
        self.message_gen = OutreachMessageGenerator()
        self.video_gen = VideoGenerator()

    async def process_outreach(
        self,
        linkedin_url: str = "",
        profile_text: str = "",
        tone: str = "profesional y cercano",
        goal: str = "ofrecer servicios de desarrollo de software a medida",
        generate_video: bool = False,
        avatar_id: str = "default",
        voice_id: str = "default",
    ) -> dict:
        """Full ColdDuck pipeline: scrape/parse -> analyze -> generate message -> optionally generate video."""
        logger.info(f"ColdDuck processing: url={linkedin_url or 'manual mode'}")

        # 1. Get profile: scrape from LinkedIn or parse manual text
        if profile_text:
            profile = LinkedInScraper.parse_manual_profile(profile_text, linkedin_url)
        elif linkedin_url:
            profile = await self.scraper.scrape_profile(linkedin_url)
        else:
            raise ValueError("Debes proporcionar una URL de LinkedIn o texto del perfil")

        # 2. Analyze profile
        analysis = await self.analyzer.analyze(profile)

        # 3. Generate personalized message
        message = await self.message_gen.generate(
            profile=profile,
            analysis=analysis,
            tone=tone,
            goal=goal,
        )

        # 4. Optionally generate video with dedicated short script
        video_data = None
        if generate_video:
            video_script = await self.message_gen.generate_video_script(
                profile=profile,
                analysis=analysis,
            )
            logger.info(f"Video script ({len(video_script.split())} words): {video_script}")
            video_data = await self.video_gen.generate_video(
                script=video_script,
                avatar_id=avatar_id,
                voice_id=voice_id,
            )

        # 5. Save to database
        outreach_id = self._save_outreach(
            linkedin_url=linkedin_url,
            profile=profile,
            analysis=analysis,
            message=message,
            video_data=video_data,
        )

        logger.info(f"ColdDuck outreach saved: {outreach_id}")

        return {
            "outreach_id": outreach_id,
            "linkedin_url": linkedin_url,
            "profile": profile,
            "analysis": analysis,
            "message": message,
            "video": video_data,
        }

    async def check_video_status(self, video_id: str, outreach_id: str) -> dict:
        """Check video generation status and update DB if completed."""
        status = await self.video_gen.get_video_status(video_id)

        if status.get("status") == "completed":
            self._update_outreach_video(outreach_id, status)

        return status

    async def get_avatars(self) -> list[dict]:
        return await self.video_gen.list_avatars()

    async def get_voices(self) -> list[dict]:
        return await self.video_gen.list_voices()

    async def get_all_outreach(self) -> list[dict]:
        """Get all outreach records."""
        result = (
            self.db.client.table("coldduck_outreach")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        entries = []
        for row in result.data:
            for field in ("profile", "analysis", "video_data"):
                val = row.get(field)
                if isinstance(val, str):
                    try:
                        row[field] = json.loads(val)
                    except json.JSONDecodeError:
                        pass
            entries.append(row)
        return entries

    async def mark_outreach_result(self, outreach_id: str, result: str) -> None:
        """Mark the outcome of an outreach: replied, ignored, connected, meeting."""
        logger.info(f"Marking outreach {outreach_id} as {result}")
        self.db.client.table("coldduck_outreach").update(
            {"result": result}
        ).eq("id", outreach_id).execute()

    async def delete_outreach(self, outreach_id: str) -> None:
        """Delete an outreach record and its messages."""
        logger.info(f"Deleting outreach {outreach_id}")
        self.db.client.table("coldduck_messages").delete().eq("outreach_id", outreach_id).execute()
        self.db.client.table("coldduck_outreach").delete().eq("id", outreach_id).execute()

    def _save_outreach(
        self,
        linkedin_url: str,
        profile: dict,
        analysis: dict,
        message: str,
        video_data: dict | None,
    ) -> str:
        data = {
            "linkedin_url": linkedin_url,
            "profile": json.dumps(profile, ensure_ascii=False),
            "analysis": json.dumps(analysis, ensure_ascii=False),
            "message": message,
            "video_data": json.dumps(video_data, ensure_ascii=False) if video_data else None,
            "result": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        result = self.db.client.table("coldduck_outreach").insert(data).execute()
        return result.data[0]["id"]

    def _update_outreach_video(self, outreach_id: str, video_status: dict) -> None:
        self.db.client.table("coldduck_outreach").update(
            {"video_data": json.dumps(video_status, ensure_ascii=False)}
        ).eq("id", outreach_id).execute()
