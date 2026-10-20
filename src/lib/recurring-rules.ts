/** Regole pure per i clienti fissi: nessuna riga futura viene creata, le occorrenze si calcolano. */
export type RecurringRule = {
  id: string; barber_id: string; service_id: string; weekday: number; start_time: string;
  interval_weeks: number; start_date: string; end_date: string | null; active: boolean;
};
export type RecurringException = { recurring_id: string; occurrence_date: string };
export type Occurrence = { recurringId: string; date: string; barber_id: string; service_id: string; time: string };

const DAY = 86400000;
const toUtc = (d: string) => { const [y, m, dd] = d.split("-").map(Number) as [number, number, number]; return Date.UTC(y, m - 1, dd); };
const fromUtc = (t: number) => new Date(t).toISOString().slice(0, 10);
export const weekdayOf = (d: string) => new Date(toUtc(d)).getUTCDay();

/** Prima data >= from che cade nel giorno della settimana indicato. */
export function firstOnOrAfter(from: string, weekday: number) {
  const diff = (weekday - weekdayOf(from) + 7) % 7;
  return fromUtc(toUtc(from) + diff * DAY);
}

/** La regola genera un'occorrenza in questa data? (bisettimanale ancorata a start_date) */
export function occursOn(rule: RecurringRule, date: string) {
  if (!rule.active || weekdayOf(date) !== rule.weekday) return false;
  if (date < rule.start_date || (rule.end_date && date > rule.end_date)) return false;
  const anchor = firstOnOrAfter(rule.start_date, rule.weekday);
  const weeks = Math.round((toUtc(date) - toUtc(anchor)) / (7 * DAY));
  return weeks >= 0 && weeks % rule.interval_weeks === 0;
}

/** Occorrenze virtuali tra due date incluse, escluse quelle saltate o già trasformate in appuntamento. */
export function occurrencesBetween(rules: RecurringRule[], exceptions: RecurringException[], from: string, to: string): Occurrence[] {
  const skip = new Set(exceptions.map((e) => `${e.recurring_id}/${e.occurrence_date}`));
  const out: Occurrence[] = [];
  for (let t = toUtc(from); t <= toUtc(to); t += DAY) {
    const date = fromUtc(t);
    for (const r of rules) {
      if (occursOn(r, date) && !skip.has(`${r.id}/${date}`)) out.push({ recurringId: r.id, date, barber_id: r.barber_id, service_id: r.service_id, time: r.start_time.slice(0, 5) });
    }
  }
  return out;
}

/** Prossima occorrenza attiva a partire da una data (entro un anno). */
export function nextOccurrence(rule: RecurringRule, exceptions: RecurringException[], from: string) {
  const list = occurrencesBetween([rule], exceptions, from, fromUtc(toUtc(from) + 370 * DAY));
  return list[0]?.date ?? null;
}
