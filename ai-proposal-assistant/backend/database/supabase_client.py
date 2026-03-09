from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_KEY


class SupabaseClient:
    def __init__(self):
        self.client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
