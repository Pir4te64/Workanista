-- ColdDuck: Message thread for outreach conversations
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS coldduck_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    outreach_id UUID NOT NULL REFERENCES coldduck_outreach(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('me', 'client')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying messages by outreach
CREATE INDEX IF NOT EXISTS idx_coldduck_messages_outreach ON coldduck_messages(outreach_id, created_at ASC);

-- RLS policies
ALTER TABLE coldduck_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON coldduck_messages
    FOR ALL
    USING (true)
    WITH CHECK (true);
