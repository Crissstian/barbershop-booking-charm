import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getAdminCustomer, redeemAdminReward, updateAdminCustomerContact } from "@/lib/admin-ops.functions";
import { saveAdminCustomer } from "@/lib/admin.functions";
import { ANNUAL_TARGET, HAIRSPRAY_EVERY, REWARD_LABEL, type RewardType } from "@/lib/membership-rules";
import { euro, fmtShort, fmtTime } from "@/lib/format";
import { WEEKDAYS } from "./staff-panel";

const field = "w-full border bg-card px-3 py-2 text-sm outline-none focus:border-accent";
type Customer = { id: string; first_name: string; last_name: string; phone: string; email: string | null };
type Detail = Awaited<ReturnType<typeof getAdminCustomer>>;
const STATUS: Record<string, string> = { confirmed: "Confermato", completed: "Completato", cancelled: "Annullato" };

export function CustomersPanel({ customers, onChange }: { customers: Customer[]; onChange: () => void }) {
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [creating, setCreating] = useState(false);
  const term = q.trim().toLowerCase();
  const list = (term ? customers.filter((c) => `${c.first_name} ${c.last_name} ${c.phone} ${c.email ?? ""}`.toLowerCase().includes(term)) : customers).slice(0, 50);
  async function open(id: string) {
    try { setDetail(await getAdminCustomer({ data: { id } })); } catch (e) { toast.error(e instanceof Error ? e.message : "Errore"); }
  }
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-3xl">Clienti</h2>
        <Button variant="outline" onClick={() => setCreating(true)}>+ Nuovo cliente</Button>
      </div>
      <input placeholder="Cerca per nome, cognome, telefono o email" value={q} onChange={(e) => setQ(e.target.value)} className={`${field} mt-4 py-3`} />
      <ul className="mt-3 divide-y divide-border border">
        {list.map((c) => <li key={c.id}><button onClick={() => open(c.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-secondary"><span className="font-medium">{c.first_name} {c.last_name}</span><span className="truncate text-sm text-muted-foreground">{c.phone}</span></button></li>)}
        {list.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">Nessun cliente trovato.</li>}
      </ul>
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {detail && <CustomerCard key={detail.customer.id} d={detail} reload={() => open(detail.customer.id)} onChange={onChange} />}
        </SheetContent>
      </Sheet>
      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle className="font-serif text-3xl">Nuovo cliente</SheetTitle></SheetHeader>
          <NewCustomer onDone={(id) => { setCreating(false); onChange(); open(id); }} />
        </SheetContent>
      </Sheet>
    </section>
  );
}

function NewCustomer({ onDone }: { onDone: (id: string) => void }) {
  const [f, setF] = useState({ firstName: "", lastName: "", phone: "", email: "", birthDate: "" });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try { const { id } = await saveAdminCustomer({ data: f }); toast.success("Cliente salvato"); onDone(id); } catch (err) { toast.error(err instanceof Error ? err.message : "Errore"); }
  }
  return <form onSubmit={save} className="mt-6 space-y-3 px-1">
    <input required placeholder="Nome" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} className={field} />
    <input required placeholder="Cognome" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} className={field} />
    <input required type="tel" minLength={6} placeholder="Telefono" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={field} />
    <input type="email" placeholder="Email (facoltativa)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={field} />
    <label className="block text-xs text-muted-foreground">Data di nascita (facoltativa)<input type="date" value={f.birthDate} onChange={(e) => setF({ ...f, birthDate: e.target.value })} className={`${field} mt-1`} /></label>
    <Button className="h-auto w-full py-4 text-xs uppercase tracking-[0.25em]">Salva cliente</Button>
  </form>;
}

function Bar({ label, value, total }: { label: string; value: number; total: number }) {
  return <div>
    <div className="flex justify-between text-sm"><span>{label}</span><span className="font-serif text-lg">{value} / {total}</span></div>
    <div className="mt-1 h-1.5 bg-secondary"><div className="h-full bg-accent transition-all duration-700" style={{ width: `${(value / total) * 100}%` }} /></div>
  </div>;
}

function CustomerCard({ d, reload, onChange }: { d: Detail; reload: () => void; onChange: () => void }) {
  const c = d.customer;
  const [f, setF] = useState({ phone: c.phone, email: c.email ?? "", birthDate: c.birth_date ?? "" });
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try { await updateAdminCustomerContact({ data: { id: c.id, ...f } }); toast.success("Dati aggiornati"); onChange(); reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Errore"); } finally { setBusy(false); }
  }
  async function redeem(id: string) {
    if (!confirm("Segnare questo premio come utilizzato?")) return;
    await redeemAdminReward({ data: { id } }); toast.success("Premio utilizzato"); reload();
  }
  const available = d.rewards.filter((r) => r.status === "available");
  const used = d.rewards.filter((r) => r.status !== "available");
  const s = d.stats;
  const year = new Date().getFullYear();
  return (
    <div className="pb-10">
      <SheetHeader><SheetTitle className="font-serif text-4xl">{c.first_name} {c.last_name}</SheetTitle></SheetHeader>
      <div className="mt-6 space-y-3 px-1">
        <label className="block text-sm">Telefono<input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={`${field} mt-1`} /></label>
        <label className="block text-sm">Email<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={`${field} mt-1`} /></label>
        <label className="block text-sm">Data di nascita<input type="date" value={f.birthDate} onChange={(e) => setF({ ...f, birthDate: e.target.value })} className={`${field} mt-1`} /></label>
        <Button variant="outline" disabled={busy} onClick={save} className="w-full">Salva dati</Button>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-2 px-1">
        {([["Tagli totali", s.total], [`Tagli ${year}`, s.thisYear], ["Ultima visita", s.lastVisit ? fmtShort(s.lastVisit) : "—"], ["Prossima visita", s.nextVisit ? `${fmtShort(s.nextVisit)} ${fmtTime(s.nextVisit)}` : "—"]] as const).map(([l, v]) => (
          <div key={l} className="border bg-card p-3"><p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{l}</p><p className="mt-1 font-serif text-2xl capitalize">{v}</p></div>
        ))}
      </div>
      <div className="mt-6 space-y-4 border p-4">
        <p className="text-[10px] uppercase tracking-[0.25em] text-accent">Membership</p>
        <Bar label="Prossima Lacca NDP" value={s.hairspray} total={HAIRSPRAY_EVERY} />
        <Bar label={`Gift Card ${year}`} value={s.annual} total={ANNUAL_TARGET} />
      </div>
      <div className="mt-6 px-1">
        <p className="text-[10px] uppercase tracking-[0.25em] text-accent">Premi disponibili</p>
        <ul className="mt-2 space-y-2">
          {available.map((r) => <li key={r.id} className="flex items-center justify-between gap-3 border border-accent/60 bg-card px-3 py-3 text-sm"><span>{REWARD_LABEL[r.reward_type as RewardType]}{r.threshold && r.reward_type === "hairspray" ? ` · ${r.threshold} tagli` : ""}{r.year ? ` · ${r.year}` : ""}</span><button onClick={() => redeem(r.id)} className="shrink-0 border px-3 py-2 text-xs">Utilizzato</button></li>)}
          {available.length === 0 && <li className="text-sm text-muted-foreground">Nessun premio da utilizzare.</li>}
          {used.map((r) => <li key={r.id} className="px-3 text-xs text-muted-foreground line-through">{REWARD_LABEL[r.reward_type as RewardType]}{r.year ? ` · ${r.year}` : ""}</li>)}
        </ul>
      </div>
      {d.rules.length > 0 && <div className="mt-6 px-1">
        <p className="text-[10px] uppercase tracking-[0.25em] text-accent">Cliente fisso</p>
        <ul className="mt-2 space-y-1 text-sm">{d.rules.map((r) => <li key={r.id}>{r.barbers?.name} · {r.services?.name} · {WEEKDAYS[r.weekday]} {r.start_time.slice(0, 5)} · {r.interval_weeks === 2 ? "ogni 2 settimane" : "ogni settimana"}{r.active ? "" : " (non attivo)"}</li>)}</ul>
      </div>}
      <div className="mt-6 px-1">
        <p className="text-[10px] uppercase tracking-[0.25em] text-accent">Storico appuntamenti</p>
        <ul className="mt-2 divide-y divide-border">
          {d.history.map((a) => <li key={a.id} className="flex justify-between gap-3 py-2 text-sm"><span><span className="capitalize">{fmtShort(a.starts_at)}</span> {fmtTime(a.starts_at)} · {a.services?.name} · {a.barbers?.name}</span><span className="shrink-0 text-xs text-muted-foreground">{STATUS[a.status] ?? a.status}{a.status === "completed" ? (a.payment_status === "complimentary" ? " · Omaggio" : ` · ${euro(Number(a.amount_paid ?? 0))}`) : ""}</span></li>)}
          {d.history.length === 0 && <li className="py-2 text-sm text-muted-foreground">Nessun appuntamento.</li>}
        </ul>
      </div>
    </div>
  );
}
