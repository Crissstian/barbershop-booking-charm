/** Percorsi locali: indipendenti dal CDN dell'editor Lovable. */
const PORTRAITS: Record<string, string> = {
  nicola: "/media/staff/barber-nicola.jpg",
  antonio: "/media/staff/barber-antonio.jpg",
  daniele: "/media/staff/barber-daniele.jpg",
  alessia: "/media/staff/barber-alessia.jpg",
};

/** Una fotografia personalizzata caricata da Nicola ha la precedenza. */
export function portraitFor(barber: { slug: string | null; photo_url: string | null }): string | undefined {
  return barber.photo_url || (barber.slug ? PORTRAITS[barber.slug] : undefined);
}
