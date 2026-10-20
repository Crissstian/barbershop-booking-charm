import { describe, expect, it } from "vitest";
import { expectedRewards, progress, type CompletedVisit } from "./membership-rules";
import { occurrencesBetween, occursOn, type RecurringRule } from "./recurring-rules";

const cuts = (n: number, year = 2026, extra: Partial<CompletedVisit> = {}): CompletedVisit[] =>
  Array.from({ length: n }, (_, i) => ({ date: `${year}-0${1 + (i % 9)}-10`, status: "completed", counts_as_haircut: true, ...extra }));
const keys = (v: CompletedVisit[], b: string | null = null, t = "2026-10-20") => expectedRewards(v, b, t).map((r) => r.key);

describe("membership", () => {
  it("20° taglio crea una sola lacca", () => expect(keys(cuts(20)).filter((k) => k.startsWith("haircut"))).toEqual(["haircut-20"]));
  it("40° taglio aggiunge la seconda lacca senza duplicare la prima", () => expect(keys(cuts(40)).filter((k) => k.startsWith("haircut"))).toEqual(["haircut-20", "haircut-40"]));
  it("30 tagli nello stesso anno creano la gift card €20 una volta", () => expect(keys(cuts(45)).filter((k) => k.startsWith("annual"))).toEqual(["annual-30-2026"]));
  it("29 tagli nell'anno non bastano", () => expect(keys([...cuts(29, 2026), ...cuts(10, 2025)]).some((k) => k.startsWith("annual"))).toBe(false));
  it("compleanno crea una sola barba omaggio nell'anno", () => expect(keys([], "1990-10-20")).toEqual(["birthday-2026"]));
  it("nessun compleanno senza data di nascita", () => expect(keys([], null)).toEqual([]));
  it("annullati non contano", () => expect(keys(cuts(20, 2026, { status: "cancelled" }))).toEqual([]));
  it("servizi non taglio non contano", () => expect(keys(cuts(20, 2026, { counts_as_haircut: false }))).toEqual([]));
  it("progresso verso lacca e gift card", () => expect(progress(cuts(22), "2026-10-20")).toEqual({ total: 22, thisYear: 22, hairspray: 2, annual: 22 }));
});

const rule = (p: Partial<RecurringRule> = {}): RecurringRule => ({ id: "r", barber_id: "b", service_id: "s", weekday: 5, start_time: "17:00:00", interval_weeks: 1, start_date: "2026-10-23", end_date: null, active: true, ...p });

describe("clienti fissi", () => {
  it("settimanale ogni venerdì", () => expect(occurrencesBetween([rule()], [], "2026-10-19", "2026-11-08").map((o) => o.date)).toEqual(["2026-10-23", "2026-10-30", "2026-11-06"]));
  it("ogni 2 settimane solo nelle settimane corrette", () => {
    const r = rule({ interval_weeks: 2 });
    expect(occursOn(r, "2026-10-23")).toBe(true);
    expect(occursOn(r, "2026-10-30")).toBe(false);
    expect(occursOn(r, "2026-11-06")).toBe(true);
  });
  it("saltare una data libera solo quella data", () => expect(occurrencesBetween([rule()], [{ recurring_id: "r", occurrence_date: "2026-10-30" }], "2026-10-23", "2026-11-06").map((o) => o.date)).toEqual(["2026-10-23", "2026-11-06"]));
  it("ricorrenza in pausa non occupa slot", () => expect(occurrencesBetween([rule({ active: false })], [], "2026-10-23", "2026-12-31")).toEqual([]));
  it("terminata non genera dopo la data di fine", () => expect(occurrencesBetween([rule({ end_date: "2026-10-29" })], [], "2026-10-23", "2026-11-30").map((o) => o.date)).toEqual(["2026-10-23"]));
});
