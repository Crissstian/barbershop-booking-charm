/** Invio messaggi WhatsApp dal numero del salone (Meta WhatsApp Cloud API). */

export function toInternational(raw: string, defaultPrefix = "39") {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.trim().startsWith("+")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith(defaultPrefix) && digits.length > 10) return digits;
  return defaultPrefix + digits.replace(/^0+/, "");
}

/** Ritorna true se il messaggio è stato accettato da WhatsApp. */
export async function sendWhatsAppText(rawTo: string, body: string): Promise<boolean> {
  const token = process.env["WHATSAPP_TOKEN"];
  const phoneId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  const to = toInternational(rawTo ?? "");
  if (!token || !phoneId || !to) return false;
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body },
      }),
    });
    if (!res.ok) {
      console.error("WhatsApp send failed", res.status, (await res.text()).slice(0, 400));
      return false;
    }
    return true;
  } catch (error) {
    console.error("WhatsApp send error", error);
    return false;
  }
}
