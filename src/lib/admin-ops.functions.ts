import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertAdmin, customerSnapshot, validateWindow } from "./admin.functions";
import { firstOnOrAfter, nextOccurrence, occurrencesBetween, type RecurringRule } from "./recurring-rules";
import { isBirthday, progress } from "./membership-rules";

const uuid = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const url = z.string().trim().max(2000).refine((v) => v === "" || v.startsWith("/") || v.startsWith("https://"), "Indirizzo immagine non valido");
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

/* ---------- Staff ---------- */
export const saveAdminBarber = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: uuid, name: z.string().trim().min(1).max(60), role_title: z.string().trim().min(1).max(80),
    bio: z.string().trim().max(600), photo_url: url, active: z.boolean(), serviceIds: z.array(uuid).max(100),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { error } = await db.from("barbers").update({ name: data.name, role_title: data.role_title, bio: data.bio || null, photo_url: data.photo_url || null, active: data.active }).eq("id", data.id);
    if (error) throw new Error("Impossibile salvare il professionista");
    await db.from("barber_services").delete().eq("barber_id", data.id);
    if (data.serviceIds.length) {
      const { error: e2 } = await db.from("barber_services").insert(data.serviceIds.map((service_id) => ({ barber_id: data.id, service_id })));
      if (e2) throw new Error("Impossibile salvare i servizi");
    }
    return { ok: true };
  });

const daysSchema = z.array(z.object({ weekday: z.number().int().min(0).max(6), ranges: z.array(z.object({ start: hhmm, end: hhmm })).max(4) })).max(7);
export function validateHours(days: z.infer<typeof daysSchema>) {
  for (const d of days) {
    const r = [...d.ranges].sort((a, b) => a.start.localeCompare(b.start));
    r.forEach((x, i) => {
      if (x.start >= x.end) throw new Error("Ogni fascia deve finire dopo l'inizio");
      const prev = r[i - 1];
      if (prev && prev.end > x.start) throw new Error("Le fasce dello stesso giorno non possono sovrapporsi");
    });
  }
}
async function writeHours(barberId: string, days: z.infer<typeof daysSchema>) {
  const db = await admin();
  await db.from("working_hours").delete().eq("barber_id", barberId);
  const rows = days.flatMap((d) => d.ranges.map((r) => ({ barber_id: barberId, weekday: d.weekday, start_time: r.start, end_time: r.end })));
  if (rows.length) { const { error } = await db.from("working_hours").insert(rows); if (error) throw new Error("Impossibile salvare gli orari"); }
}
export const saveAdminHours = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ barberId: uuid, days: daysSchema, copyTo: z.array(uuid).max(10).default([]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    validateHours(data.days);
    for (const id of [data.barberId, ...data.copyTo]) await writeHours(id, data.days);
    return { ok: true };
  });

export const addAdminBlock = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ barberId: uuid, mode: z.enum(["hours", "days"]), from: day, to: day, fromTime: hhmm.optional(), toTime: hhmm.optional(), reason: z.string().trim().max(120).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { romeToUtc, addDays } = await import("./booking.server");
    let s: number, e: number;
    if (data.mode === "hours") {
      if (!data.fromTime || !data.toTime || data.fromTime >= data.toTime) throw new Error("Controlla gli orari dell'assenza");
      s = romeToUtc(data.from, data.fromTime); e = romeToUtc(data.from, data.toTime);
    } else {
      if (data.to < data.from) throw new Error("La data di fine è prima dell'inizio");
      s = romeToUtc(data.from, "00:00"); e = romeToUtc(addDays(data.to, 1), "00:00");
    }
    const { error } = await (await admin()).from("blocked_slots").insert({ barber_id: data.barberId, starts_at: new Date(s).toISOString(), ends_at: new Date(e).toISOString(), reason: data.reason || null });
    if (error) throw new Error("Impossibile salvare l'assenza");
    return { ok: true };
  });
export const removeAdminBlock = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({ id: uuid }).parse(d)).handler(async ({ data, context }) => {
  await assertAdmin(context);
  await (await admin()).from("blocked_slots").delete().eq("id", data.id);
  return { ok: true };
});

/* ---------- Clienti fissi ---------- */
const ruleSchema = z.object({
  id: uuid.optional(), customerId: uuid, barberId: uuid, serviceId: uuid, weekday: z.number().int().min(0).max(6), time: hhmm,
  intervalWeeks: z.union([z.literal(1), z.literal(2)]), startDate: day, endDate: day.optional().or(z.literal("")), notes: z.string().trim().max(300).optional(),
});
export const saveAdminRecurring = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => ruleSchema.parse(d)).handler(async ({ data, context }) => {
  await assertAdmin(context);
  const db = await admin();
  const { canPerform, recurringBusy, romeToUtc, todayRome, addDays } = await import("./booking.server");
  if (!(await canPerform(data.barberId, data.serviceId))) throw new Error("Questo professionista non esegue il servizio scelto.");
  const { data: svc } = await db.from("services").select("duration_min").eq("id", data.serviceId).single();
  if (!svc) throw new Error("Servizio non trovato");
  const start = firstOnOrAfter(data.startDate, data.weekday);
  const end = data.endDate || null;
  if (end && end < start) throw new Error("La data di fine è prima della prima occorrenza");
  const rule: RecurringRule = { id: data.id ?? "new", barber_id: data.barberId, service_id: data.serviceId, weekday: data.weekday, start_time: data.time, interval_weeks: data.intervalWeeks, start_date: start, end_date: end, active: true };
  // Collisioni sulle prossime 26 settimane: appuntamenti, assenze e altri clienti fissi.
  const from = start > todayRome() ? start : todayRome();
  const to = addDays(from, 182);
  const occ = occurrencesBetween([rule], [], from, to);
  const dur = svc.duration_min * 60000;
  const [appts, blocks, fixed] = await Promise.all([
    db.from("appointments").select("starts_at,ends_at").eq("barber_id", data.barberId).eq("status", "confirmed").gte("ends_at", new Date(romeToUtc(from, "00:00")).toISOString()),
    db.from("blocked_slots").select("starts_at,ends_at").eq("barber_id", data.barberId).gte("ends_at", new Date(romeToUtc(from, "00:00")).toISOString()),
    recurringBusy(from, to, data.id ? { excludeRuleId: data.id } : {}),
  ]);
  const busy = [...(appts.data ?? []), ...(blocks.data ?? [])].map((b) => ({ s: Date.parse(b.starts_at), e: Date.parse(b.ends_at) }))
    .concat(fixed.filter((f) => f.barber_id === data.barberId));
  const clash = occ.find((o) => { const s = romeToUtc(o.date, o.time); return busy.some((b) => b.s < s + dur && b.e > s); });
  if (clash) throw new Error(`Orario già occupato il ${clash.date.split("-").reverse().join("/")}. Scegli un altro orario.`);
  const row = { customer_id: data.customerId, barber_id: data.barberId, service_id: data.serviceId, weekday: data.weekday, start_time: data.time, interval_weeks: data.intervalWeeks, start_date: start, end_date: end, notes: data.notes || null };
  const { error } = data.id ? await db.from("recurring_appointments").update(row).eq("id", data.id) : await db.from("recurring_appointments").insert(row);
  if (error) throw new Error("Impossibile salvare il cliente fisso");
  return { ok: true };
});

export const setAdminRecurringState = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, action: z.enum(["pause", "resume", "end", "skip-next"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { todayRome, addDays } = await import("./booking.server");
    const today = todayRome();
    if (data.action === "skip-next") {
      const [{ data: r }, { data: exc }] = await Promise.all([
        db.from("recurring_appointments").select("*").eq("id", data.id).single(),
        db.from("recurring_exceptions").select("recurring_id,occurrence_date").eq("recurring_id", data.id),
      ]);
      if (!r) throw new Error("Cliente fisso non trovato");
      const next = nextOccurrence(r, exc ?? [], today);
      if (!next) throw new Error("Nessuna prossima data da saltare");
      await db.from("recurring_exceptions").insert({ recurring_id: data.id, occurrence_date: next, kind: "skip" });
      return { ok: true, date: next };
    }
    const patch = data.action === "pause" ? { active: false } : data.action === "resume" ? { active: true } : { end_date: addDays(today, -1), active: false };
    if (data.action === "end") {
      const { data: r } = await db.from("recurring_appointments").select("start_date").eq("id", data.id).single();
      if (r && r.start_date > patch.end_date!) patch.end_date = r.start_date;
    }
    const { error } = await db.from("recurring_appointments").update(patch).eq("id", data.id);
    if (error) throw new Error("Impossibile aggiornare");
    return { ok: true, date: null };
  });

/** Occorrenze virtuali di un giorno per l'agenda. */
export const getAdminRecurringDay = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({ date: day }).parse(d)).handler(async ({ data, context }) => {
  await assertAdmin(context);
  const db = await admin();
  const { romeToUtc } = await import("./booking.server");
  const [rules, exc] = await Promise.all([
    db.from("recurring_appointments").select("*,customers(id,first_name,last_name,phone),services(name,price,price_from,duration_min,category)").eq("active", true),
    db.from("recurring_exceptions").select("recurring_id,occurrence_date").eq("occurrence_date", data.date),
  ]);
  const list = rules.data ?? [];
  return occurrencesBetween(list, exc.data ?? [], data.date, data.date).map((o) => {
    const r = list.find((x) => x.id === o.recurringId)!;
    const s = romeToUtc(o.date, o.time);
    return {
      recurringId: o.recurringId, date: o.date, barber_id: o.barber_id, service_id: o.service_id, customer_id: r.customer_id,
      starts_at: new Date(s).toISOString(), ends_at: new Date(s + (r.services?.duration_min ?? 30) * 60000).toISOString(),
      customer_name: r.customers ? `${r.customers.first_name} ${r.customers.last_name}` : "Cliente", customer_phone: r.customers?.phone ?? "",
      service: r.services, notes: r.notes, interval_weeks: r.interval_weeks,
    };
  });
});

/** Trasforma un'occorrenza in un vero appuntamento: completato, annullato o spostato. */
export const materializeAdminRecurring = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    recurringId: uuid, date: day, action: z.enum(["complete", "cancel", "move"]),
    mode: z.enum(["paid", "complimentary"]).optional(), amount: z.number().min(0).max(99999).optional(),
    move: z.object({ barberId: uuid, serviceId: uuid, date: day, time: hhmm, confirmException: z.boolean().default(false) }).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { romeToUtc, isOverlapError, OVERLAP_MESSAGE } = await import("./booking.server");
    const { data: r } = await db.from("recurring_appointments").select("*,services(duration_min)").eq("id", data.recurringId).single();
    if (!r) throw new Error("Cliente fisso non trovato");
    const { data: exc } = await db.from("recurring_exceptions").select("recurring_id,occurrence_date").eq("recurring_id", r.id).eq("occurrence_date", data.date);
    if (!occurrencesBetween([r], exc ?? [], data.date, data.date).length) throw new Error("Questa occorrenza è già stata gestita");
    let win: { starts_at: string; ends_at: string };
    let barberId = r.barber_id, serviceId = r.service_id;
    if (data.action === "move") {
      if (!data.move) throw new Error("Indica il nuovo orario");
      barberId = data.move.barberId; serviceId = data.move.serviceId;
      win = await validateWindow(barberId, serviceId, data.move.date, data.move.time, data.move.confirmException, undefined, { recurringId: r.id, date: data.date });
    } else {
      const s = romeToUtc(data.date, r.start_time.slice(0, 5));
      win = { starts_at: new Date(s).toISOString(), ends_at: new Date(s + (r.services?.duration_min ?? 30) * 60000).toISOString() };
    }
    if (data.action === "complete" && data.mode === "paid" && data.amount === undefined) throw new Error("Inserisci l'importo ricevuto");
    const status = data.action === "complete" ? "completed" : data.action === "cancel" ? "cancelled" : "confirmed";
    const pay = data.action === "complete" ? { payment_status: data.mode ?? "paid", amount_paid: data.mode === "complimentary" ? 0 : Math.round((data.amount ?? 0) * 100) / 100 } : {};
    const snap = await customerSnapshot(r.customer_id);
    const code = "NDP-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    const { data: appt, error } = await db.from("appointments").insert({
      barber_id: barberId, service_id: serviceId, ...win, ...snap, ...pay, status, code,
      recurring_id: r.id, occurrence_date: data.date, staff_notes: r.notes ? `Cliente fisso · ${r.notes}` : "Cliente fisso",
    }).select("id").single();
    if (isOverlapError(error)) throw new Error(OVERLAP_MESSAGE);
    if (error || !appt) throw new Error("Questa occorrenza è già stata gestita");
    await db.from("recurring_exceptions").insert({ recurring_id: r.id, occurrence_date: data.date, kind: "materialized", appointment_id: appt.id });
    const { syncRewards } = await import("./membership.server");
    return { ok: true, rewards: status === "completed" ? await syncRewards(r.customer_id) : [] };
  });

/* ---------- Prodotti ---------- */
export const saveAdminProduct = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid.optional(), brand: z.string().trim().max(80), name: z.string().trim().min(1).max(120), description: z.string().trim().max(400), image_url: url, sort: z.number().int().min(0).max(9999), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { id, ...f } = data;
    const row = { ...f, description: f.description || null, image_url: f.image_url || null };
    const { error } = id ? await db.from("products").update(row).eq("id", id) : await db.from("products").insert(row);
    if (error) throw new Error("Impossibile salvare il prodotto");
    return { ok: true };
  });
export const deleteAdminProduct = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({ id: uuid }).parse(d)).handler(async ({ data, context }) => {
  await assertAdmin(context);
  await (await admin()).from("products").delete().eq("id", data.id);
  return { ok: true };
});

/* ---------- Clienti e Membership ---------- */
export const getAdminCustomer = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({ id: uuid }).parse(d)).handler(async ({ data, context }) => {
  await assertAdmin(context);
  const db = await admin();
  const { todayRome } = await import("./booking.server");
  const { customerVisits } = await import("./membership.server");
  const [c, appts, rewards, rules, visits] = await Promise.all([
    db.from("customers").select("id,first_name,last_name,phone,email,birth_date").eq("id", data.id).single(),
    db.from("appointments").select("id,starts_at,status,payment_status,amount_paid,services(name),barbers(name)").eq("customer_id", data.id).order("starts_at", { ascending: false }).limit(60),
    db.from("customer_rewards").select("id,reward_type,status,issued_at,redeemed_at,year,threshold").eq("customer_id", data.id).order("issued_at", { ascending: false }),
    db.from("recurring_appointments").select("id,weekday,start_time,interval_weeks,active,end_date,barbers(name),services(name)").eq("customer_id", data.id),
    customerVisits(data.id),
  ]);
  if (!c.data) throw new Error("Cliente non trovato");
  const today = todayRome();
  const list = appts.data ?? [];
  const now = Date.now();
  const past = list.filter((a) => a.status === "completed");
  const upcoming = list.filter((a) => a.status === "confirmed" && Date.parse(a.starts_at) > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return {
    customer: c.data, history: list, rewards: rewards.data ?? [], rules: rules.data ?? [],
    stats: { ...progress(visits, today), lastVisit: past[0]?.starts_at ?? null, nextVisit: upcoming[0]?.starts_at ?? null },
  };
});

export const updateAdminCustomerContact = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, phone: z.string().trim().min(6).max(25), email: z.string().trim().toLowerCase().email().max(120).or(z.literal("")), birthDate: day.or(z.literal("")) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (await admin()).from("customers").update({ phone: data.phone, email: data.email || null, birth_date: data.birthDate || null }).eq("id", data.id);
    if (error) throw new Error(error.code === "23505" ? "Telefono o email già usati da un altro cliente" : "Impossibile salvare");
    return { ok: true };
  });

export const redeemAdminReward = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({ id: uuid }).parse(d)).handler(async ({ data, context }) => {
  await assertAdmin(context);
  await (await admin()).from("customer_rewards").update({ status: "redeemed", redeemed_at: new Date().toISOString() }).eq("id", data.id).eq("status", "available");
  return { ok: true };
});

/** Compleanni di oggi: assicura una sola Barba omaggio per anno. */
export const getAdminBirthdays = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context);
  const db = await admin();
  const { todayRome } = await import("./booking.server");
  const { syncRewards } = await import("./membership.server");
  const today = todayRome();
  const { data } = await db.from("customers").select("id,first_name,last_name,phone,birth_date").not("birth_date", "is", null).eq("active", true);
  const list = (data ?? []).filter((c) => isBirthday(c.birth_date, today));
  for (const c of list) await syncRewards(c.id);
  return list.map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`, phone: c.phone }));
});
