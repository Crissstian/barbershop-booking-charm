import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getNextSlots } = await import("./booking.server");
  const [b, s] = await Promise.all([
    supabaseAdmin.from("barbers").select("id,name,role_title,bio,sort").eq("active", true).order("sort"),
    supabaseAdmin.from("services").select("id,name,description,duration_min,price,sort").eq("active", true).order("sort"),
  ]);
  const next = await getNextSlots(45);
  return { barbers: b.data ?? [], services: s.data ?? [], next };
});

export const getSlots = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ barberId: z.string(), serviceId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getDaySlots } = await import("./booking.server");
    const { data: svc } = await supabaseAdmin.from("services").select("duration_min").eq("id", data.serviceId).single();
    if (!svc) return [];
    return getDaySlots(data.barberId as string, data.date, svc.duration_min);
  });

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      barberId: z.string().uuid(),
      serviceId: z.string().uuid(),
      start: z.string().datetime(),
      name: z.string().trim().min(2).max(80),
      phone: z.string().trim().min(6).max(25),
      email: z.string().trim().email().max(120).optional().or(z.literal("")),
      notes: z.string().trim().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isFree } = await import("./booking.server");
    const { data: svc } = await supabaseAdmin.from("services").select("duration_min").eq("id", data.serviceId).single();
    if (!svc) throw new Error("Servizio non trovato");
    const startMs = Date.parse(data.start);
    if (!(await isFree(data.barberId, startMs, svc.duration_min))) throw new Error("Questo orario non è più disponibile. Scegline un altro.");
    const code = "NDP-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    const { data: row, error } = await supabaseAdmin.from("appointments").insert({
      barber_id: data.barberId, service_id: data.serviceId,
      starts_at: new Date(startMs).toISOString(), ends_at: new Date(startMs + svc.duration_min * 60000).toISOString(),
      customer_name: data.name, customer_phone: data.phone, customer_email: data.email || null, notes: data.notes || null, code,
    }).select("token,code").single();
    if (error) throw new Error("Impossibile completare la prenotazione");
    return row;
  });

export const getBooking = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("appointments")
      .select("code,starts_at,ends_at,status,customer_name,barbers(name),services(name,price,duration_min)")
      .eq("token", data.token).maybeSingle();
    return row;
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("appointments").update({ status: "cancelled" }).eq("token", data.token).eq("status", "confirmed").gt("starts_at", new Date().toISOString());
    return { ok: true };
  });
