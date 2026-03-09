-- ColdDuck: Outreach tracking table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS coldduck_outreach (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    linkedin_url TEXT NOT NULL,
    profile JSONB,
    analysis JSONB,
    message TEXT,
    video_data JSONB,
    result TEXT DEFAULT 'pending' CHECK (result IN ('pending', 'replied', 'ignored', 'connected', 'meeting')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by result status
CREATE INDEX IF NOT EXISTS idx_coldduck_result ON coldduck_outreach(result);

-- Index for ordering by date
CREATE INDEX IF NOT EXISTS idx_coldduck_created ON coldduck_outreach(created_at DESC);

-- RLS policies (optional, for Supabase auth)
ALTER TABLE coldduck_outreach ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON coldduck_outreach
    FOR ALL
    USING (true)
    WITH CHECK (true);
