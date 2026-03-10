-- Budgets table: stores saved proposal/budget documents as JSONB
CREATE TABLE IF NOT EXISTS budgets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name TEXT NOT NULL DEFAULT '',
    project_name TEXT NOT NULL DEFAULT '',
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick listing sorted by date
CREATE INDEX IF NOT EXISTS idx_budgets_created_at ON budgets (created_at DESC);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER budgets_updated_at
    BEFORE UPDATE ON budgets
    FOR EACH ROW
    EXECUTE FUNCTION update_budgets_updated_at();
