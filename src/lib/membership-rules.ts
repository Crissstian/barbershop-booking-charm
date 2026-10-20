/** Regole ufficiali Membership: calcolate solo da appuntamenti completati di servizi che contano come taglio. */
export const HAIRSPRAY_EVERY = 20;
export const ANNUAL_TARGET = 30;
export type RewardType = "gift_card_20" | "hairspray" | "birthday_beard";
export type ExpectedReward = { key: string; type: RewardType; year: number | null; threshold: number | null };
export type CompletedVisit = { date: string; status: string; counts_as_haircut: boolean };

export const REWARD_LABEL: Record<RewardType, string> = {
  gift_card_20: "Gift Card NDP da €20",
  hairspray: "Lacca NDP in omaggio",
  birthday_beard: "Barba omaggio di compleanno",
};

export function haircutDates(visits: CompletedVisit[]) {
  return visits.filter((v) => v.status === "completed" && v.counts_as_haircut).map((v) => v.date);
}

export function isBirthday(birthDate: string | null, today: string) {
  if (!birthDate) return false;
  const md = birthDate.slice(5);
  const year = Number(today.slice(0, 4));
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return today.slice(5) === (md === "02-29" && !leap ? "02-28" : md);
}

/** Tutti i premi che il cliente deve possedere. Le chiavi sono stabili: generazione idempotente. */
export function expectedRewards(visits: CompletedVisit[], birthDate: string | null, today: string): ExpectedReward[] {
  const dates = haircutDates(visits);
  const out: ExpectedReward[] = [];
  for (let k = HAIRSPRAY_EVERY; k <= dates.length; k += HAIRSPRAY_EVERY) out.push({ key: `haircut-${k}`, type: "hairspray", year: null, threshold: k });
  const perYear = new Map<number, number>();
  for (const d of dates) { const y = Number(d.slice(0, 4)); perYear.set(y, (perYear.get(y) ?? 0) + 1); }
  for (const [y, n] of [...perYear].sort((a, b) => a[0] - b[0])) if (n >= ANNUAL_TARGET) out.push({ key: `annual-30-${y}`, type: "gift_card_20", year: y, threshold: ANNUAL_TARGET });
  if (isBirthday(birthDate, today)) { const y = Number(today.slice(0, 4)); out.push({ key: `birthday-${y}`, type: "birthday_beard", year: y, threshold: null }); }
  return out;
}

export function progress(visits: CompletedVisit[], today: string) {
  const dates = haircutDates(visits);
  const year = today.slice(0, 4);
  const thisYear = dates.filter((d) => d.startsWith(year)).length;
  return { total: dates.length, thisYear, hairspray: dates.length % HAIRSPRAY_EVERY, annual: Math.min(thisYear, ANNUAL_TARGET) };
}

export type NewReward = { customerName: string; type: RewardType; label: string; threshold: number | null; year: number | null };
