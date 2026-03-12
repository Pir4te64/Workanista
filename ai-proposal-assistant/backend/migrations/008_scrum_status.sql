-- Add status lifecycle and start date to scrum_projects
ALTER TABLE scrum_projects
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'borrador'
    CHECK (status IN ('borrador', 'activo', 'completado')),
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_scrum_projects_status ON scrum_projects (status);
