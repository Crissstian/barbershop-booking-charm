import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const emailSchema = z.string().trim().toLowerCase().email().max(120);
const phoneSchema = z.string().trim().min(6).max(25);
const personSchema = z.object({
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  email: emailSchema,
  phone: phoneSchema.optional(),
  inviteCode: z.string().trim().max(40).optional(),
});

function inviteCodes() {
  const extra = (process.env["NDP_INVITE_CODES"] ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  return new Set(["NDPVIP", ...extra]);
}

export const checkCustomerApproval = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: emailSchema }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("customer_approvals")
      .select("first_name,last_name,status,phone")
      .eq("email", data.email)
      .maybeSingle();
    return row ? { status: row.status, phone: row.phone ?? "" } : { status: "not_found" as const, phone: "" };
  });

export const requestCustomerApproval = createServerFn({ method: "POST" })
  .inputValidator((d) => personSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendWhatsAppText } = await import("./whatsapp.server");
    const invited = !!data.inviteCode && inviteCodes().has(data.inviteCode.toUpperCase());
    const status = invited ? "approved" : "pending";

    const { data: existing } = await supabaseAdmin.from("customer_approvals")
      .select("id,status")
      .eq("email", data.email)
      .maybeSingle();
    if (existing?.status === "approved") return { status: "approved" as const };

    const payload = {
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone ?? null,
      invited_with: invited ? data.inviteCode!.toUpperCase() : null,
      status,
      reviewed_at: invited ? new Date().toISOString() : null,
    };
    if (existing) {
      const { error } = await supabaseAdmin.from("customer_approvals").update(payload).eq("id", existing.id);
      if (error) throw new Error("Impossibile inviare la richiesta");
    } else {
      const { error } = await supabaseAdmin.from("customer_approvals").insert({ ...payload, email: data.email });
      if (error) throw new Error("Impossibile inviare la richiesta");
    }

    if (invited && data.phone) {
      await sendWhatsAppText(data.phone, `NDP Esclusive Hair Saloon\n\nCiao ${data.firstName}, il tuo accesso è attivo. Puoi prenotare quando vuoi il tuo appuntamento.`);
    }
    return { status: invited ? ("approved" as const) : ("pending" as const) };
  });

/** Avvisa su WhatsApp un cliente appena autorizzato dallo staff. */
export const notifyApprovedCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendWhatsAppText } = await import("./whatsapp.server");
    const { data: row } = await supabaseAdmin.from("customer_approvals").select("first_name,phone,status").eq("id", data.id).maybeSingle();
    if (!row?.phone || row.status !== "approved") return { sent: false };
    const sent = await sendWhatsAppText(row.phone, `NDP Esclusive Hair Saloon\n\nCiao ${row.first_name}, il tuo accesso è stato confermato. Ora puoi prenotare il tuo appuntamento online.`);
    return { sent };
  });

export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    email: emailSchema,
    phone: phoneSchema.optional(),
    barberId: z.string().optional(),
    serviceId: z.string().uuid().optional(),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: approval } = await supabaseAdmin.from("customer_approvals").select("status").eq("email", data.email).maybeSingle();
    if (approval?.status !== "approved") throw new Error("Questa email non è ancora autorizzata.");
    const { error } = await supabaseAdmin.from("waitlist").insert({
      email: data.email,
      phone: data.phone ?? null,
      barber_id: data.barberId && data.barberId !== "any" ? data.barberId : null,
      service_id: data.serviceId ?? null,
      day: data.day,
    });
    if (error) throw new Error("Impossibile aggiungerti alla lista d’attesa");
    return { ok: true };
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
      phone: phoneSchema,
      email: emailSchema,
      notes: z.string().trim().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isFree } = await import("./booking.server");
    const { data: approval } = await supabaseAdmin.from("customer_approvals")
      .select("first_name,last_name,status")
      .eq("email", data.email)
      .maybeSingle();
    if (approval?.status !== "approved") throw new Error("Questa email non è ancora autorizzata a prenotare.");
    const { data: svc } = await supabaseAdmin.from("services").select("name,duration_min").eq("id", data.serviceId).single();
    if (!svc) throw new Error("Servizio non trovato");
    const startMs = Date.parse(data.start);
    if (!(await isFree(data.barberId, startMs, svc.duration_min))) throw new Error("Questo orario non è più disponibile. Scegline un altro.");
    const code = "NDP-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    const { data: row, error } = await supabaseAdmin.from("appointments").insert({
      barber_id: data.barberId, service_id: data.serviceId,
      starts_at: new Date(startMs).toISOString(), ends_at: new Date(startMs + svc.duration_min * 60000).toISOString(),
      customer_name: `${approval.first_name} ${approval.last_name}`, customer_phone: data.phone, customer_email: data.email, notes: data.notes || null, code,
    }).select("id,token,code").single();
    if (error) throw new Error("Impossibile completare la prenotazione");

    // Conferma automatica su WhatsApp dal numero del salone.
    const { sendWhatsAppText } = await import("./whatsapp.server");
    const { SALON } = await import("./salon");
    const { fmtDay, fmtTime } = await import("./format");
    const { data: barber } = await supabaseAdmin.from("barbers").select("name").eq("id", data.barberId).maybeSingle();
    const message = [
      `NDP Esclusive Hair Saloon`,
      ``,
      `Ciao ${approval.first_name}, il tuo appuntamento è confermato.`,
      `Codice: ${row.code}`,
      `${svc.name} con ${barber?.name ?? "il tuo stylist"}`,
      `${fmtDay(data.start)} alle ${fmtTime(data.start)}`,
      `${SALON.address}`,
      ``,
      `Per spostare o annullare rispondi a questo messaggio.`,
    ].join("\n");
    if (await sendWhatsAppText(data.phone, message)) {
      await supabaseAdmin.from("appointments").update({ whatsapp_sent_at: new Date().toISOString() }).eq("id", row.id);
    }
    return { token: row.token, code: row.code };
  });

export const getBooking = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("appointments")
      .select("code,starts_at,ends_at,status,customer_name,whatsapp_sent_at,barbers(name),services(name,price,duration_min)")
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
