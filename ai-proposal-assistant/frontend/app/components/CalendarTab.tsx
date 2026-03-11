"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "./Toast";

// ─── Config ─────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const USER_EMAIL = "victor@cruznegradev.com";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { email: string; responseStatus?: string }[];
  location?: string;
  description?: string;
  hangoutLink?: string;
}

interface FreeBusySlot {
  start: string;
  end: string;
}

interface CreateEventForm {
  summary: string;
  date: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  description: string;
  location: string;
  addMeet: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8..20

const DAY_LABELS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function getHourFraction(iso: string): number {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const EVENT_COLORS = [
  "rgba(0, 245, 160, 0.25)",
  "rgba(124, 58, 237, 0.30)",
  "rgba(59, 130, 246, 0.30)",
  "rgba(245, 158, 11, 0.30)",
  "rgba(236, 72, 153, 0.30)",
  "rgba(20, 184, 166, 0.30)",
];

function eventColor(idx: number): string {
  return EVENT_COLORS[idx % EVENT_COLORS.length];
}

const emptyForm = (): CreateEventForm => ({
  summary: "",
  date: isoDate(new Date()),
  startTime: "09:00",
  endTime: "10:00",
  attendees: [],
  description: "",
  location: "",
  addMeet: false,
});

// ─── Component ──────────────────────────────────────────────────────────────

export default function CalendarTab() {
  const { addToast } = useToast();

  // Connection state
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Calendar state
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [busySlots, setBusySlots] = useState<FreeBusySlot[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // UI state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<CreateEventForm>(emptyForm);
  const [attendeeInput, setAttendeeInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);

  // ─── Check connection ───────────────────────────────────────────────────

  const checkConnection = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/google/status?email=${encodeURIComponent(USER_EMAIL)}`);
      const data = await res.json();
      setConnected(data.connected ?? false);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // ─── Load events & availability ─────────────────────────────────────────

  const weekEnd = addDays(weekStart, 7);

  const loadEvents = useCallback(async () => {
    if (!connected) return;
    setEventsLoading(true);
    try {
      const timeMin = new Date(weekStart).toISOString();
      const timeMax = new Date(weekEnd).toISOString();
      const [evRes, avRes] = await Promise.all([
        fetch(`${API}/api/google/events?email=${encodeURIComponent(USER_EMAIL)}&time_min=${timeMin}&time_max=${timeMax}`),
        fetch(`${API}/api/google/availability?email=${encodeURIComponent(USER_EMAIL)}&time_min=${timeMin}&time_max=${timeMax}`),
      ]);
      const evData = await evRes.json();
      const avData = await avRes.json();
      setEvents(evData.events ?? evData ?? []);
      setBusySlots(avData.busy ?? avData ?? []);
    } catch {
      addToast("error", "Error cargando eventos del calendario");
    } finally {
      setEventsLoading(false);
    }
  }, [connected, weekStart, weekEnd, addToast]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // ─── Connect ────────────────────────────────────────────────────────────

  const handleConnect = async () => {
    try {
      const res = await fetch(`${API}/api/google/auth-url?email=${encodeURIComponent(USER_EMAIL)}`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        addToast("error", "No se pudo obtener la URL de autorizacion");
      }
    } catch {
      addToast("error", "Error conectando con Google Calendar");
    }
  };

  // ─── Create event ──────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!form.summary || !form.date || !form.startTime || !form.endTime) {
      addToast("error", "Completa titulo, fecha, hora inicio y hora fin");
      return;
    }
    setCreating(true);
    try {
      const start = `${form.date}T${form.startTime}:00`;
      const end = `${form.date}T${form.endTime}:00`;
      const res = await fetch(`${API}/api/google/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: USER_EMAIL,
          summary: form.summary,
          start,
          end,
          attendees: form.attendees,
          description: form.description,
          location: form.location,
          add_meet: form.addMeet,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      addToast("success", "Reunion creada exitosamente");
      setForm(emptyForm());
      setShowCreateForm(false);
      loadEvents();
    } catch {
      addToast("error", "Error creando la reunion");
    } finally {
      setCreating(false);
    }
  };

  // ─── Delete event ──────────────────────────────────────────────────────

  const handleDelete = async (eventId: string) => {
    try {
      const res = await fetch(`${API}/api/google/events/${eventId}?email=${encodeURIComponent(USER_EMAIL)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      addToast("success", "Evento eliminado");
      loadEvents();
    } catch {
      addToast("error", "Error eliminando evento");
    }
  };

  // ─── Navigation ────────────────────────────────────────────────────────

  const prevWeek = () => setWeekStart(addDays(weekStart, -7));
  const nextWeek = () => setWeekStart(addDays(weekStart, 7));
  const goToday = () => setWeekStart(getMonday(new Date()));

  // ─── Add attendee ─────────────────────────────────────────────────────

  const addAttendee = () => {
    const email = attendeeInput.trim();
    if (email && email.includes("@") && !form.attendees.includes(email)) {
      setForm({ ...form, attendees: [...form.attendees, email] });
      setAttendeeInput("");
    }
  };

  const removeAttendee = (email: string) => {
    setForm({ ...form, attendees: form.attendees.filter((a) => a !== email) });
  };

  // ─── Compute week days ────────────────────────────────────────────────

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const now = new Date();
  const currentHourFraction = now.getHours() + now.getMinutes() / 60;

  // ─── Events for a given day ───────────────────────────────────────────

  const eventsForDay = (day: Date) =>
    events.filter((ev) => {
      const start = ev.start.dateTime || ev.start.date;
      if (!start) return false;
      return sameDay(new Date(start), day);
    });

  // ─── Busy slots for a given day ────────────────────────────────────────

  const busyForDay = (day: Date) =>
    busySlots.filter((slot) => sameDay(new Date(slot.start), day));

  // ─── Loading state ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-mint border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Not connected ────────────────────────────────────────────────────

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div
          className="glass-card p-10 flex flex-col items-center gap-6 max-w-md w-full"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* Calendar icon */}
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(0, 245, 160, 0.1)" }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00F5A0" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
            </svg>
          </div>
          <h2 className="section-title text-center">Google Calendar</h2>
          <p className="text-text-muted text-center text-sm leading-relaxed">
            Conecta tu cuenta de Google para ver tu calendario, crear reuniones y gestionar tu disponibilidad.
          </p>
          <button onClick={handleConnect} className="btn-primary w-full py-3 text-sm font-medium">
            Conectar Google Calendar
          </button>
        </div>
      </div>
    );
  }

  // ─── Connected: Calendar view ─────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h2 className="section-title">Calendario</h2>
          <span className="text-xs text-text-muted bg-surface-dark px-2 py-1 rounded-full">
            {USER_EMAIL}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAvailability(!showAvailability)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              showAvailability
                ? "bg-brand-mint text-surface-black"
                : "bg-surface-dark text-text-muted hover:text-text-primary"
            }`}
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
          >
            Disponibilidad
          </button>
          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              if (!showCreateForm) setForm(emptyForm());
            }}
            className="btn-primary px-4 py-1.5 text-xs font-medium"
          >
            + Nueva Reunion
          </button>
        </div>
      </div>

      {/* ─── Create Event Form ──────────────────────────────────────────── */}
      {showCreateForm && (
        <div
          className="glass-card p-6 space-y-4 animate-in fade-in slide-in-from-top-2"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-text-primary font-semibold text-sm">Crear Reunion</h3>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-text-muted hover:text-text-primary text-lg leading-none"
            >
              &times;
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div className="md:col-span-2">
              <label className="block text-xs text-text-muted mb-1">Titulo</label>
              <input
                className="input-premium w-full"
                placeholder="Nombre de la reunion..."
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs text-text-muted mb-1">Fecha</label>
              <input
                type="date"
                className="input-premium w-full"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>

            {/* Time */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-1">Inicio</label>
                <input
                  type="time"
                  className="input-premium w-full"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-1">Fin</label>
                <input
                  type="time"
                  className="input-premium w-full"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </div>
            </div>

            {/* Attendees */}
            <div className="md:col-span-2">
              <label className="block text-xs text-text-muted mb-1">Asistentes</label>
              <div className="flex gap-2">
                <input
                  className="input-premium flex-1"
                  placeholder="email@ejemplo.com"
                  value={attendeeInput}
                  onChange={(e) => setAttendeeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addAttendee();
                    }
                  }}
                />
                <button
                  onClick={addAttendee}
                  className="px-3 py-1.5 bg-surface-dark text-text-muted hover:text-text-primary rounded-lg text-xs"
                  style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  Agregar
                </button>
              </div>
              {form.attendees.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.attendees.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-surface-dark text-text-secondary"
                      style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      {email}
                      <button
                        onClick={() => removeAttendee(email)}
                        className="text-text-muted hover:text-red-400 ml-1"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-xs text-text-muted mb-1">Descripcion</label>
              <textarea
                className="input-premium w-full min-h-[60px] resize-y"
                placeholder="Detalles de la reunion..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs text-text-muted mb-1">Ubicacion</label>
              <input
                className="input-premium w-full"
                placeholder="Oficina, link, etc."
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>

            {/* Google Meet toggle */}
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setForm({ ...form, addMeet: !form.addMeet })}
                  className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${
                    form.addMeet ? "bg-brand-mint" : "bg-surface-dark"
                  }`}
                  style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                      form.addMeet ? "left-4 bg-surface-black" : "left-0.5 bg-text-muted"
                    }`}
                  />
                </div>
                <span className="text-xs text-text-muted">Agregar Google Meet</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="btn-primary px-6 py-2 text-sm font-medium disabled:opacity-50"
            >
              {creating ? "Creando..." : "Crear Reunion"}
            </button>
          </div>
        </div>
      )}

      {/* ─── Week Navigation ───────────────────────────────────────────── */}
      <div
        className="glass-card px-4 py-3 flex items-center justify-between"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button
          onClick={prevWeek}
          className="p-2 rounded-lg hover:bg-surface-dark text-text-muted hover:text-text-primary transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex items-center gap-3">
          <span className="text-text-primary text-sm font-medium">
            {formatDate(weekStart)} - {formatDate(addDays(weekStart, 6))}
          </span>
          <button
            onClick={goToday}
            className="px-3 py-1 rounded-md text-xs font-medium bg-surface-dark text-text-muted hover:text-text-primary transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
          >
            Hoy
          </button>
        </div>
        <button
          onClick={nextWeek}
          className="p-2 rounded-lg hover:bg-surface-dark text-text-muted hover:text-text-primary transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* ─── Main Grid: Calendar + Events Panel ────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* ─── Weekly Calendar Grid ────────────────────────────────────── */}
        <div
          className="xl:col-span-3 glass-card overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {eventsLoading && (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-brand-mint border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Day headers */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)]" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="p-2" />
            {weekDays.map((day, i) => {
              const isToday = sameDay(day, now);
              return (
                <div
                  key={i}
                  className={`p-3 text-center ${isToday ? "bg-brand-mint/5" : ""}`}
                  style={{ borderLeft: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <div className={`text-xs font-medium ${isToday ? "text-brand-mint" : "text-text-muted"}`}>
                    {DAY_LABELS[i]}
                  </div>
                  <div
                    className={`text-lg font-semibold mt-0.5 ${
                      isToday ? "text-brand-mint" : "text-text-primary"
                    }`}
                  >
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] relative" style={{ minHeight: "624px" }}>
            {/* Hour labels + grid rows */}
            {HOURS.map((hour) => (
              <div key={hour} className="contents">
                <div
                  className="text-[10px] text-text-muted text-right pr-2 pt-0.5"
                  style={{
                    gridColumn: "1",
                    gridRow: hour - 7,
                    height: "48px",
                    borderTop: "1px solid rgba(255,255,255,0.03)",
                  }}
                >
                  {String(hour).padStart(2, "0")}:00
                </div>
                {weekDays.map((_, di) => (
                  <div
                    key={di}
                    style={{
                      gridColumn: di + 2,
                      gridRow: hour - 7,
                      height: "48px",
                      borderTop: "1px solid rgba(255,255,255,0.03)",
                      borderLeft: "1px solid rgba(255,255,255,0.04)",
                    }}
                  />
                ))}
              </div>
            ))}

            {/* Availability overlay */}
            {showAvailability &&
              weekDays.map((day, di) =>
                busyForDay(day).map((slot, si) => {
                  const startH = getHourFraction(slot.start);
                  const endH = getHourFraction(slot.end);
                  const top = (startH - 8) * 48;
                  const height = (endH - startH) * 48;
                  if (top < 0 || height <= 0) return null;
                  return (
                    <div
                      key={`busy-${di}-${si}`}
                      className="absolute rounded-sm pointer-events-none z-0"
                      style={{
                        gridColumn: di + 2,
                        left: `calc(60px + ${(di / 7) * 100}% * (7/7))`,
                        width: `calc(100% / 7 - 2px)`,
                        top: `${top}px`,
                        height: `${height}px`,
                        background: "rgba(239, 68, 68, 0.08)",
                        border: "1px solid rgba(239, 68, 68, 0.15)",
                        marginLeft: `calc(${di} * (100% - 60px) / 7 + 60px + 1px)`,
                      }}
                    />
                  );
                })
              )}

            {/* Event blocks */}
            {weekDays.map((day, di) =>
              eventsForDay(day).map((ev, ei) => {
                const startStr = ev.start.dateTime || ev.start.date || "";
                const endStr = ev.end.dateTime || ev.end.date || "";
                const startH = ev.start.dateTime ? getHourFraction(startStr) : 8;
                const endH = ev.end.dateTime ? getHourFraction(endStr) : 9;
                const top = (startH - 8) * 48;
                const height = Math.max((endH - startH) * 48, 20);
                if (startH < 8 || startH > 20) return null;

                const colStart = 60; // px for time label column
                const bg = eventColor(ei);

                return (
                  <div
                    key={ev.id}
                    className="absolute z-10 rounded-md px-2 py-1 overflow-hidden cursor-default group"
                    style={{
                      left: `calc(60px + ${di} * ((100% - 60px) / 7) + 2px)`,
                      width: `calc((100% - 60px) / 7 - 4px)`,
                      top: `${top}px`,
                      height: `${height}px`,
                      background: bg,
                      border: `1px solid ${bg.replace("0.25", "0.5").replace("0.30", "0.5")}`,
                      backdropFilter: "blur(4px)",
                    }}
                    title={`${ev.summary}\n${ev.start.dateTime ? formatTime(startStr) : "Todo el dia"} - ${ev.end.dateTime ? formatTime(endStr) : ""}`}
                  >
                    <div className="text-[10px] font-medium text-text-primary truncate leading-tight">
                      {ev.summary}
                    </div>
                    {height > 28 && (
                      <div className="text-[9px] text-text-muted truncate">
                        {ev.start.dateTime ? formatTime(startStr) : "Todo el dia"}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Current time indicator */}
            {weekDays.some((d) => sameDay(d, now)) && currentHourFraction >= 8 && currentHourFraction <= 20 && (
              <div
                className="absolute z-20 pointer-events-none"
                style={{
                  left: "60px",
                  right: "0",
                  top: `${(currentHourFraction - 8) * 48}px`,
                }}
              >
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <div className="flex-1 h-[2px] bg-red-500/60" />
                </div>
              </div>
            )}
          </div>

          {/* Availability legend */}
          {showAvailability && (
            <div
              className="flex items-center gap-4 px-4 py-2 text-[10px] text-text-muted"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ background: "rgba(0, 245, 160, 0.15)", border: "1px solid rgba(0, 245, 160, 0.3)" }}
                />
                Libre
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.15)" }}
                />
                Ocupado
              </span>
            </div>
          )}
        </div>

        {/* ─── Event List Panel ─────────────────────────────────────────── */}
        <div
          className="xl:col-span-1 glass-card p-4 space-y-3 max-h-[700px] overflow-y-auto"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <h3 className="text-text-primary font-semibold text-sm mb-2">Proximos eventos</h3>

          {events.length === 0 && !eventsLoading && (
            <p className="text-text-muted text-xs py-4 text-center">No hay eventos esta semana</p>
          )}

          {events
            .sort((a, b) => {
              const aTime = a.start.dateTime || a.start.date || "";
              const bTime = b.start.dateTime || b.start.date || "";
              return aTime.localeCompare(bTime);
            })
            .map((ev, idx) => {
              const startStr = ev.start.dateTime || ev.start.date || "";
              const endStr = ev.end.dateTime || ev.end.date || "";
              const startDate = new Date(startStr);
              const dayLabel = startDate.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });

              return (
                <div
                  key={ev.id}
                  className="glass-card-hover p-3 rounded-lg space-y-1.5 group"
                  style={{
                    border: "1px solid rgba(255,255,255,0.04)",
                    borderLeft: `3px solid ${EVENT_COLORS[idx % EVENT_COLORS.length].replace("0.25", "0.7").replace("0.30", "0.7")}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-text-primary text-xs font-medium leading-snug">{ev.summary}</div>
                    <button
                      onClick={() => handleDelete(ev.id)}
                      className="text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs flex-shrink-0"
                      title="Eliminar evento"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>

                  <div className="text-[10px] text-text-muted">
                    {dayLabel} &middot;{" "}
                    {ev.start.dateTime ? `${formatTime(startStr)} - ${formatTime(endStr)}` : "Todo el dia"}
                  </div>

                  {ev.attendees && ev.attendees.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {ev.attendees.slice(0, 3).map((att) => (
                        <span
                          key={att.email}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-surface-dark text-text-muted truncate max-w-[120px]"
                        >
                          {att.email}
                        </span>
                      ))}
                      {ev.attendees.length > 3 && (
                        <span className="text-[9px] text-text-muted">+{ev.attendees.length - 3}</span>
                      )}
                    </div>
                  )}

                  {(ev.location || ev.hangoutLink) && (
                    <div className="text-[10px] text-text-muted truncate">
                      {ev.hangoutLink ? (
                        <a
                          href={ev.hangoutLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-mint hover:underline"
                        >
                          Google Meet
                        </a>
                      ) : (
                        ev.location
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
