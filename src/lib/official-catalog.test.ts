import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
const url = process.env['SUPABASE_URL'];
const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const live = url && key ? createClient(url, key, { auth: { persistSession: false }, global: { fetch: (input, init) => { const headers = new Headers(init?.headers); if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization"); headers.set("apikey", key); return fetch(input, { ...init, headers }); } } }) : null;
describe.skipIf(!live)("Listino ufficiale salvato", () => {
  const expected = [
    ["Taglio capelli + shampoo", 18, 30, false, "capelli"],
    ["Taglio capelli", 12, 30, false, "capelli"],
    ["Taglio bambino + shampoo", 14, 30, false, "capelli"],
    ["Taglio capelli bambino", 10, 30, false, "capelli"],
    ["Shampoo + piega", 8, 80, false, "capelli"],
    ["Trattamento alla keratina", 20, 80, true, "capelli"],
    ["Colore", 10, 80, true, "capelli"],
    ["Barba classica", 7, 20, false, "barba"],
    ["Rasatura barba", 5, 20, false, "barba"],
    ["Barba + trattamento", 8, 20, false, "barba"],
    ["Barba + colore", 7, 20, false, "barba"],
  ] as const;
  for (const [name, price, duration, from, category] of expected) {
    it(`${name}: prezzo ${price}, durata ${duration}, a partire da ${from}`, async () => {
      if (!live) throw new Error("Accesso di test non disponibile");
      const { data, error } = await live.from("services").select("price,duration_min,price_from,category").eq("name", name).eq("active", true).single();
      expect(error).toBeNull();
      expect(data).toEqual({ price, duration_min: duration, price_from: from, category });
    });
  }
  it("esattamente 11 attivi e Alessia solo per i quattro servizi Barba", async () => {
    if (!live) throw new Error("Accesso di test non disponibile");
    const { count } = await live.from("services").select("id", { count: "exact", head: true }).eq("active", true);
    expect(count).toBe(11);
    const { data: barber } = await live.from("barbers").select("id,bio").eq("slug", "alessia").single();
    if (!barber) throw new Error("Alessia assente");
    expect(barber.bio).toBeNull();
    const { data: links } = await live.from("barber_services").select("services!inner(name,category,active)").eq("barber_id", barber.id).eq("services.active", true);
    expect(links?.length).toBe(4);
    expect(links?.every((l: any) => l.services.category === "barba")).toBe(true);
  });
});