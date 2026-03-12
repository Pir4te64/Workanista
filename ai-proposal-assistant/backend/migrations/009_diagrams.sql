CREATE TABLE IF NOT EXISTS diagrams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Sin título',
    description TEXT,
    scrum_project_id UUID REFERENCES scrum_projects(id) ON DELETE SET NULL,
    nodes JSONB NOT NULL DEFAULT '[]',
    edges JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
