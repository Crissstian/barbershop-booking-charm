import { describe, it, expect } from "vitest";
import { availableStarts, SLOT_STEP_MINUTES, withinWorkingWindow, requireWorkingHoursConfirmation } from "./booking-rules";
import { serviceSchema } from "./service-rules";
import { servicePrice } from "./format";
const m = 60000;
describe("Listino e orari ufficiali", () => {
  it("prezzi numerici fissi e a partire da", () => {
    expect(servicePrice({ price: 20, price_from: true })).toBe(`da ${new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(20)}`);
    expect(servicePrice({ price: 10, price_from: true })).toContain("da 10");
    expect(servicePrice({ price: 18, price_from: false })).not.toContain("da");
    expect(serviceSchema.safeParse({ name: "Colore", category: "capelli", price: "da €10", price_from: true, duration_min: 80, active: true, sort: 7 }).success).toBe(false);
  });
  it("supporta combo future da 50 minuti senza imporre prezzi inventati", () => {
    expect(serviceSchema.parse({ name: "Combo", category: "capelli", price: 25, price_from: false, duration_min: 50, active: false, sort: 12 }).duration_min).toBe(50);
  });
  for (const duration of [20, 30, 80]) {
    it(`slot ${duration} minuti, passo 10 e nessuna sovrapposizione`, () => {
      expect(SLOT_STEP_MINUTES).toBe(10);
      const starts = availableStarts([{ start: 540 * m, end: 780 * m }], [{ start: 600 * m, end: (600 + duration) * m }], duration, 0);
      expect(starts.slice(0, 2)).toEqual(duration === 80 ? [680 * m, 690 * m] : [540 * m, 550 * m]);
      expect(starts).toContain((600 + duration) * m);
      expect(starts.every((s) => s + duration * m <= 600 * m || s >= (600 + duration) * m)).toBe(true);
      expect(starts.at(-1)).toBe((780 - duration) * m);
    });
  }
  it("pubblico non oltrepassa chiusura o pausa", () => {
    const windows = [{ start: 540 * m, end: 780 * m }, { start: 870 * m, end: 1170 * m }];
    expect(withinWorkingWindow(760 * m, 20, windows)).toBe(true);
    expect(withinWorkingWindow(760 * m, 30, windows)).toBe(false);
    expect(withinWorkingWindow(780 * m, 20, windows)).toBe(false);
    expect(withinWorkingWindow(1090 * m, 80, windows)).toBe(true);
  });
  it("fuori orario richiede conferma esplicita", () => {
    expect(() => requireWorkingHoursConfirmation(false, false)).toThrow("Conferma eccezione");
    expect(() => requireWorkingHoursConfirmation(false, true)).not.toThrow();
    expect(() => requireWorkingHoursConfirmation(true, false)).not.toThrow();
  });
});