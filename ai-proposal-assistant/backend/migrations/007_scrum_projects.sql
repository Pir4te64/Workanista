-- Scrum projects table: stores sprint planning documents as JSONB
CREATE TABLE IF NOT EXISTS scrum_projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_name TEXT NOT NULL DEFAULT '',
    client_name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrum_projects_created_at ON scrum_projects (created_at DESC);

CREATE OR REPLACE FUNCTION update_scrum_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scrum_projects_updated_at
    BEFORE UPDATE ON scrum_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_scrum_projects_updated_at();
