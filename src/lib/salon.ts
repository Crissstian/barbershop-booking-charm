// Dati del salone. Da confermare con i valori reali.
export const SALON = {
  name: "NDP Esclusive Hair Saloon",
  phoneDisplay: "+39 000 000 0000",
  /** Numero WhatsApp del salone in formato internazionale, solo cifre. */
  whatsapp: "390000000000",
  address: "Via Esempio 1, Città",
  instagram: "@ndp.hairsaloon",
  hours: "Mar–Sab 9:00–13:00 · 14:30–19:30",
};

export function waLink(text: string, to: string = SALON.whatsapp) {
  return `https://wa.me/${to.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
