import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };
async function assertAdmin(context: Ctx) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

const newCustomer = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  phone: z.string().trim().min(6).max(25),
  email: z.string().trim().toLowerCase().email().max(120).optional().or(z.literal("")),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

const bookingFields = {
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().trim().max(300).optional(),
  staffNotes: z.string().trim().max(500).optional(),
};

/** Verifica servizio, compatibilità e sovrapposizioni; restituisce la finestra calcolata. */
async function validateWindow(barberId: string, serviceId: string, date: string, time: string, excludeId?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { canPerform, hasConflict, romeToUtc, OVERLAP_MESSAGE } = await import("./booking.server");
  const { data: svc } = await supabaseAdmin.from("services").select("duration_min").eq("id", serviceId).maybeSingle();
  if (!svc) throw new Error("Servizio non trovato");
  if (!(await canPerform(barberId, serviceId))) throw new Error("Questo professionista non esegue il servizio scelto.");
  const startMs = romeToUtc(date, time);
  const endMs = startMs + svc.duration_min * 60000;
  if (await hasConflict(barberId, startMs, endMs, excludeId)) throw new Error(OVERLAP_MESSAGE);
  return { starts_at: new Date(startMs).toISOString(), ends_at: new Date(endMs).toISOString() };
}

async function customerSnapshot(customerId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: c } = await supabaseAdmin.from("customers").select("first_name,last_name,phone,email").eq("id", customerId).maybeSingle();
  if (!c) throw new Error("Cliente non trovato");
  return { customer_id: customerId, customer_name: `${c.first_name} ${c.last_name}`, customer_phone: c.phone, customer_email: c.email };
}

export const createAdminBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ...bookingFields, customerId: z.string().uuid().optional(), newCustomer: newCustomer.optional() })
    .refine((v) => !!v.customerId || !!v.newCustomer, "Seleziona o crea un cliente").parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isOverlapError, OVERLAP_MESSAGE } = await import("./booking.server");
    const win = await validateWindow(data.barberId, data.serviceId, data.date, data.time);
    let customerId = data.customerId;
    if (!customerId && data.newCustomer) {
      const { upsertCustomer } = await import("./customers.server");
      const n = data.newCustomer;
      customerId = await upsertCustomer({ firstName: n.firstName, lastName: n.lastName, phone: n.phone, email: n.email || null, birthDate: n.birthDate || null });
    }
    const snap = await customerSnapshot(customerId!);
    const code = "NDP-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    const { data: row, error } = await supabaseAdmin.from("appointments").insert({
      barber_id: data.barberId, service_id: data.serviceId, ...win, ...snap,
      notes: data.notes || null, staff_notes: data.staffNotes || null, code,
    }).select("id,code").single();
    if (isOverlapError(error)) throw new Error(OVERLAP_MESSAGE);
    if (error || !row) throw new Error("Impossibile creare l'appuntamento");
    return row;
  });

export const updateAdminBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), customerId: z.string().uuid(), ...bookingFields }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isOverlapError, OVERLAP_MESSAGE } = await import("./booking.server");
    const { data: current } = await supabaseAdmin.from("appointments").select("status").eq("id", data.id).maybeSingle();
    if (!current) throw new Error("Appuntamento non trovato");
    const win = await validateWindow(data.barberId, data.serviceId, data.date, data.time, data.id);
    const snap = await customerSnapshot(data.customerId);
    const { error } = await supabaseAdmin.from("appointments").update({
      barber_id: data.barberId, service_id: data.serviceId, ...win, ...snap,
      notes: data.notes || null, staff_notes: data.staffNotes || null,
    }).eq("id", data.id);
    if (isOverlapError(error)) throw new Error(OVERLAP_MESSAGE);
    if (error) throw new Error("Impossibile salvare le modifiche");
    return { ok: true, ...win };
  });

export const cancelAdminBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("appointments").update({ status: "cancelled" }).eq("id", data.id);
    if (error) throw new Error("Impossibile annullare");
    return { ok: true };
  });

/** Chiude l'appuntamento: pagato con importo ricevuto oppure omaggio (importo 0). */
export const completeAdminBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    mode: z.enum(["paid", "complimentary"]),
    amount: z.number().min(0).max(99999).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.mode === "paid" && data.amount === undefined) throw new Error("Inserisci l'importo ricevuto");
    const amount = data.mode === "complimentary" ? 0 : Math.round(data.amount! * 100) / 100;
    const { error } = await supabaseAdmin.from("appointments")
      .update({ status: "completed", payment_status: data.mode, amount_paid: amount })
      .eq("id", data.id).neq("status", "cancelled");
    if (error) throw new Error("Impossibile completare l'appuntamento");
    return { ok: true, amount };
  });

/** Staff: crea o aggiorna un cliente in anagrafica (ricerca per email/telefono). */
export const saveAdminCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => newCustomer.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { upsertCustomer } = await import("./customers.server");
    const id = await upsertCustomer({ firstName: data.firstName, lastName: data.lastName, phone: data.phone, email: data.email || null, birthDate: data.birthDate || null });
    return { id };
  });
