import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { expectedRewards, REWARD_LABEL, type CompletedVisit } from "./membership-rules";
import { todayRome } from "./booking.server";

export type NewReward = { customerName: string; type: keyof typeof REWARD_LABEL; label: string; threshold: number | null; year: number | null };

export async function customerVisits(customerId: string) {
  const { data } = await supabaseAdmin.from("appointments").select("starts_at,status,services(counts_as_haircut)").eq("customer_id", customerId).eq("status", "completed");
  return (data ?? []).map((a): CompletedVisit => ({
    date: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(a.starts_at)),
    status: a.status, counts_as_haircut: !!a.services?.counts_as_haircut,
  }));
}

/** Crea solo i premi mancanti (vincolo unico customer_id+reward_key) e restituisce quelli nuovi. */
export async function syncRewards(customerId: string | null | undefined): Promise<NewReward[]> {
  if (!customerId) return [];
  const [{ data: c }, visits] = await Promise.all([
    supabaseAdmin.from("customers").select("first_name,last_name,birth_date").eq("id", customerId).maybeSingle(),
    customerVisits(customerId),
  ]);
  if (!c) return [];
  const expected = expectedRewards(visits, c.birth_date, todayRome());
  if (!expected.length) return [];
  const { data: inserted, error } = await supabaseAdmin.from("customer_rewards")
    .upsert(expected.map((r) => ({ customer_id: customerId, reward_type: r.type, reward_key: r.key, year: r.year, threshold: r.threshold })), { onConflict: "customer_id,reward_key", ignoreDuplicates: true })
    .select("reward_type,threshold,year");
  if (error) throw new Error("Impossibile aggiornare i premi");
  return (inserted ?? []).map((r) => ({
    customerName: `${c.first_name} ${c.last_name}`, type: r.reward_type as NewReward["type"],
    label: REWARD_LABEL[r.reward_type as NewReward["type"]], threshold: r.threshold, year: r.year,
  }));
}
