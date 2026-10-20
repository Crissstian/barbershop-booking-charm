/**
 * Codice invito (accesso immediato senza approvazione staff).
 * Modulo separato: per rimuovere la funzione basta far restituire `false` a isValidInvite.
 */
export function isValidInvite(code: string | undefined) {
  if (!code) return false;
  const extra = (process.env["NDP_INVITE_CODES"] ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  return new Set(["NDPVIP", ...extra]).has(code.trim().toUpperCase());
}
