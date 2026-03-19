-- Agenda: available time slots + bookings (replaces Google Calendar)

CREATE TABLE IF NOT EXISTS agenda_slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_email TEXT NOT NULL DEFAULT 'victor@cruznegradev.com',
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Lun, 6=Dom
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agenda_bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    title TEXT NOT NULL,
    meet_link TEXT,
    booked_by TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_bookings_date ON agenda_bookings (date);
CREATE INDEX IF NOT EXISTS idx_agenda_slots_owner ON agenda_slots (owner_email);
