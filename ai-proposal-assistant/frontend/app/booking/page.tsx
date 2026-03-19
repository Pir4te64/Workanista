"use client";

import { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Slot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface Booking {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  title: string;
  booked_by: string;
}

const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function formatHHMM(t: string): string {
  return t.slice(0, 5);
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Generate 30-minute time slots within a slot range
function generateTimeSlots(startTime: string, endTime: string): { start: string; end: string }[] {
  const result: { start: string; end: string }[] = [];
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let current = sh * 60 + (sm || 0);
  const end = eh * 60 + (em || 0);
  while (current + 30 <= end) {
    const h1 = Math.floor(current / 60);
    const m1 = current % 60;
    const h2 = Math.floor((current + 30) / 60);
    const m2 = (current + 30) % 60;
    result.push({
      start: `${String(h1).padStart(2, "0")}:${String(m1).padStart(2, "0")}`,
      end: `${String(h2).padStart(2, "0")}:${String(m2).padStart(2, "0")}`,
    });
    current += 30;
  }
  return result;
}

export default function BookingPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));

  // Form state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<{ start: string; end: string } | null>(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [meetLink, setMeetLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dateFrom = isoDate(weekStart);
      const dateTo = isoDate(addDays(weekStart, 6));
      const [sRes, bRes] = await Promise.all([
        fetch(`${API}/api/agenda/slots`),
        fetch(`${API}/api/agenda/bookings?date_from=${dateFrom}&date_to=${dateTo}`),
      ]);
      const sData = await sRes.json();
      const bData = await bRes.json();
      setSlots(sData.slots ?? []);
      setBookings(bData.bookings ?? []);
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { loadData(); }, [loadData]);

  const isSlotBooked = (date: string, start: string, end: string) =>
    bookings.some((b) => b.date === date && b.start_time.slice(0, 5) === start && b.end_time.slice(0, 5) === end);

  const handleBook = async () => {
    if (!selectedDate || !selectedTime || !name || !title) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/agenda/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          start_time: selectedTime.start,
          end_time: selectedTime.end,
          title,
          booked_by: name,
          meet_link: meetLink,
          description: "",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setSuccess(true);
      setSelectedDate(null);
      setSelectedTime(null);
      setName("");
      setTitle("");
      setMeetLink("");
      loadData();
    } catch {
      alert("Error al agendar. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const prevWeek = () => { setWeekStart(addDays(weekStart, -7)); setSelectedDate(null); setSelectedTime(null); };
  const nextWeek = () => { setWeekStart(addDays(weekStart, 7)); setSelectedDate(null); setSelectedTime(null); };

  const today = new Date();

  return (
    <div className="min-h-screen bg-surface-black text-text-primary">
      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 pt-10 pb-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(0, 245, 160, 0.1)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00F5A0" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">CruzNegraDev</h1>
        </div>
        <p className="text-text-muted text-sm">Selecciona un horario disponible para agendar una reunión</p>
      </div>

      {/* Success message */}
      {success && (
        <div className="max-w-4xl mx-auto px-4 mb-6">
          <div className="rounded-xl p-6 text-center" style={{ background: "rgba(0, 245, 160, 0.1)", border: "1px solid rgba(0, 245, 160, 0.3)" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00F5A0" strokeWidth="2" className="mx-auto mb-3">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <h2 className="text-lg font-semibold text-brand-mint mb-1">Reunión agendada</h2>
            <p className="text-text-muted text-sm">Te confirmamos a la brevedad. Gracias.</p>
            <button onClick={() => setSuccess(false)} className="mt-4 px-4 py-2 rounded-lg text-xs font-medium bg-surface-dark text-text-muted hover:text-text-primary" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              Agendar otra
            </button>
          </div>
        </div>
      )}

      {!success && (
        <div className="max-w-4xl mx-auto px-4 space-y-6 pb-16">
          {/* Week Navigation */}
          <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <button onClick={prevWeek} className="p-2 rounded-lg hover:bg-surface-dark text-text-muted hover:text-text-primary transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <span className="text-text-primary text-sm font-medium">
              {weekStart.toLocaleDateString("es-ES", { day: "numeric", month: "long" })} - {addDays(weekStart, 6).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
            </span>
            <button onClick={nextWeek} className="p-2 rounded-lg hover:bg-surface-dark text-text-muted hover:text-text-primary transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-brand-mint border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {weekDays.map((day, i) => {
                const dow = i; // 0=Lun
                const dateStr = isoDate(day);
                const daySlots = slots.filter((s) => s.day_of_week === dow);
                const isPast = day < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const isSelected = selectedDate === dateStr;

                if (daySlots.length === 0) return (
                  <div key={i} className="rounded-xl p-4 opacity-40" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div className="text-xs font-semibold text-text-muted mb-1">{DAY_LABELS[dow]}</div>
                    <div className="text-sm text-text-primary mb-3">{day.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</div>
                    <p className="text-[10px] text-text-muted text-center py-4">Sin disponibilidad</p>
                  </div>
                );

                // Build available time blocks
                const timeBlocks = daySlots.flatMap((s) => generateTimeSlots(s.start_time, s.end_time));

                return (
                  <div
                    key={i}
                    className={`rounded-xl p-4 transition-all ${isSelected ? "ring-1 ring-brand-mint" : ""}`}
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="text-xs font-semibold text-text-muted mb-1">{DAY_LABELS[dow]}</div>
                    <div className="text-sm text-text-primary mb-3">{day.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</div>
                    <div className="space-y-1.5">
                      {timeBlocks.map((tb) => {
                        const booked = isSlotBooked(dateStr, tb.start, tb.end);
                        const isChosen = isSelected && selectedTime?.start === tb.start && selectedTime?.end === tb.end;
                        return (
                          <button
                            key={`${tb.start}-${tb.end}`}
                            disabled={booked || isPast}
                            onClick={() => {
                              setSelectedDate(dateStr);
                              setSelectedTime(tb);
                            }}
                            className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                              booked
                                ? "bg-surface-dark/50 text-text-muted/40 cursor-not-allowed line-through"
                                : isPast
                                ? "bg-surface-dark/30 text-text-muted/30 cursor-not-allowed"
                                : isChosen
                                ? "bg-brand-mint text-surface-black"
                                : "bg-surface-dark text-text-secondary hover:bg-brand-mint/20 hover:text-brand-mint"
                            }`}
                            style={{ border: isChosen ? "1px solid #00F5A0" : "1px solid rgba(255,255,255,0.04)" }}
                          >
                            {formatHHMM(tb.start)} - {formatHHMM(tb.end)}
                            {booked && " (ocupado)"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Booking Form */}
          {selectedDate && selectedTime && (
            <div className="rounded-xl p-6 space-y-4 animate-in fade-in slide-in-from-bottom-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(0, 245, 160, 0.2)" }}>
              <h3 className="text-text-primary font-semibold text-sm">
                Agendar reunión — {new Date(selectedDate + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} de {selectedTime.start} a {selectedTime.end}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Tu nombre *</label>
                  <input className="input-premium w-full" placeholder="Juan Pérez" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Título de la reunión *</label>
                  <input className="input-premium w-full" placeholder="Consulta sobre proyecto..." value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-text-muted mb-1">Link de Meet (opcional)</label>
                  <input className="input-premium w-full" placeholder="https://meet.google.com/..." value={meetLink} onChange={(e) => setMeetLink(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleBook}
                  disabled={submitting || !name || !title}
                  className="btn-primary px-6 py-2.5 text-sm font-medium disabled:opacity-50"
                >
                  {submitting ? "Agendando..." : "Confirmar Reunión"}
                </button>
                <button
                  onClick={() => { setSelectedDate(null); setSelectedTime(null); }}
                  className="px-4 py-2 rounded-lg text-xs text-text-muted hover:text-text-primary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-6 text-[10px] text-text-muted">
        CruzNegraDev LLC
      </div>
    </div>
  );
}
