import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const emailSchema = z.string().trim().toLowerCase().email().max(120);
const personSchema = z.object({
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  email: emailSchema,
});

export const checkCustomerApproval = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: emailSchema }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("customer_approvals")
      .select("first_name,last_name,status")
      .eq("email", data.email)
      .maybeSingle();
    return row ? { status: row.status, firstName: row.first_name, lastName: row.last_name } : { status: "not_found" as const };
  });

export const requestCustomerApproval = createServerFn({ method: "POST" })
  .inputValidator((d) => personSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("customer_approvals")
      .select("id,status")
      .eq("email", data.email)
      .maybeSingle();
    if (existing?.status === "approved") return { status: "approved" as const };
    if (existing) {
      const { error } = await supabaseAdmin.from("customer_approvals").update({
        first_name: data.firstName,
        last_name: data.lastName,
        status: "pending",
        reviewed_at: null,
      }).eq("id", existing.id);
      if (error) throw new Error("Impossibile inviare la richiesta");
    } else {
      const { error } = await supabaseAdmin.from("customer_approvals").insert({
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
      });
      if (error) throw new Error("Impossibile inviare la richiesta");
    }
    return { status: "pending" as const };
  });

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
      email: emailSchema,
      notes: z.string().trim().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isFree } = await import("./booking.server");
    const { data: approval } = await supabaseAdmin.from("customer_approvals")
      .select("status")
      .eq("email", data.email)
      .maybeSingle();
    if (approval?.status !== "approved") throw new Error("Questa email non è ancora autorizzata a prenotare.");
    const { data: svc } = await supabaseAdmin.from("services").select("duration_min").eq("id", data.serviceId).single();
    if (!svc) throw new Error("Servizio non trovato");
    const startMs = Date.parse(data.start);
    if (!(await isFree(data.barberId, startMs, svc.duration_min))) throw new Error("Questo orario non è più disponibile. Scegline un altro.");
    const code = "NDP-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    const { data: row, error } = await supabaseAdmin.from("appointments").insert({
      barber_id: data.barberId, service_id: data.serviceId,
      starts_at: new Date(startMs).toISOString(), ends_at: new Date(startMs + svc.duration_min * 60000).toISOString(),
      customer_name: data.name, customer_phone: data.phone, customer_email: data.email, notes: data.notes || null, code,
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
