import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { getDaySlots, isFree, hasConflict, romeToUtc, todayRome, addDays } from "@/lib/booking.server";
import { syncRewards } from "@/lib/membership.server";
import { firstOnOrAfter } from "@/lib/recurring-rules";
import { dailyReport } from "@/lib/report";
const ok = (n: string, c: boolean) => console.log(c ? "PASS" : "FAIL", n);
const N = "11111111-0000-0000-0000-000000000001", A = "11111111-0000-0000-0000-000000000004";
const { data: svc } = await db.from("services").select("id,name,duration_min").eq("name", "Taglio capelli").eq("active", true).single();
const { data: beard } = await db.from("services").select("id").eq("name", "Barba classica").single();
const F = firstOnOrAfter(addDays(todayRome(), 2), 5);
const at = (d: string, t = "17:00") => new Date(romeToUtc(d, t)).toISOString();
const has = async (d: string, b = N, sid = svc!.id, dur = 30, t = "17:00") => (await getDaySlots(b, d, dur, sid)).some((s) => s.start === at(d, t));
const { data: cust } = await db.from("customers").insert({ first_name: "Test", last_name: "Integrazione", phone: "+39 300 0000999" }).select("id").single();
const C = cust!.id;
try {
  ok("pre: 17:00 libero", await has(F));
  const { data: rule } = await db.from("recurring_appointments").insert({ customer_id: C, barber_id: N, service_id: svc!.id, weekday: 5, start_time: "17:00", interval_weeks: 1, start_date: F }).select("id").single();
  const R = rule!.id;
  ok("7 settimanale blocca F", !(await has(F)) && !(await isFree(N, romeToUtc(F, "17:00"), 30)));
  ok("7 settimanale blocca F+7", !(await has(addDays(F, 7))));
  ok("7 slot 16:50 (sovrapposto) bloccato", !(await has(F, N, svc!.id, 30, "16:50")));
  await db.from("recurring_appointments").update({ interval_weeks: 2 }).eq("id", R);
  ok("8 bisettimanale: F bloccato, F+7 libero, F+14 bloccato", !(await has(F)) && (await has(addDays(F, 7))) && !(await has(addDays(F, 14))));
  await db.from("recurring_exceptions").insert({ recurring_id: R, occurrence_date: F, kind: "skip" });
  ok("9 salta F: F libero, F+14 ancora bloccato", (await has(F)) && !(await has(addDays(F, 14))));
  ok("12 conflitto admin su F+14", await hasConflict(N, romeToUtc(addDays(F, 14), "17:10"), romeToUtc(addDays(F, 14), "17:40")));
  await db.from("recurring_appointments").update({ active: false }).eq("id", R);
  ok("10 pausa libera F+14", await has(addDays(F, 14)));
  await db.from("recurring_appointments").update({ active: true }).eq("id", R);
  // 11 materializzazione completata
  const D = addDays(F, 14);
  const { data: ap } = await db.from("appointments").insert({ barber_id: N, service_id: svc!.id, starts_at: at(D), ends_at: at(D, "17:30"), customer_id: C, customer_name: "Test Integrazione", customer_phone: "+39 300 0000999", code: "NDP-TST1", status: "completed", payment_status: "paid", amount_paid: 12, recurring_id: R, occurrence_date: D }).select("id").single();
  await db.from("recurring_exceptions").insert({ recurring_id: R, occurrence_date: D, kind: "materialized", appointment_id: ap!.id });
  const dup = await db.from("appointments").insert({ barber_id: N, service_id: svc!.id, starts_at: at(D), ends_at: at(D, "17:30"), customer_name: "x", customer_phone: "x", code: "NDP-TST2", status: "completed", recurring_id: R, occurrence_date: D });
  const { data: dayAppts } = await db.from("appointments").select("barber_id,status,payment_status,amount_paid").gte("starts_at", at(D, "00:00")).lt("starts_at", at(addDays(D, 1), "00:00"));
  console.log("11 parts", !!ap, !!dup.error, dailyReport(dayAppts ?? [], [{ id: N, name: "Nicola" }]).revenue, await has(D)); ok("11 storico + incasso + nessun duplicato", !!ap && !!dup.error && dailyReport(dayAppts ?? [], [{ id: N, name: "Nicola" }]).revenue >= 12);
  // 6 orari modificati dall'admin rispettati dal booking pubblico
  const { data: old } = await db.from("working_hours").select("*").eq("barber_id", A).eq("weekday", 5);
  ok("5 Alessia venerdì 09-13 e 14:30-19:30", (old ?? []).map((h) => h.start_time + h.end_time).sort().join() === "09:00:0013:00:00,14:30:0019:30:00");
  await db.from("working_hours").delete().eq("barber_id", A).eq("weekday", 5).eq("start_time", "14:30");
  const after = await has(F, A, beard!.id, 20, "15:00");
  await db.from("working_hours").insert({ barber_id: A, weekday: 5, start_time: "14:30", end_time: "19:30" });
  ok("6 booking pubblico rispetta orari modificati", !after && (await has(F, A, beard!.id, 20, "15:00")));
  // Membership
  const past = (i: number, status = "completed") => ({ barber_id: N, service_id: svc!.id, starts_at: new Date(Date.UTC(2026, 0, 2 + i, 9)).toISOString(), ends_at: new Date(Date.UTC(2026, 0, 2 + i, 9, 30)).toISOString(), customer_id: C, customer_name: "T", customer_phone: "x", code: "NDP-M" + i, status, payment_status: "paid", amount_paid: 12 });
  await db.from("appointments").insert(Array.from({ length: 18 }, (_, i) => past(i)));
  await db.from("appointments").insert(Array.from({ length: 5 }, (_, i) => past(100 + i, "cancelled")));
  await db.from("appointments").insert({ ...past(150), service_id: beard!.id });
  ok("18/19 cancelled e non-taglio non contano", (await syncRewards(C)).length === 0);
  await db.from("appointments").insert(past(200));
  const r20 = await syncRewards(C);
  ok("13 il 20° taglio crea una lacca", r20.length === 1 && r20[0]!.type === "hairspray" && (await syncRewards(C)).length === 0);
  await db.from("appointments").insert(Array.from({ length: 20 }, (_, i) => past(220 + i)));
  const r40 = await syncRewards(C);
  const { data: all } = await db.from("customer_rewards").select("reward_key").eq("customer_id", C);
  ok("14/15 40°: seconda lacca + gift card annuale", r40.map((r) => r.type).sort().join() === "gift_card_20,hairspray" && all!.length === 3);
  ok("16 annuale non duplicato", (await syncRewards(C)).length === 0);
  await db.from("customers").update({ birth_date: "1990-" + todayRome().slice(5) }).eq("id", C);
  const b1 = await syncRewards(C), b2 = await syncRewards(C);
  ok("17 compleanno una volta", b1.length === 1 && b1[0]!.type === "birthday_beard" && b2.length === 0);
} finally {
  await db.from("customer_rewards").delete().eq("customer_id", C);
  const { data: rs } = await db.from("recurring_appointments").select("id").eq("customer_id", C);
  await db.from("appointments").delete().eq("customer_id", C);
  await db.from("appointments").delete().eq("code", "NDP-TST2");
  for (const r of rs ?? []) { await db.from("recurring_exceptions").delete().eq("recurring_id", r.id); await db.from("recurring_appointments").delete().eq("id", r.id); }
  await db.from("customers").delete().eq("id", C);
}
