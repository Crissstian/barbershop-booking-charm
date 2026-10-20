export type ReportAppt = { barber_id: string; status: string; payment_status: string; amount_paid: number | string | null };

/** Resoconto giornaliero: l'incasso conta solo appuntamenti completati e pagati. */
export function dailyReport(appts: ReportAppt[], barbers: { id: string; name: string }[]) {
  const completed = appts.filter((a) => a.status === "completed");
  const paid = completed.filter((a) => a.payment_status === "paid");
  const sum = (list: ReportAppt[]) => list.reduce((t, a) => t + Number(a.amount_paid ?? 0), 0);
  return {
    total: appts.length,
    completed: completed.length,
    toDo: appts.filter((a) => a.status === "confirmed").length,
    cancelled: appts.filter((a) => a.status === "cancelled").length,
    revenue: sum(paid),
    byBarber: barbers.map((b) => ({
      id: b.id,
      name: b.name,
      services: completed.filter((a) => a.barber_id === b.id).length,
      revenue: sum(paid.filter((a) => a.barber_id === b.id)),
    })),
  };
}

/** Professionisti abilitati a un servizio, secondo la tabella dei servizi abilitati. */
export function barbersForService<T extends { id: string }>(barbers: T[], links: { barber_id: string; service_id: string }[], serviceId: string) {
  const ok = new Set(links.filter((l) => l.service_id === serviceId).map((l) => l.barber_id));
  return barbers.filter((b) => ok.has(b.id));
}
