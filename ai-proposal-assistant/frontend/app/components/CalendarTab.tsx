"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "./Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Types ──────────────────────────────────────────────────────────────────

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
  meet_link: string;
  booked_by: string;
  description: string;
  created_at: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8..20

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

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function timeToFraction(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + (m || 0) / 60;
}

function formatHHMM(t: string): string {
  return t.slice(0, 5);
}

const BOOKING_COLORS = [
  "rgba(0, 245, 160, 0.25)",
  "rgba(124, 58, 237, 0.30)",
  "rgba(59, 130, 246, 0.30)",
  "rgba(245, 158, 11, 0.30)",
  "rgba(236, 72, 153, 0.30)",
  "rgba(20, 184, 166, 0.30)",
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function CalendarTab() {
  const { addToast } = useToast();

  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [loading, setLoading] = useState(true);

  // UI panels
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [tab, setTab] = useState<"calendar" | "slots">("calendar");

  // Slot form
  const [slotDay, setSlotDay] = useState(0);
  const [slotStart, setSlotStart] = useState("09:00");
  const [slotEnd, setSlotEnd] = useState("10:00");

  // Booking form
  const [bkDate, setBkDate] = useState(isoDate(new Date()));
  const [bkStart, setBkStart] = useState("09:00");
  const [bkEnd, setBkEnd] = useState("10:00");
  const [bkTitle, setBkTitle] = useState("");
  const [bkBy, setBkBy] = useState("");
  const [bkMeet, setBkMeet] = useState("");
  const [bkDesc, setBkDesc] = useState("");

  // Public link
  const publicLink = typeof window !== "undefined"
    ? `${window.location.origin}/booking`
    : "/booking";

  // ─── Load data ────────────────────────────────────────────────────────────

  const weekEnd = addDays(weekStart, 6);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, bRes] = await Promise.all([
        fetch(`${API}/api/agenda/slots`),
        fetch(`${API}/api/agenda/bookings?date_from=${isoDate(weekStart)}&date_to=${isoDate(addDays(weekStart, 6))}`),
      ]);
      const sData = await sRes.json();
      const bData = await bRes.json();
      setSlots(sData.slots ?? []);
      setBookings(bData.bookings ?? []);
    } catch {
      addToast("error", "Error cargando agenda");
    } finally {
      setLoading(false);
    }
  }, [weekStart, addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleCreateSlot = async () => {
    try {
      await fetch(`${API}/api/agenda/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day_of_week: slotDay, start_time: slotStart, end_time: slotEnd }),
      });
      addToast("success", "Horario disponible agregado");
      setShowSlotForm(false);
      loadData();
    } catch { addToast("error", "Error creando horario"); }
  };

  const handleDeleteSlot = async (id: string) => {
    try {
      await fetch(`${API}/api/agenda/slots/${id}`, { method: "DELETE" });
      addToast("success", "Horario eliminado");
      loadData();
    } catch { addToast("error", "Error eliminando horario"); }
  };

  const handleCreateBooking = async () => {
    if (!bkTitle || !bkBy) { addToast("error", "Completa titulo y nombre"); return; }
    try {
      await fetch(`${API}/api/agenda/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: bkDate, start_time: bkStart, end_time: bkEnd,
          title: bkTitle, booked_by: bkBy, meet_link: bkMeet, description: bkDesc,
        }),
      });
      addToast("success", "Reunión agendada");
      setShowBookingForm(false);
      setBkTitle(""); setBkBy(""); setBkMeet(""); setBkDesc("");
      loadData();
    } catch { addToast("error", "Error agendando reunión"); }
  };

  const handleDeleteBooking = async (id: string) => {
    try {
      await fetch(`${API}/api/agenda/bookings/${id}`, { method: "DELETE" });
      addToast("success", "Reunión eliminada");
      loadData();
    } catch { addToast("error", "Error eliminando reunión"); }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(publicLink);
    addToast("success", "Link copiado al portapapeles");
  };

  // ─── Week navigation ─────────────────────────────────────────────────────

  const prevWeek = () => setWeekStart(addDays(weekStart, -7));
  const nextWeek = () => setWeekStart(addDays(weekStart, 7));
  const goToday = () => setWeekStart(getMonday(new Date()));

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const now = new Date();
  const currentHourFraction = now.getHours() + now.getMinutes() / 60;

  // Slots for a given day of week
  const slotsForDow = (dow: number) => slots.filter((s) => s.day_of_week === dow);

  // Bookings for a given day
  const bookingsForDay = (day: Date) =>
    bookings.filter((b) => b.date === isoDate(day));

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h2 className="section-title">Agenda</h2>
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={() => setTab("calendar")}
              className={`px-3 py-1.5 text-xs font-medium transition-all ${
                tab === "calendar" ? "bg-brand-mint text-surface-black" : "bg-surface-dark text-text-muted hover:text-text-primary"
              }`}
            >
              Calendario
            </button>
            <button
              onClick={() => setTab("slots")}
              className={`px-3 py-1.5 text-xs font-medium transition-all ${
                tab === "slots" ? "bg-brand-mint text-surface-black" : "bg-surface-dark text-text-muted hover:text-text-primary"
              }`}
            >
              Horarios
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyLink}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-dark text-text-muted hover:text-text-primary transition-all"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
            title="Copiar link público para clientes"
          >
            Copiar link público
          </button>
          {tab === "calendar" && (
            <button
              onClick={() => { setShowBookingForm(!showBookingForm); setShowSlotForm(false); }}
              className="btn-primary px-4 py-1.5 text-xs font-medium"
            >
              + Nueva Reunión
            </button>
          )}
          {tab === "slots" && (
            <button
              onClick={() => { setShowSlotForm(!showSlotForm); setShowBookingForm(false); }}
              className="btn-primary px-4 py-1.5 text-xs font-medium"
            >
              + Agregar Horario
            </button>
          )}
        </div>
      </div>

      {/* Slot Form */}
      {showSlotForm && (
        <div className="glass-card p-6 space-y-4 animate-in fade-in slide-in-from-top-2" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-text-primary font-semibold text-sm">Agregar Horario Disponible</h3>
            <button onClick={() => setShowSlotForm(false)} className="text-text-muted hover:text-text-primary text-lg leading-none">&times;</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">Día</label>
              <select className="input-premium w-full" value={slotDay} onChange={(e) => setSlotDay(Number(e.target.value))}>
                {DAY_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Desde</label>
              <input type="time" className="input-premium w-full" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Hasta</label>
              <input type="time" className="input-premium w-full" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={handleCreateSlot} className="btn-primary px-6 py-2 text-sm font-medium">Guardar</button>
          </div>
        </div>
      )}

      {/* Booking Form */}
      {showBookingForm && (
        <div className="glass-card p-6 space-y-4 animate-in fade-in slide-in-from-top-2" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-text-primary font-semibold text-sm">Agendar Reunión</h3>
            <button onClick={() => setShowBookingForm(false)} className="text-text-muted hover:text-text-primary text-lg leading-none">&times;</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs text-text-muted mb-1">Título</label>
              <input className="input-premium w-full" placeholder="Nombre de la reunión..." value={bkTitle} onChange={(e) => setBkTitle(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Fecha</label>
              <input type="date" className="input-premium w-full" value={bkDate} onChange={(e) => setBkDate(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-1">Inicio</label>
                <input type="time" className="input-premium w-full" value={bkStart} onChange={(e) => setBkStart(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-1">Fin</label>
                <input type="time" className="input-premium w-full" value={bkEnd} onChange={(e) => setBkEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Agendado por</label>
              <input className="input-premium w-full" placeholder="Nombre o email..." value={bkBy} onChange={(e) => setBkBy(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Link de Meet (opcional)</label>
              <input className="input-premium w-full" placeholder="https://meet.google.com/..." value={bkMeet} onChange={(e) => setBkMeet(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-text-muted mb-1">Descripción (opcional)</label>
              <textarea className="input-premium w-full min-h-[60px] resize-y" placeholder="Detalles..." value={bkDesc} onChange={(e) => setBkDesc(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={handleCreateBooking} className="btn-primary px-6 py-2 text-sm font-medium">Agendar</button>
          </div>
        </div>
      )}

      {/* ─── SLOTS TAB ───────────────────────────────────────────────────── */}
      {tab === "slots" && (
        <div className="glass-card p-6 space-y-4" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 className="text-text-primary font-semibold text-sm">Horarios Disponibles (Recurrentes)</h3>
          <p className="text-text-muted text-xs">Estos horarios se muestran a los clientes en la página pública de booking.</p>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-brand-mint border-t-transparent rounded-full animate-spin" />
            </div>
          ) : slots.length === 0 ? (
            <p className="text-text-muted text-xs text-center py-8">No hay horarios configurados. Agrega uno con el botón de arriba.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {DAY_LABELS.map((label, dow) => {
                const daySlots = slotsForDow(dow);
                if (daySlots.length === 0) return null;
                return (
                  <div key={dow} className="glass-card p-4 space-y-2" style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div className="text-text-primary text-xs font-semibold">{label}</div>
                    {daySlots.map((s) => (
                      <div key={s.id} className="flex items-center justify-between group">
                        <span className="text-text-secondary text-xs">
                          {formatHHMM(s.start_time)} - {formatHHMM(s.end_time)}
                        </span>
                        <button
                          onClick={() => handleDeleteSlot(s.id)}
                          className="text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── CALENDAR TAB ────────────────────────────────────────────────── */}
      {tab === "calendar" && (
        <>
          {/* Week Navigation */}
          <div className="glass-card px-4 py-3 flex items-center justify-between" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <button onClick={prevWeek} className="p-2 rounded-lg hover:bg-surface-dark text-text-muted hover:text-text-primary transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <div className="flex items-center gap-3">
              <span className="text-text-primary text-sm font-medium">
                {formatDateShort(weekStart)} - {formatDateShort(weekEnd)}
              </span>
              <button onClick={goToday} className="px-3 py-1 rounded-md text-xs font-medium bg-surface-dark text-text-muted hover:text-text-primary transition-colors" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                Hoy
              </button>
            </div>
            <button onClick={nextWeek} className="p-2 rounded-lg hover:bg-surface-dark text-text-muted hover:text-text-primary transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>

          {/* Grid + Panel */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Weekly grid */}
            <div className="xl:col-span-3 glass-card overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              {loading && (
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
                    <div key={i} className={`p-3 text-center ${isToday ? "bg-brand-mint/5" : ""}`} style={{ borderLeft: "1px solid rgba(255,255,255,0.04)" }}>
                      <div className={`text-xs font-medium ${isToday ? "text-brand-mint" : "text-text-muted"}`}>{DAY_LABELS[i]}</div>
                      <div className={`text-lg font-semibold mt-0.5 ${isToday ? "text-brand-mint" : "text-text-primary"}`}>{day.getDate()}</div>
                    </div>
                  );
                })}
              </div>

              {/* Time grid */}
              <div className="grid grid-cols-[60px_repeat(7,1fr)] relative" style={{ minHeight: "624px" }}>
                {HOURS.map((hour) => (
                  <div key={hour} className="contents">
                    <div className="text-[10px] text-text-muted text-right pr-2 pt-0.5" style={{ gridColumn: "1", gridRow: hour - 7, height: "48px", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
                      {String(hour).padStart(2, "0")}:00
                    </div>
                    {weekDays.map((_, di) => (
                      <div key={di} style={{ gridColumn: di + 2, gridRow: hour - 7, height: "48px", borderTop: "1px solid rgba(255,255,255,0.03)", borderLeft: "1px solid rgba(255,255,255,0.04)" }} />
                    ))}
                  </div>
                ))}

                {/* Available slot overlays (green) */}
                {weekDays.map((_, di) =>
                  slotsForDow(di).map((slot, si) => {
                    const startH = timeToFraction(slot.start_time);
                    const endH = timeToFraction(slot.end_time);
                    const top = (startH - 8) * 48;
                    const height = (endH - startH) * 48;
                    if (top < 0 || height <= 0) return null;
                    return (
                      <div
                        key={`slot-${di}-${si}`}
                        className="absolute rounded-sm pointer-events-none z-0"
                        style={{
                          left: `calc(60px + ${di} * ((100% - 60px) / 7) + 1px)`,
                          width: `calc((100% - 60px) / 7 - 2px)`,
                          top: `${top}px`,
                          height: `${height}px`,
                          background: "rgba(0, 245, 160, 0.08)",
                          border: "1px solid rgba(0, 245, 160, 0.2)",
                        }}
                      />
                    );
                  })
                )}

                {/* Booking blocks */}
                {weekDays.map((day, di) =>
                  bookingsForDay(day).map((bk, bi) => {
                    const startH = timeToFraction(bk.start_time);
                    const endH = timeToFraction(bk.end_time);
                    const top = (startH - 8) * 48;
                    const height = Math.max((endH - startH) * 48, 20);
                    if (startH < 8 || startH > 20) return null;
                    const bg = BOOKING_COLORS[bi % BOOKING_COLORS.length];
                    return (
                      <div
                        key={bk.id}
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
                        title={`${bk.title}\n${formatHHMM(bk.start_time)} - ${formatHHMM(bk.end_time)}\nPor: ${bk.booked_by}`}
                      >
                        <div className="text-[10px] font-medium text-text-primary truncate leading-tight">{bk.title}</div>
                        {height > 28 && (
                          <div className="text-[9px] text-text-muted truncate">{formatHHMM(bk.start_time)} - {formatHHMM(bk.end_time)}</div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Current time indicator */}
                {weekDays.some((d) => sameDay(d, now)) && currentHourFraction >= 8 && currentHourFraction <= 20 && (
                  <div className="absolute z-20 pointer-events-none" style={{ left: "60px", right: "0", top: `${(currentHourFraction - 8) * 48}px` }}>
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <div className="flex-1 h-[2px] bg-red-500/60" />
                    </div>
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 px-4 py-2 text-[10px] text-text-muted" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(0, 245, 160, 0.15)", border: "1px solid rgba(0, 245, 160, 0.3)" }} />
                  Disponible
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(124, 58, 237, 0.30)", border: "1px solid rgba(124, 58, 237, 0.5)" }} />
                  Reunión agendada
                </span>
              </div>
            </div>

            {/* Event List Panel */}
            <div className="xl:col-span-1 glass-card p-4 space-y-3 max-h-[700px] overflow-y-auto" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <h3 className="text-text-primary font-semibold text-sm mb-2">Reuniones de la semana</h3>
              {bookings.length === 0 && !loading && (
                <p className="text-text-muted text-xs py-4 text-center">No hay reuniones esta semana</p>
              )}
              {bookings.map((bk, idx) => {
                const d = new Date(bk.date + "T00:00:00");
                const dayLabel = d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
                return (
                  <div
                    key={bk.id}
                    className="glass-card-hover p-3 rounded-lg space-y-1.5 group"
                    style={{
                      border: "1px solid rgba(255,255,255,0.04)",
                      borderLeft: `3px solid ${BOOKING_COLORS[idx % BOOKING_COLORS.length].replace("0.25", "0.7").replace("0.30", "0.7")}`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-text-primary text-xs font-medium leading-snug">{bk.title}</div>
                      <button
                        onClick={() => handleDeleteBooking(bk.id)}
                        className="text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs flex-shrink-0"
                        title="Eliminar"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                    <div className="text-[10px] text-text-muted">
                      {dayLabel} &middot; {formatHHMM(bk.start_time)} - {formatHHMM(bk.end_time)}
                    </div>
                    <div className="text-[10px] text-text-muted">Por: {bk.booked_by}</div>
                    {bk.meet_link && (
                      <a href={bk.meet_link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand-mint hover:underline">
                        Link de Meet
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
