"""Agenda service — manages available slots and bookings (no Google dependency)."""

from database.supabase_client import SupabaseClient
from utils.logger import logger


class AgendaService:
    def __init__(self, db: SupabaseClient):
        self.db = db

    # ── Available slots (recurring weekly) ──────────────────────────────────

    def list_slots(self, owner_email: str = "victor@cruznegradev.com"):
        res = (
            self.db.client.table("agenda_slots")
            .select("*")
            .eq("owner_email", owner_email)
            .order("day_of_week")
            .order("start_time")
            .execute()
        )
        return res.data or []

    def create_slot(self, day_of_week: int, start_time: str, end_time: str,
                    owner_email: str = "victor@cruznegradev.com"):
        res = (
            self.db.client.table("agenda_slots")
            .insert({
                "owner_email": owner_email,
                "day_of_week": day_of_week,
                "start_time": start_time,
                "end_time": end_time,
            })
            .execute()
        )
        return res.data[0] if res.data else None

    def delete_slot(self, slot_id: str):
        self.db.client.table("agenda_slots").delete().eq("id", slot_id).execute()

    # ── Bookings ────────────────────────────────────────────────────────────

    def list_bookings(self, date_from: str, date_to: str):
        res = (
            self.db.client.table("agenda_bookings")
            .select("*")
            .gte("date", date_from)
            .lte("date", date_to)
            .order("date")
            .order("start_time")
            .execute()
        )
        return res.data or []

    def create_booking(self, date: str, start_time: str, end_time: str,
                       title: str, booked_by: str,
                       meet_link: str = "", description: str = ""):
        res = (
            self.db.client.table("agenda_bookings")
            .insert({
                "date": date,
                "start_time": start_time,
                "end_time": end_time,
                "title": title,
                "booked_by": booked_by,
                "meet_link": meet_link,
                "description": description,
            })
            .execute()
        )
        return res.data[0] if res.data else None

    def delete_booking(self, booking_id: str):
        self.db.client.table("agenda_bookings").delete().eq("id", booking_id).execute()
