"""
Google Calendar integration service.

Handles OAuth2 authentication, token management, and Calendar API operations
for scheduling and availability features.
"""

from datetime import datetime, timezone
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
from utils.logger import logger

SCOPES = ["https://www.googleapis.com/auth/calendar"]


class GoogleCalendarService:
    """Service for interacting with Google Calendar via OAuth2."""

    def __init__(self, db):
        """
        Initialize the Google Calendar service.

        Args:
            db: SupabaseClient instance. Use self.db.client for supabase operations.
        """
        self.db = db
        self._client_config = {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uris": [GOOGLE_REDIRECT_URI],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        }

    # ------------------------------------------------------------------ #
    #  OAuth Flow
    # ------------------------------------------------------------------ #

    def get_auth_url(self, user_email: str) -> str:
        """
        Generate the Google OAuth2 authorization URL.

        Args:
            user_email: The email of the user initiating the OAuth flow.
                        Passed as the ``state`` parameter so it survives the redirect.

        Returns:
            The authorization URL the user should be redirected to.
        """
        try:
            flow = Flow.from_client_config(
                self._client_config,
                scopes=SCOPES,
                redirect_uri=GOOGLE_REDIRECT_URI,
            )
            auth_url, _ = flow.authorization_url(
                access_type="offline",
                include_granted_scopes="true",
                prompt="consent",
                state=user_email,
            )
            logger.info("Generated OAuth URL for user %s", user_email)
            return auth_url
        except Exception:
            logger.exception("Failed to generate OAuth URL for %s", user_email)
            raise

    def handle_callback(self, code: str, user_email: str) -> bool:
        """
        Exchange the authorization code for tokens and persist them.

        Args:
            code: The authorization code returned by Google.
            user_email: The user's email address.

        Returns:
            True on success.

        Raises:
            Exception: If the token exchange or storage fails.
        """
        try:
            flow = Flow.from_client_config(
                self._client_config,
                scopes=SCOPES,
                redirect_uri=GOOGLE_REDIRECT_URI,
            )
            flow.fetch_token(code=code)
            credentials = flow.credentials

            self._store_tokens(
                user_email=user_email,
                access_token=credentials.token,
                refresh_token=credentials.refresh_token,
                token_expiry=credentials.expiry,
            )

            logger.info("OAuth callback handled successfully for %s", user_email)
            return True
        except Exception:
            logger.exception("OAuth callback failed for %s", user_email)
            raise

    # ------------------------------------------------------------------ #
    #  Token Management
    # ------------------------------------------------------------------ #

    def _store_tokens(
        self,
        user_email: str,
        access_token: str,
        refresh_token: Optional[str],
        token_expiry: Optional[datetime],
    ) -> None:
        """Upsert tokens into the ``google_tokens`` table."""
        now = datetime.now(timezone.utc).isoformat()
        expiry_str = token_expiry.isoformat() if token_expiry else None

        payload = {
            "user_email": user_email,
            "access_token": access_token,
            "token_expiry": expiry_str,
            "updated_at": now,
        }

        # Only overwrite refresh_token when a new one is provided (initial
        # grant).  Subsequent refreshes do not return a new refresh_token.
        if refresh_token is not None:
            payload["refresh_token"] = refresh_token

        try:
            # Upsert keyed on user_email (UNIQUE constraint).
            self.db.client.table("google_tokens").upsert(
                {**payload, "created_at": now},
                on_conflict="user_email",
            ).execute()
            logger.debug("Tokens stored for %s", user_email)
        except Exception:
            logger.exception("Failed to store tokens for %s", user_email)
            raise

    def _get_credentials(self, user_email: str) -> Credentials:
        """
        Load stored tokens and return a valid ``Credentials`` object.

        If the access token is expired the method will attempt an automatic
        refresh using the stored refresh token and persist the new tokens.

        Raises:
            ValueError: If no tokens are stored for the given user.
            Exception: If the token refresh fails.
        """
        try:
            response = (
                self.db.client.table("google_tokens")
                .select("access_token, refresh_token, token_expiry")
                .eq("user_email", user_email)
                .single()
                .execute()
            )
        except Exception:
            logger.exception("Failed to fetch tokens for %s", user_email)
            raise

        row = response.data
        if not row:
            raise ValueError(f"No Google tokens found for {user_email}")

        expiry = None
        if row.get("token_expiry"):
            expiry = datetime.fromisoformat(row["token_expiry"])
            # Ensure the datetime is timezone-aware (UTC).
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)

        credentials = Credentials(
            token=row["access_token"],
            refresh_token=row.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            expiry=expiry,
        )

        # Auto-refresh if expired.
        if credentials.expired and credentials.refresh_token:
            try:
                credentials.refresh(Request())
                self._store_tokens(
                    user_email=user_email,
                    access_token=credentials.token,
                    refresh_token=credentials.refresh_token,
                    token_expiry=credentials.expiry,
                )
                logger.info("Access token refreshed for %s", user_email)
            except Exception:
                logger.exception("Token refresh failed for %s", user_email)
                raise

        return credentials

    def is_connected(self, user_email: str) -> bool:
        """
        Check whether the user has stored Google tokens.

        Returns:
            True if a token row exists for the user, False otherwise.
        """
        try:
            response = (
                self.db.client.table("google_tokens")
                .select("id", count="exact")
                .eq("user_email", user_email)
                .execute()
            )
            return (response.count or 0) > 0
        except Exception:
            logger.exception("Failed to check connection status for %s", user_email)
            return False

    # ------------------------------------------------------------------ #
    #  Calendar Operations
    # ------------------------------------------------------------------ #

    def _build_service(self, user_email: str):
        """Build an authorized Google Calendar API service instance."""
        credentials = self._get_credentials(user_email)
        return build("calendar", "v3", credentials=credentials)

    def list_events(
        self, user_email: str, time_min: str, time_max: str
    ) -> list[dict]:
        """
        List calendar events within a date range.

        Args:
            user_email: The user's email.
            time_min: RFC 3339 start timestamp (e.g. ``2026-03-10T00:00:00Z``).
            time_max: RFC 3339 end timestamp.

        Returns:
            A list of event resource dicts.
        """
        try:
            service = self._build_service(user_email)
            events_result = (
                service.events()
                .list(
                    calendarId="primary",
                    timeMin=time_min,
                    timeMax=time_max,
                    singleEvents=True,
                    orderBy="startTime",
                )
                .execute()
            )
            events = events_result.get("items", [])
            logger.info(
                "Listed %d events for %s (%s - %s)",
                len(events),
                user_email,
                time_min,
                time_max,
            )
            return events
        except HttpError as exc:
            logger.exception(
                "Google API error listing events for %s: %s", user_email, exc
            )
            raise
        except Exception:
            logger.exception("Failed to list events for %s", user_email)
            raise

    def create_event(self, user_email: str, event_data: dict, conference: bool = False) -> dict:
        """
        Create an event on the user's primary calendar.

        Args:
            user_email: The user's email.
            event_data: A dict conforming to the Google Calendar event resource
                        (must include at least ``summary``, ``start``, ``end``).

        Returns:
            The created event resource dict.
        """
        try:
            service = self._build_service(user_email)
            kwargs = {"calendarId": "primary", "body": event_data}
            if conference:
                kwargs["conferenceDataVersion"] = 1
            event = service.events().insert(**kwargs).execute()
            logger.info(
                "Created event '%s' (%s) for %s",
                event.get("summary"),
                event.get("id"),
                user_email,
            )
            return event
        except HttpError as exc:
            logger.exception(
                "Google API error creating event for %s: %s", user_email, exc
            )
            raise
        except Exception:
            logger.exception("Failed to create event for %s", user_email)
            raise

    def get_availability(
        self, user_email: str, time_min: str, time_max: str
    ) -> list[dict]:
        """
        Query free/busy information for the user's primary calendar.

        Args:
            user_email: The user's email.
            time_min: RFC 3339 start timestamp.
            time_max: RFC 3339 end timestamp.

        Returns:
            A list of busy time-range dicts, each with ``start`` and ``end`` keys.
            An empty list means the user is entirely free in the window.
        """
        try:
            service = self._build_service(user_email)
            body = {
                "timeMin": time_min,
                "timeMax": time_max,
                "items": [{"id": "primary"}],
            }
            result = service.freebusy().query(body=body).execute()
            busy_slots = result.get("calendars", {}).get("primary", {}).get("busy", [])
            logger.info(
                "Availability query for %s (%s - %s): %d busy slots",
                user_email,
                time_min,
                time_max,
                len(busy_slots),
            )
            return busy_slots
        except HttpError as exc:
            logger.exception(
                "Google API error querying availability for %s: %s", user_email, exc
            )
            raise
        except Exception:
            logger.exception("Failed to get availability for %s", user_email)
            raise

    def delete_event(self, user_email: str, event_id: str) -> None:
        """
        Delete an event from the user's primary calendar.

        Args:
            user_email: The user's email.
            event_id: The Google Calendar event ID.
        """
        try:
            service = self._build_service(user_email)
            service.events().delete(
                calendarId="primary", eventId=event_id
            ).execute()
            logger.info("Deleted event %s for %s", event_id, user_email)
        except HttpError as exc:
            logger.exception(
                "Google API error deleting event %s for %s: %s",
                event_id,
                user_email,
                exc,
            )
            raise
        except Exception:
            logger.exception(
                "Failed to delete event %s for %s", event_id, user_email
            )
            raise
