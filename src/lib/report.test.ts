import { describe, expect, it } from "vitest";
import { barbersForService, dailyReport } from "./report";

const barbers = [{ id: "n", name: "Nicola" }, { id: "a", name: "Alessia" }];
const links = [
  { barber_id: "n", service_id: "taglio" },
  { barber_id: "n", service_id: "barba" },
  { barber_id: "a", service_id: "barba" },
];

describe("servizi abilitati", () => {
  it("Barba mostra anche Alessia", () => {
    expect(barbersForService(barbers, links, "barba").map((b) => b.name)).toEqual(["Nicola", "Alessia"]);
  });
  it("Taglio non mostra Alessia", () => {
    expect(barbersForService(barbers, links, "taglio").map((b) => b.name)).toEqual(["Nicola"]);
  });
});

describe("resoconto giornaliero", () => {
  const r = dailyReport([
    { barber_id: "n", status: "completed", payment_status: "paid", amount_paid: 25 },
    { barber_id: "a", status: "completed", payment_status: "complimentary", amount_paid: 0 },
    { barber_id: "n", status: "confirmed", payment_status: "pending", amount_paid: null },
    { barber_id: "n", status: "cancelled", payment_status: "pending", amount_paid: null },
  ], barbers);
  it("l'incasso somma solo completati e pagati", () => expect(r.revenue).toBe(25));
  it("gli omaggi contano come servizi ma non come incasso", () => expect(r.byBarber[1]).toMatchObject({ services: 1, revenue: 0 }));
  it("conteggi per stato", () => expect([r.total, r.completed, r.toDo, r.cancelled]).toEqual([4, 2, 1, 1]));
});
