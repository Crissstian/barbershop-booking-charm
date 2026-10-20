import nicola from "@/assets/staff/barber-nicola.jpg.asset.json";
import antonio from "@/assets/staff/barber-antonio.jpg.asset.json";
import daniele from "@/assets/staff/barber-daniele.jpg.asset.json";
import alessia from "@/assets/staff/barber-alessia.jpg.asset.json";

/** Foto ufficiali per slug: photo_url dal database ha sempre la precedenza. */
const PORTRAITS: Record<string, string> = { nicola: nicola.url, antonio: antonio.url, daniele: daniele.url, alessia: alessia.url };
export const portraitFor = (b: { slug: string | null; photo_url: string | null }) => b.photo_url || (b.slug ? PORTRAITS[b.slug] : undefined);
