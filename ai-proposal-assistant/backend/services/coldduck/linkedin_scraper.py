import httpx
from config import RAPIDAPI_KEY
from utils.logger import logger


class LinkedInScraper:
    """Scrape LinkedIn profiles using RapidAPI's Fresh LinkedIn Profile Data."""

    BASE_URL = "https://fresh-linkedin-profile-data.p.rapidapi.com/enrich-lead"
    API_HOST = "fresh-linkedin-profile-data.p.rapidapi.com"

    def __init__(self):
        self.api_key = RAPIDAPI_KEY

    async def scrape_profile(self, linkedin_url: str) -> dict:
        """Scrape a LinkedIn profile using RapidAPI."""
        logger.info(f"Scraping LinkedIn profile: {linkedin_url}")

        if not self.api_key or self.api_key.startswith("your_"):
            raise ValueError(
                "RAPIDAPI_KEY is not configured. "
                "Subscribe at https://rapidapi.com/freshdata-freshdata-default/api/fresh-linkedin-profile-data"
            )

        headers = {
            "x-rapidapi-key": self.api_key,
            "x-rapidapi-host": self.API_HOST,
        }
        params = {
            "linkedin_url": linkedin_url,
            "include_skills": "true",
        }

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                self.BASE_URL, headers=headers, params=params
            )
            response.raise_for_status()
            result = response.json()

        data = result.get("data", result)

        profile = {
            "full_name": data.get("full_name", ""),
            "headline": data.get("headline", ""),
            "summary": data.get("about", "") or data.get("summary", ""),
            "industry": data.get("industry", ""),
            "location": data.get("location", ""),
            "country": data.get("country", ""),
            "current_company": "",
            "current_role": "",
            "experiences": [],
            "skills": [],
            "languages": data.get("languages", []),
        }

        skills_data = data.get("skills", [])
        if skills_data:
            profile["skills"] = [
                s.get("name", s) if isinstance(s, dict) else str(s)
                for s in skills_data
            ]

        experiences = data.get("experiences", [])
        if experiences:
            current = experiences[0]
            profile["current_company"] = current.get("company", "") or current.get("company_name", "")
            profile["current_role"] = current.get("title", "")
            profile["experiences"] = [
                {
                    "company": exp.get("company", "") or exp.get("company_name", ""),
                    "title": exp.get("title", ""),
                    "description": exp.get("description", "") or "",
                }
                for exp in experiences[:5]
            ]

        if not profile["full_name"]:
            profile["full_name"] = f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()

        logger.info(f"Profile scraped: {profile['full_name']} - {profile['headline']}")
        return profile

    @staticmethod
    def parse_manual_profile(profile_text: str, linkedin_url: str = "") -> dict:
        """Parse manually pasted LinkedIn profile text into a structured profile."""
        lines = [l.strip() for l in profile_text.strip().split("\n") if l.strip()]

        return {
            "full_name": lines[0] if lines else "Unknown",
            "headline": lines[1] if len(lines) > 1 else "",
            "summary": "\n".join(lines[2:]) if len(lines) > 2 else "",
            "industry": "",
            "location": "",
            "country": "",
            "current_company": "",
            "current_role": "",
            "experiences": [],
            "skills": [],
            "languages": [],
            "linkedin_url": linkedin_url,
        }
