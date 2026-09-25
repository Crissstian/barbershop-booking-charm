import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TZ = "Europe/Rome";
const STEP = 15;

function tzOffset(ts: number) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p['year']!, +p['month']! - 1, +p['day']!, +p['hour']!, +p['minute']!, +p['second']!);
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

type Busy = { barber_id: string; s: number; e: number };

async function loadData(fromDate: string, toDate: string) {
  const from = new Date(romeToUtc(fromDate, "00:00")).toISOString();
  const to = new Date(romeToUtc(addDays(toDate, 1), "00:00")).toISOString();
  const [barbers, hours, appts, blocks] = await Promise.all([
    supabaseAdmin.from("barbers").select("id,name,sort").eq("active", true).order("sort"),
    supabaseAdmin.from("working_hours").select("*"),
    supabaseAdmin.from("appointments").select("barber_id,starts_at,ends_at").eq("status", "confirmed").lt("starts_at", to).gt("ends_at", from),
    supabaseAdmin.from("blocked_slots").select("barber_id,starts_at,ends_at").lt("starts_at", to).gt("ends_at", from),
  ]);
  const busy: Busy[] = [...(appts.data ?? []), ...(blocks.data ?? [])].map((b) => ({
    barber_id: b.barber_id, s: Date.parse(b.starts_at), e: Date.parse(b.ends_at),
  }));
  return { barbers: barbers.data ?? [], hours: hours.data ?? [], busy };
}

type Data = Awaited<ReturnType<typeof loadData>>;

function barberSlots(data: Data, barberId: string, date: string, dur: number) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const minStart = Date.now() + 30 * 60000;
  const out: number[] = [];
  for (const h of data.hours.filter((h) => h.barber_id === barberId && h.weekday === wd)) {
    const s = romeToUtc(date, h.start_time.slice(0, 5));
    const e = romeToUtc(date, h.end_time.slice(0, 5));
    for (let t = s; t + dur * 60000 <= e; t += STEP * 60000) {
      const te = t + dur * 60000;
      if (t < minStart) continue;
      if (data.busy.some((b) => b.barber_id === barberId && b.s < te && b.e > t)) continue;
      out.push(t);
    }
  }
  return out;
}

export async function getDaySlots(barberId: string | "any", date: string, dur: number) {
  const data = await loadData(date, date);
  const map = new Map<number, string>();
  const ids = barberId === "any" ? data.barbers.map((b) => b.id) : [barberId];
  for (const id of ids) for (const t of barberSlots(data, id, date, dur)) if (!map.has(t)) map.set(t, id);
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([t, id]) => ({ start: new Date(t).toISOString(), barberId: id }));
}

export async function getNextSlots(dur: number) {
  const from = todayRome();
  const data = await loadData(from, addDays(from, 21));
  return data.barbers.map((b) => {
    for (let i = 0; i <= 21; i++) {
      const s = barberSlots(data, b.id, addDays(from, i), dur);
      if (s.length) return { barberId: b.id, start: new Date(s[0]).toISOString() };
    }
    return { barberId: b.id, start: null as string | null };
  });
}

export async function isFree(barberId: string, startMs: number, dur: number) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(startMs));
  const data = await loadData(date, date);
  return barberSlots(data, barberId, date, dur).includes(startMs);
}
