import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const normalizePhone = (p: string) => p.replace(/\D/g, "");

type CustomerInput = { firstName: string; lastName: string; email?: string | null | undefined; phone?: string | null | undefined; birthDate?: string | null | undefined };

/**
 * Trova il cliente per email o telefono (normalizzato) e lo aggiorna, altrimenti lo crea.
 * Restituisce l'id del record in `customers`.
 */
export async function upsertCustomer(input: CustomerInput) {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.trim() || "";
  const digits = normalizePhone(phone);
  let existingId: string | null = null;
  if (email) {
    const { data } = await supabaseAdmin.from("customers").select("id").ilike("email", email).maybeSingle();
    existingId = data?.id ?? null;
  }
  if (!existingId && digits) {
    const { data } = await supabaseAdmin.from("customers").select("id").eq("phone_normalized", digits).maybeSingle();
    existingId = data?.id ?? null;
  }
  const patch: { first_name: string; last_name: string; email?: string; phone?: string; birth_date?: string } = { first_name: input.firstName, last_name: input.lastName };
  if (email) patch.email = email;
  if (phone) patch.phone = phone;
  if (input.birthDate) patch.birth_date = input.birthDate;
  if (existingId) {
    const { error } = await supabaseAdmin.from("customers").update(patch).eq("id", existingId);
    if (error) throw new Error(error.code === "23505" ? "Email o telefono già associati a un altro cliente" : "Impossibile aggiornare il cliente");
    return existingId;
  }
  const { data, error } = await supabaseAdmin.from("customers")
    .insert({ first_name: input.firstName, last_name: input.lastName, email, phone, birth_date: input.birthDate ?? null })
    .select("id").single();
  if (error || !data) throw new Error(error?.code === "23505" ? "Email o telefono già associati a un altro cliente" : "Impossibile salvare il cliente");
  return data.id;
}
