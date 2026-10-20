import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { availableStarts, withinWorkingWindow } from "./booking-rules";
import { occurrencesBetween, type RecurringRule } from "./recurring-rules";

const TZ = "Europe/Rome";

function tzOffset(ts: number) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(Number(p['year']), Number(p['month']) - 1, Number(p['day']), Number(p['hour']), Number(p['minute']), Number(p['second']));
  return asUtc - Math.floor(ts / 1000) * 1000;
}

export function romeToUtc(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  return guess - tzOffset(guess - tzOffset(guess));
}

export function todayRome() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Messaggio unico mostrato quando PostgreSQL rifiuta una sovrapposizione. */
export const OVERLAP_MESSAGE = "Questo orario è appena stato occupato. Scegli un altro slot.";
export function isOverlapError(err: { code?: string } | null | undefined) {
  return err?.code === "23P01";
}

/** Professionisti attivi abilitati a un servizio (tabella barber_services). */
export async function eligibleBarberIds(serviceId: string) {
  const { data } = await supabaseAdmin.from("barber_services").select("barber_id, barbers!inner(active)").eq("service_id", serviceId).eq("barbers.active", true);
  return new Set((data ?? []).map((r) => r.barber_id));
}

export async function canPerform(barberId: string, serviceId: string) {
  return (await eligibleBarberIds(serviceId)).has(barberId);
}

type Busy = { barber_id: string; s: number; e: number };
export type SkipOccurrence = { recurringId: string; date: string };

/** Occorrenze dei clienti fissi come intervalli occupati (regole attive meno eccezioni). */
export async function recurringBusy(fromDate: string, toDate: string, opts: { skip?: SkipOccurrence | undefined; excludeRuleId?: string | undefined } = {}) {
  const [rules, exc] = await Promise.all([
    supabaseAdmin.from("recurring_appointments").select("id,barber_id,service_id,weekday,start_time,interval_weeks,start_date,end_date,active,services(duration_min)").eq("active", true).lte("start_date", toDate),
    supabaseAdmin.from("recurring_exceptions").select("recurring_id,occurrence_date").gte("occurrence_date", fromDate).lte("occurrence_date", toDate),
  ]);
  const list = (rules.data ?? []).filter((r) => r.id !== opts.excludeRuleId);
  const dur = new Map(list.map((r) => [r.id, r.services?.duration_min ?? 30]));
  return occurrencesBetween(list as RecurringRule[], exc.data ?? [], fromDate, toDate)
    .filter((o) => !(opts.skip && o.recurringId === opts.skip.recurringId && o.date === opts.skip.date))
    .map((o) => { const s = romeToUtc(o.date, o.time); return { barber_id: o.barber_id, s, e: s + (dur.get(o.recurringId) ?? 30) * 60000, recurringId: o.recurringId, date: o.date }; });
}

async function loadData(fromDate: string, toDate: string, excludeId?: string, skip?: SkipOccurrence) {
  const from = new Date(romeToUtc(fromDate, "00:00")).toISOString();
  const to = new Date(romeToUtc(addDays(toDate, 1), "00:00")).toISOString();
  let apptQ = supabaseAdmin.from("appointments").select("id,barber_id,starts_at,ends_at").eq("status", "confirmed").lt("starts_at", to).gt("ends_at", from);
  if (excludeId) apptQ = apptQ.neq("id", excludeId);
  const [barbers, hours, appts, blocks, links, fixed] = await Promise.all([
    supabaseAdmin.from("barbers").select("id,name,sort").eq("active", true).order("sort"),
    supabaseAdmin.from("working_hours").select("*"),
    apptQ,
    supabaseAdmin.from("blocked_slots").select("barber_id,starts_at,ends_at").lt("starts_at", to).gt("ends_at", from),
    supabaseAdmin.from("barber_services").select("barber_id,service_id,services!inner(duration_min,active)").eq("services.active", true),
    recurringBusy(fromDate, toDate, { skip }),
  ]);
  const busy: Busy[] = [...(appts.data ?? []), ...(blocks.data ?? [])].map((b) => ({
    barber_id: b.barber_id, s: Date.parse(b.starts_at), e: Date.parse(b.ends_at),
  })).concat(fixed);
  return { barbers: barbers.data ?? [], hours: hours.data ?? [], busy, links: links.data ?? [] };
}

type Data = Awaited<ReturnType<typeof loadData>>;

function workingWindows(data: Pick<Data, "hours">, barberId: string, date: string) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return data.hours.filter((h) => h.barber_id === barberId && h.weekday === wd).map((h) => ({ start: romeToUtc(date, h.start_time.slice(0, 5)), end: romeToUtc(date, h.end_time.slice(0, 5)) }));
}
function barberSlots(data: Data, barberId: string, date: string, dur: number) {
  return availableStarts(workingWindows(data, barberId, date), data.busy.filter((b) => b.barber_id === barberId).map((b) => ({ start: b.s, end: b.e })), dur, Date.now() + 30 * 60000);
}
export async function isWithinWorkingHours(barberId: string, date: string, time: string, dur: number) {
  const { data, error } = await supabaseAdmin.from("working_hours").select("*").eq("barber_id", barberId);
  if (error) throw new Error("Impossibile verificare gli orari di lavoro");
  return withinWorkingWindow(romeToUtc(date, time), dur, workingWindows({ hours: data ?? [] }, barberId, date));
}

/** Slot del giorno; con "any" cerca solo tra i professionisti abilitati al servizio. */
export async function getDaySlots(barberId: string | "any", date: string, dur: number, serviceId: string) {
  const data = await loadData(date, date);
  const allowed = new Set(data.links.filter((l) => l.service_id === serviceId).map((l) => l.barber_id));
  const active = data.barbers.map((b) => b.id).filter((id) => allowed.has(id));
  const ids = barberId === "any" ? active : active.filter((id) => id === barberId);
  const map = new Map<number, string>();
  for (const id of ids) for (const t of barberSlots(data, id, date, dur)) if (!map.has(t)) map.set(t, id);
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([t, id]) => ({ start: new Date(t).toISOString(), barberId: id }));
}

/** Primo orario libero per professionista, sulla durata del suo servizio più breve. */
export async function getNextSlots(fallbackDur: number) {
  const from = todayRome();
  const data = await loadData(from, addDays(from, 21));
  return data.barbers.map((b) => {
    const durs = data.links.filter((l) => l.barber_id === b.id).map((l) => l.services?.duration_min ?? fallbackDur);
    const dur = durs.length ? Math.min(...durs) : fallbackDur;
    for (let i = 0; i <= 21; i++) {
      const s = barberSlots(data, b.id, addDays(from, i), dur);
      const first = s[0];
      if (first !== undefined) return { barberId: b.id, start: new Date(first).toISOString() };
    }
    return { barberId: b.id, start: null as string | null };
  });
}

export async function isFree(barberId: string, startMs: number, dur: number) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(startMs));
  const data = await loadData(date, date);
  return barberSlots(data, barberId, date, dur).includes(startMs);
}

/** Controllo staff: nessuna sovrapposizione con appuntamenti confermati o orari bloccati. */
export async function hasConflict(barberId: string, startMs: number, endMs: number, excludeId?: string, skip?: SkipOccurrence, excludeRuleId?: string) {
  const s = new Date(startMs).toISOString();
  const e = new Date(endMs).toISOString();
  let q = supabaseAdmin.from("appointments").select("id", { count: "exact", head: true })
    .eq("barber_id", barberId).eq("status", "confirmed").lt("starts_at", e).gt("ends_at", s);
  if (excludeId) q = q.neq("id", excludeId);
  const day = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(ms));
  const [a, b, fixed] = await Promise.all([
    q,
    supabaseAdmin.from("blocked_slots").select("id", { count: "exact", head: true }).eq("barber_id", barberId).lt("starts_at", e).gt("ends_at", s),
    recurringBusy(day(startMs), day(endMs), { skip, excludeRuleId }),
  ]);
  const fixedHit = fixed.some((f) => f.barber_id === barberId && f.s < endMs && f.e > startMs);
  return (a.count ?? 0) > 0 || (b.count ?? 0) > 0 || fixedHit;
}
