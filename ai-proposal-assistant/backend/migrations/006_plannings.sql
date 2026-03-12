-- Plannings table: stores AI-generated project plannings with task tracking
CREATE TABLE IF NOT EXISTS plannings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick listing sorted by date
CREATE INDEX IF NOT EXISTS idx_plannings_created_at ON plannings (created_at DESC);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_plannings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plannings_updated_at
    BEFORE UPDATE ON plannings
    FOR EACH ROW
    EXECUTE FUNCTION update_plannings_updated_at();
