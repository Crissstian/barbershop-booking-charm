import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { saveAdminRecurring, setAdminRecurringState } from "@/lib/admin-ops.functions";
import { barbersForService } from "@/lib/report";
import { romeDate } from "@/lib/format";
import { WEEKDAYS } from "./staff-panel";

const field = "w-full border bg-card px-3 py-2 text-sm outline-none focus:border-accent";
type Customer = { id: string; first_name: string; last_name: string; phone: string; email: string | null };
type Rule = {
  id: string; customer_id: string; barber_id: string; service_id: string; weekday: number; start_time: string; interval_weeks: number;
  start_date: string; end_date: string | null; active: boolean; notes: string | null;
  customers: { first_name: string; last_name: string } | null; barbers: { name: string } | null; services: { name: string } | null;
};
type Opt = { id: string; name: string };

export function RecurringPanel({ customers, barbers, services, links }: { customers: Customer[]; barbers: Opt[]; services: (Opt & { active: boolean; duration_min: number })[]; links: { barber_id: string; service_id: string }[] }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [edit, setEdit] = useState<Partial<Rule> | null>(null);
  async function load() {
    const { data } = await supabase.from("recurring_appointments").select("*,customers(first_name,last_name),barbers(name),services(name)").order("weekday").order("start_time");
    setRules((data as Rule[]) ?? []);
  }
  useEffect(() => { load(); }, []);
  const today = romeDate();
  const ended = (r: Rule) => !!r.end_date && r.end_date < today;
  async function act(r: Rule, action: "pause" | "resume" | "end" | "skip-next") {
    if (action === "end" && !confirm(`Terminare definitivamente il cliente fisso ${r.customers?.first_name}? Gli orari futuri torneranno liberi.`)) return;
    try {
      const res = await setAdminRecurringState({ data: { id: r.id, action } });
      toast.success(action === "skip-next" ? `Saltato il ${res.date?.split("-").reverse().join("/")}` : action === "pause" ? "In pausa" : action === "resume" ? "Riattivato" : "Terminato");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Errore"); }
  }
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-3xl">Clienti fissi</h2>
        <Button onClick={() => setEdit({})} className="h-auto px-5 py-3 text-xs uppercase tracking-[0.2em]">+ Cliente fisso</Button>
      </div>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {rules.map((r) => (
          <li key={r.id} className={`border bg-card p-4 ${r.active && !ended(r) ? "" : "opacity-60"}`}>
            <p className="font-serif text-2xl">{r.customers?.first_name} {r.customers?.last_name}</p>
            <p className="text-sm">{r.barbers?.name} · {r.services?.name}</p>
            <p className="text-sm text-muted-foreground">{WEEKDAYS[r.weekday]} · {r.start_time.slice(0, 5)} · {r.interval_weeks === 2 ? "Ogni 2 settimane" : "Ogni settimana"}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-accent">{ended(r) ? "Terminato" : r.active ? "Attivo" : "In pausa"}</p>
            {!ended(r) && <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => setEdit(r)} className="border px-3 py-2 text-xs">Modifica</button>
              <button onClick={() => act(r, r.active ? "pause" : "resume")} className="border px-3 py-2 text-xs">{r.active ? "Pausa" : "Riattiva"}</button>
              {r.active && <button onClick={() => act(r, "skip-next")} className="border px-3 py-2 text-xs">Salta prossima</button>}
              <button onClick={() => act(r, "end")} className="border border-destructive px-3 py-2 text-xs text-destructive">Termina</button>
            </div>}
          </li>
        ))}
        {rules.length === 0 && <li className="text-sm text-muted-foreground">Nessun cliente fisso.</li>}
      </ul>
      <Sheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle className="font-serif text-3xl">{edit?.id ? "Modifica cliente fisso" : "Nuovo cliente fisso"}</SheetTitle></SheetHeader>
          {edit && <RuleForm key={edit.id ?? "new"} r={edit} customers={customers} barbers={barbers} services={services.filter((s) => s.active)} links={links} onDone={() => { setEdit(null); load(); }} />}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function RuleForm({ r, customers, barbers, services, links, onDone }: { r: Partial<Rule>; customers: Customer[]; barbers: Opt[]; services: Opt[]; links: { barber_id: string; service_id: string }[]; onDone: () => void }) {
  const [f, setF] = useState({
    customerId: r.customer_id ?? "", serviceId: r.service_id ?? "", barberId: r.barber_id ?? "", weekday: r.weekday ?? 5,
    time: r.start_time?.slice(0, 5) ?? "10:00", intervalWeeks: (r.interval_weeks ?? 1) as 1 | 2, startDate: r.start_date ?? romeDate(), endDate: r.end_date ?? "", notes: r.notes ?? "",
  });
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const eligible = f.serviceId ? barbersForService(barbers, links, f.serviceId) : [];
  const sel = customers.find((c) => c.id === f.customerId);
  const matches = q.trim() ? customers.filter((c) => `${c.first_name} ${c.last_name} ${c.phone} ${c.email ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : [];
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.customerId) { toast.error("Scegli il cliente"); return; }
    if (!eligible.some((b) => b.id === f.barberId)) { toast.error("Scegli un professionista abilitato"); return; }
    setBusy(true);
    try { await saveAdminRecurring({ data: { ...(r.id ? { id: r.id } : {}), ...f, notes: f.notes || undefined } }); toast.success("Cliente fisso salvato"); onDone(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Errore"); } finally { setBusy(false); }
  }
  const step = "text-[10px] uppercase tracking-[0.25em] text-accent";
  return (
    <form onSubmit={save} className="mt-6 space-y-5 px-1 pb-8">
      <div><p className={step}>1 · Cliente</p>
        {sel ? <div className="mt-2 flex items-center justify-between border bg-secondary px-3 py-2 text-sm"><span>{sel.first_name} {sel.last_name}</span><button type="button" onClick={() => setF({ ...f, customerId: "" })} className="text-xs underline">Cambia</button></div>
          : <><input placeholder="Cerca nome o telefono" value={q} onChange={(e) => setQ(e.target.value)} className={`${field} mt-2`} />
            {matches.length > 0 && <ul className="divide-y divide-border border">{matches.map((c) => <li key={c.id}><button type="button" onClick={() => { setF({ ...f, customerId: c.id }); setQ(""); }} className="w-full px-3 py-2 text-left text-sm hover:bg-secondary">{c.first_name} {c.last_name} <span className="text-muted-foreground">· {c.phone}</span></button></li>)}</ul>}
            <p className="mt-1 text-xs text-muted-foreground">Un cliente nuovo si crea da "Nuovo appuntamento" o dalla sezione Clienti.</p></>}
      </div>
      <label className="block"><span className={step}>2 · Servizio</span><select required value={f.serviceId} onChange={(e) => setF({ ...f, serviceId: e.target.value })} className={`${field} mt-2`}><option value="">Scegli…</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="block"><span className={step}>3 · Professionista</span><select required value={f.barberId} onChange={(e) => setF({ ...f, barberId: e.target.value })} className={`${field} mt-2`}><option value="">Scegli…</option>{eligible.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
      <div><p className={step}>4 · Giorno</p><div className="mt-2 grid grid-cols-4 gap-2">{[1, 2, 3, 4, 5, 6, 0].map((d) => <button type="button" key={d} onClick={() => setF({ ...f, weekday: d })} className={`border py-2 text-xs ${f.weekday === d ? "border-foreground bg-foreground text-background" : ""}`}>{WEEKDAYS[d]!.slice(0, 3)}</button>)}</div></div>
      <label className="block"><span className={step}>5 · Ora</span><input type="time" step={600} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} className={`${field} mt-2`} /></label>
      <div><p className={step}>6 · Frequenza</p><div className="mt-2 grid grid-cols-2 gap-2">{([1, 2] as const).map((n) => <button type="button" key={n} onClick={() => setF({ ...f, intervalWeeks: n })} className={`border py-3 text-xs ${f.intervalWeeks === n ? "border-foreground bg-foreground text-background" : ""}`}>{n === 1 ? "Ogni settimana" : "Ogni 2 settimane"}</button>)}</div></div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className={step}>7 · Inizio</span><input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} className={`${field} mt-2`} /></label>
        <label className="block"><span className={step}>8 · Fine (facolt.)</span><input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} className={`${field} mt-2`} /></label>
      </div>
      <label className="block text-sm">Note<textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className={`${field} mt-1`} /></label>
      <Button disabled={busy} className="h-auto w-full py-4 text-xs uppercase tracking-[0.25em]">{busy ? "Verifico gli orari…" : "Salva cliente fisso"}</Button>
    </form>
  );
}
