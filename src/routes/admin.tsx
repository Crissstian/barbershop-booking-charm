import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { addDays, euro, servicePrice, fmtTime, romeDate } from "@/lib/format";
import { reviewCustomerApproval } from "@/lib/booking.functions";
import { cancelAdminBooking, completeAdminBooking, createAdminBooking, saveAdminCustomer, updateAdminBooking, checkAdminWorkingHours, getStaffBootstrap } from "@/lib/admin.functions";
import { ServiceManager, type ManagedService } from "@/components/service-manager";
import { Button } from "@/components/ui/button";
import { OUTSIDE_HOURS_MESSAGE } from "@/lib/booking-rules";
import { barbersForService, dailyReport } from "@/lib/report";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { waLink } from "@/lib/salon";
import { getAdminBirthdays, getAdminRecurringDay, materializeAdminRecurring } from "@/lib/admin-ops.functions";
import { StaffPanel } from "@/components/admin/staff-panel";
import { RecurringPanel } from "@/components/admin/recurring-panel";
import { ProductsPanel } from "@/components/admin/products-panel";
import { CustomersPanel } from "@/components/admin/customers-panel";
import { RewardCelebration } from "@/components/admin/reward-celebration";
import type { NewReward } from "@/lib/membership-rules";


export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Area staff — NDP" },
      { name: "description", content: "Gestione agenda e appuntamenti del salone NDP." },
      { property: "og:title", content: "Area staff — NDP" },
      { property: "og:description", content: "Gestione agenda NDP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return null;
  if (!session) return <Login />;
  return <Dashboard userId={session.user.id} />;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signup, setSignup] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  useEffect(() => { getStaffBootstrap().then((r) => setSignupOpen(r.signupOpen)).catch(() => setSignupOpen(false)); }, []);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (signup && !(await getStaffBootstrap()).signupOpen) { setSignupOpen(false); setSignup(false); toast.error("La registrazione staff è chiusa"); return; }
    const { error, data } = signup
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/admin` } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error(error.message);
    else if (signup) toast.success(data.session ? "Account staff creato" : "Controlla la tua email per confermare l'account");
  }
  const input = "mt-1 w-full border bg-card px-3 py-3 outline-none focus:border-foreground";
  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <Link to="/" className="font-serif text-xl tracking-[0.3em]">NDP</Link>
      <h1 className="mt-10 font-serif text-4xl">Area staff</h1>
      <form onSubmit={go} className="mt-6 space-y-4">
        <label className="block text-sm">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} /></label>
        <label className="block text-sm">Password<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={input} /></label>
        <Button className="h-auto w-full py-3 text-sm uppercase tracking-widest">{signup ? "Crea account" : "Accedi"}</Button>
      </form>
      {signupOpen && <Button variant="link" onClick={() => setSignup(!signup)} className="mt-4 text-sm text-muted-foreground underline">
        {signup ? "Ho già un account" : "Primo accesso? Crea account"}
      </Button>}
    </main>
  );
}

type Appt = {
  id: string; starts_at: string; ends_at: string; status: string; customer_name: string; customer_phone: string; customer_email: string | null;
  customer_id: string | null; notes: string | null; staff_notes: string | null; whatsapp_sent_at: string | null; code: string;
  barber_id: string; service_id: string; payment_status: string; amount_paid: number | null; services: { name: string; price: number; price_from: boolean; category: string } | null;
};
type Occ = Awaited<ReturnType<typeof getAdminRecurringDay>>[number];
const SECTIONS = [["agenda", "Agenda"], ["clienti", "Clienti"], ["fissi", "Clienti fissi"], ["staff", "Staff & orari"], ["servizi", "Servizi"], ["prodotti", "Prodotti"]] as const;
type Section = (typeof SECTIONS)[number][0];
type Approval = { id: string; first_name: string; last_name: string; email: string; phone: string | null; status: string; created_at: string };
type Wait = { id: string; email: string; phone: string | null; day: string; created_at: string };
type Barber = { id: string; name: string; active: boolean };
type Service = ManagedService;
type Customer = { id: string; first_name: string; last_name: string; phone: string; email: string | null };
type Link = { barber_id: string; service_id: string };

const field = "w-full border bg-card px-3 py-2 text-sm outline-none focus:border-accent";

function Dashboard({ userId }: { userId: string }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [date, setDate] = useState(romeDate());
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [waitlist, setWaitlist] = useState<Wait[]>([]);
  const [section, setSection] = useState<Section>("agenda");
  const [occ, setOcc] = useState<Occ[]>([]);
  const [occOpen, setOccOpen] = useState<Occ | null>(null);
  const [rewards, setRewards] = useState<NewReward[]>([]);
  const [birthdays, setBirthdays] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [birthdayRewards, setBirthdayRewards] = useState<{ id: string; customer_id: string }[]>([]);
  const celebrate = (r?: NewReward[]) => { if (r?.length) setRewards(r); };
  const [sheet, setSheet] = useState<{ mode: "create" } | { mode: "edit"; appt: Appt } | null>(null);
  const [tab, setTab] = useState("");

  async function load() {
    const from = new Date(`${date}T00:00:00`).toISOString();
    const to = new Date(`${addDays(date, 1)}T00:00:00`).toISOString();
    const [a, b, s, c, w, l, cu, oc, br] = await Promise.all([
      supabase.from("appointments").select("id,starts_at,ends_at,status,customer_name,customer_phone,customer_email,customer_id,notes,staff_notes,whatsapp_sent_at,code,barber_id,service_id,payment_status,amount_paid,services(name,price,price_from,category)").gte("starts_at", from).lt("starts_at", to).order("starts_at"),
      supabase.from("barbers").select("id,name,active").order("sort"),
      supabase.from("services").select("id,name,category,price,price_from,duration_min,sort,active,counts_as_haircut").order("sort"),
      supabase.from("customer_approvals").select("id,first_name,last_name,email,phone,status,created_at").order("created_at", { ascending: false }),
      supabase.from("waitlist").select("id,email,phone,day,created_at").is("notified_at", null).order("created_at", { ascending: false }),
      supabase.from("barber_services").select("barber_id,service_id"),
      supabase.from("customers").select("id,first_name,last_name,phone,email").eq("active", true).order("last_name"),
      getAdminRecurringDay({ data: { date } }).catch(() => [] as Occ[]),
      supabase.from("customer_rewards").select("id,customer_id").eq("reward_type", "birthday_beard").eq("status", "available"),
    ]);
    setOcc(oc);
    setBirthdayRewards(br.data ?? []);
    setAppts((a.data as Appt[]) ?? []);
    setBarbers(b.data ?? []);
    setServices((s.data as Service[]) ?? []);
    setApprovals((c.data as Approval[]) ?? []);
    setWaitlist((w.data as Wait[]) ?? []);
    setLinks(l.data ?? []);
    setCustomers(cu.data ?? []);
  }

  useEffect(() => {
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle().then(({ data }) => setIsAdmin(!!data));
  }, [userId]);
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, date]);
  useEffect(() => { if (isAdmin) getAdminBirthdays().then(setBirthdays).catch(() => {}); }, [isAdmin]);

  if (isAdmin === null) return null;
  if (!isAdmin)
    return (
      <main className="p-10 text-center">
        <p className="font-serif text-2xl">Questo account non ha accesso all'area staff.</p>
        <button onClick={() => supabase.auth.signOut()} className="mt-4 underline">Esci</button>
      </main>
    );

  const activeBarbers = barbers.filter((b) => b.active);
  const report = dailyReport(appts, activeBarbers);
  const currentTab = activeBarbers.some((b) => b.id === tab) ? tab : activeBarbers[0]?.id ?? "";

  async function reviewCustomer(id: string, status: "approved" | "rejected") {
    try {
      const { sent } = await reviewCustomerApproval({ data: { id, status } });
      toast.success(status === "approved" ? (sent ? "Cliente autorizzato e avvisato su WhatsApp" : "Cliente autorizzato") : "Richiesta rifiutata");
      load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Impossibile aggiornare la richiesta"); }
  }

  const column = (b: Barber) => (
    <section key={b.id} className="border bg-card/60 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-2xl">{b.name}</h2>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{appts.filter((a) => a.barber_id === b.id && a.status !== "cancelled").length} app.</span>
      </div>
      <ul className="mt-3 space-y-2">
        {[...appts.filter((a) => a.barber_id === b.id).map((a) => ({ t: a.starts_at, el: <ApptCard key={a.id} a={a} birthdayRewardId={birthdayRewards.find((r) => r.customer_id === a.customer_id)?.id} onOpen={() => setSheet({ mode: "edit", appt: a })} onChange={load} onRewards={celebrate} /> })),
          ...occ.filter((o) => o.barber_id === b.id).map((o) => ({ t: o.starts_at, el: <li key={o.recurringId} className="border-l-2 border-dashed border-accent bg-background/70 p-2 text-sm"><button type="button" onClick={() => setOccOpen(o)} className="block w-full text-left"><p className="font-medium">{fmtTime(o.starts_at)}–{fmtTime(o.ends_at)} · {o.service?.name} <span className="ml-1 border border-accent px-1.5 py-0.5 text-[9px] uppercase tracking-[0.2em] text-accent">Fisso</span></p><p>{o.customer_name}</p>{o.notes && <p className="text-xs italic text-muted-foreground">{o.notes}</p>}</button></li> }))]
          .sort((x, y) => x.t.localeCompare(y.t)).map((x) => x.el)}
        {!appts.some((a) => a.barber_id === b.id) && !occ.some((o) => o.barber_id === b.id) && <li className="text-sm text-muted-foreground">Nessun appuntamento</li>}
      </ul>
    </section>
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between">
        <Link to="/" className="font-serif text-xl tracking-[0.3em]">NDP</Link>
        <button onClick={() => supabase.auth.signOut()} className="text-sm text-muted-foreground">Esci</button>
      </header>
      <nav className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Sezioni">
        {SECTIONS.map(([k, l]) => <button key={k} onClick={() => setSection(k)} className={`shrink-0 border px-4 py-3 text-xs uppercase tracking-[0.2em] ${section === k ? "border-foreground bg-foreground text-background" : "bg-card"}`}>{l}</button>)}
      </nav>
      <RewardCelebration rewards={rewards} onDone={() => setRewards([])} />
      {section === "clienti" && <div className="mt-8"><CustomersPanel customers={customers} onChange={load} /></div>}
      {section === "fissi" && <div className="mt-8"><RecurringPanel customers={customers} barbers={activeBarbers} services={services.map((x) => ({ ...x, id: x.id }))} links={links} /></div>}
      {section === "staff" && <div className="mt-8"><StaffPanel services={services} onChange={load} /></div>}
      {section === "servizi" && <ServiceManager services={services} onChange={load} />}
      {section === "prodotti" && <div className="mt-8"><ProductsPanel /></div>}
      {section === "agenda" && <>
      {birthdays.length > 0 && <section className="reward-card mt-6 border border-accent/60 bg-card p-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Compleanni di oggi</p>
        <ul className="mt-2 space-y-1">{birthdays.map((b) => <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-serif text-xl">{b.name}</span><span className="text-xs text-muted-foreground">Barba omaggio disponibile · <a href={waLink(`Buon compleanno ${b.name.split(" ")[0]} da tutto NDP!`, b.phone)} target="_blank" rel="noreferrer" className="underline">WhatsApp</a></span></li>)}</ul>
      </section>}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button onClick={() => setDate(addDays(date, -1))} className="border px-3 py-2">←</button>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border bg-card px-3 py-2" />
        <button onClick={() => setDate(addDays(date, 1))} className="border px-3 py-2">→</button>
        <button onClick={() => setDate(romeDate())} className="text-sm underline">Oggi</button>
        <button onClick={() => setSheet({ mode: "create" })} className="ml-auto bg-primary px-5 py-3 text-xs uppercase tracking-[0.2em] text-primary-foreground">+ Nuovo appuntamento</button>
      </div>

      <section className="mt-8 border bg-gradient-to-br from-card to-secondary p-5" aria-label="Resoconto">
        <p className="text-[10px] uppercase tracking-[0.3em] text-accent">{date === romeDate() ? "Resoconto di oggi" : `Resoconto del ${date}`}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr_2fr]">
          <div className="border border-accent/50 bg-background/70 p-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Incasso</p>
            <p className="mt-2 font-serif text-5xl" data-testid="revenue">{euro(report.revenue)}</p>
            <p className="mt-2 text-xs text-muted-foreground">Solo appuntamenti completati e pagati</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {([["Totali", report.total], ["Completati", report.completed], ["Da effettuare", report.toDo], ["Annullati", report.cancelled], ["Servizi completati", report.completed]] as const).map(([l, v]) => (
              <div key={l} className="border bg-background/60 p-3"><p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{l}</p><p className="mt-1 font-serif text-3xl">{v}</p></div>
            ))}
          </div>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {report.byBarber.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between border bg-background/60 px-3 py-2 text-sm">
              <span className="font-serif text-lg">{r.name}</span>
              <span className="text-muted-foreground">{r.services} servizi · <span className="text-foreground">{euro(r.revenue)}</span></span>
            </li>
          ))}
        </ul>
      </section>

      {/* Agenda: tab su mobile, colonne adattive su desktop */}
      <div className="mt-6 md:hidden">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
          {activeBarbers.map((b) => (
            <button key={b.id} onClick={() => setTab(b.id)} className={`shrink-0 border px-4 py-2 text-xs uppercase tracking-[0.2em] ${currentTab === b.id ? "border-foreground bg-foreground text-background" : ""}`}>{b.name}</button>
          ))}
        </div>
        <div className="mt-3">{activeBarbers.filter((b) => b.id === currentTab).map(column)}</div>
      </div>
      <div className="mt-6 hidden gap-4 md:grid" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(activeBarbers.length, 1), 4)}, minmax(0, 1fr))` }}>
        {activeBarbers.map(column)}
      </div>

      <section className="mt-8 border p-4">
        <div className="flex items-end justify-between gap-4">
          <div><p className="text-[10px] uppercase tracking-[0.25em] text-accent">Clienti</p><h2 className="mt-1 font-serif text-3xl">Richieste di autorizzazione</h2></div>
          <span className="text-sm text-muted-foreground">{approvals.filter((r) => r.status === "pending").length} in attesa</span>
        </div>
        <ul className="mt-5 divide-y divide-border">
          {approvals.map((request) => <li key={request.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{request.first_name} {request.last_name}</p>
              <p className="text-sm text-muted-foreground">{request.email}{request.phone ? ` · ${request.phone}` : ""}</p>
            </div>
            <div className="flex items-center gap-3">
              {request.phone && <a href={waLink(`Ciao ${request.first_name}, ti scriviamo da NDP Esclusive Hair Saloon.`, request.phone)} target="_blank" rel="noreferrer" className="text-xs uppercase tracking-wider underline">WhatsApp</a>}
              {request.status === "pending" ? <div className="flex gap-2">
                <button onClick={() => reviewCustomer(request.id, "approved")} className="border border-accent px-3 py-2 text-xs uppercase tracking-wider">Autorizza</button>
                <button onClick={() => reviewCustomer(request.id, "rejected")} className="border px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">Rifiuta</button>
              </div> : <span className={`text-xs uppercase tracking-wider ${request.status === "approved" ? "text-accent" : "text-muted-foreground"}`}>{request.status === "approved" ? "Autorizzato" : "Rifiutato"}</span>}
            </div>
          </li>)}
          {approvals.length === 0 && <li className="py-5 text-sm text-muted-foreground">Nessuna richiesta.</li>}
        </ul>
      </section>

      <section className="mt-6 border p-4">
        <p className="text-[10px] uppercase tracking-[0.25em] text-accent">Lista d’attesa</p>
        <h2 className="mt-1 font-serif text-3xl">Chi aspetta un posto</h2>
        <ul className="mt-4 divide-y divide-border">
          {waitlist.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span>{w.email}{w.phone ? ` · ${w.phone}` : ""} <span className="text-muted-foreground">· {w.day}</span></span>
              <span className="flex gap-3 text-xs">
                {w.phone && <a href={waLink(`Ciao, da NDP: si è liberato un posto il ${w.day}. Vuoi prenotarlo?`, w.phone)} target="_blank" rel="noreferrer" className="underline">Avvisa</a>}
                <button onClick={async () => { await supabase.from("waitlist").update({ notified_at: new Date().toISOString() }).eq("id", w.id); load(); }} className="underline text-muted-foreground">Archivia</button>
              </span>
            </li>
          ))}
          {waitlist.length === 0 && <li className="py-4 text-sm text-muted-foreground">Nessuno in lista d’attesa.</li>}
        </ul>
      </section>

      </>}
      <Sheet open={!!occOpen} onOpenChange={(o) => !o && setOccOpen(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle className="font-serif text-3xl">Cliente fisso</SheetTitle></SheetHeader>
          {occOpen && <OccurrenceForm key={occOpen.recurringId + occOpen.date} o={occOpen} barbers={activeBarbers} services={services.filter((x) => x.active)} links={links} onDone={(r) => { setOccOpen(null); celebrate(r); load(); }} />}
        </SheetContent>
      </Sheet>

      <Sheet open={!!sheet} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle className="font-serif text-3xl">{sheet?.mode === "edit" ? "Modifica appuntamento" : "Nuovo appuntamento"}</SheetTitle></SheetHeader>
          {sheet && (
            <AppointmentForm
              key={sheet.mode === "edit" ? sheet.appt.id : "new"}
              appt={sheet.mode === "edit" ? sheet.appt : undefined}
              date={date}
              barbers={activeBarbers}
              services={services.filter((s) => s.active || (sheet.mode === "edit" && s.id === sheet.appt.service_id))}
              links={links}
              customers={customers}
              onDone={() => { setSheet(null); load(); }}
            />
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}

function ApptCard({ a, onOpen, onChange, onRewards, birthdayRewardId }: { a: Appt; onOpen: () => void; onChange: () => void; onRewards: (r: NewReward[]) => void; birthdayRewardId?: string | undefined }) {
  const canUseBirthday = !!birthdayRewardId && a.services?.category === "barba";
  const [closing, setClosing] = useState(false);
  const [amount, setAmount] = useState(String(Number(a.services?.price ?? 0)));
  const [busy, setBusy] = useState(false);
  const [useBirthday, setUseBirthday] = useState(false);
  async function complete(mode: "paid" | "complimentary") {
    setBusy(true);
    try {
      const res = await completeAdminBooking({ data: { id: a.id, mode, amount: mode === "paid" ? Number(amount.replace(",", ".")) : undefined, ...(useBirthday && mode === "complimentary" && birthdayRewardId ? { redeemRewardId: birthdayRewardId } : {}) } });
      toast.success(mode === "paid" ? "Appuntamento completato" : "Registrato come omaggio");
      onRewards(res.rewards);
      onChange();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Errore"); }
    finally { setBusy(false); }
  }
  return (
    <li className={`border-l-2 bg-background/70 p-2 text-sm ${a.status === "cancelled" ? "border-border opacity-50" : a.status === "completed" ? "border-graphite" : "border-accent"}`}>
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Apri appuntamento ${a.code}`}>
        <p className={`font-medium ${a.status === "cancelled" ? "line-through" : ""}`}>{fmtTime(a.starts_at)}–{fmtTime(a.ends_at)} · {a.services?.name}</p>
        <p>{a.customer_name}</p>
        {a.notes && <p className="text-muted-foreground">Cliente: {a.notes}</p>}
        {a.staff_notes && <p className="text-xs italic text-muted-foreground">Staff: {a.staff_notes}</p>}
        <p className="text-xs text-muted-foreground">{a.code}{a.whatsapp_sent_at ? " · WhatsApp inviato" : ""}
          {a.status === "completed" && (a.payment_status === "complimentary" ? " · Omaggio" : ` · Pagato ${euro(Number(a.amount_paid ?? 0))}`)}
        </p>
      </button>
      <div className="mt-1 flex flex-wrap gap-3 text-xs">
        <a href={`tel:${a.customer_phone}`} className="underline">Chiama</a>
        <a href={waLink(`Ciao ${a.customer_name.split(" ")[0]}, ti scriviamo da NDP per il tuo appuntamento ${a.code} alle ${fmtTime(a.starts_at)}.`, a.customer_phone)} target="_blank" rel="noreferrer" className="underline">WhatsApp</a>
        {a.status === "confirmed" && !closing && <button onClick={() => setClosing(true)} className="underline">Completato</button>}
      </div>
      {closing && a.status === "confirmed" && (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          <label className="block text-xs">Importo ricevuto (listino {a.services ? servicePrice(a.services) : euro(0)})
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} mt-1`} />
          </label>
          {canUseBirthday && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={useBirthday} onChange={(e) => setUseBirthday(e.target.checked)} />Usa la Barba omaggio di compleanno (poi premi Omaggio)</label>}
          <div className="flex gap-2">
            <button disabled={busy || useBirthday} onClick={() => complete("paid")} className="flex-1 bg-primary py-2 text-[10px] uppercase tracking-[0.2em] text-primary-foreground">Conferma</button>
            <button disabled={busy} onClick={() => complete("complimentary")} className="flex-1 border border-accent py-2 text-[10px] uppercase tracking-[0.2em]">Omaggio</button>
            <button onClick={() => setClosing(false)} className="px-2 text-xs text-muted-foreground">✕</button>
          </div>
        </div>
      )}
    </li>
  );
}

function AppointmentForm({ appt, date, barbers, services, links, customers, onDone }: {
  appt?: Appt | undefined; date: string; barbers: Barber[]; services: Service[]; links: Link[]; customers: Customer[]; onDone: () => void;
}) {
  const [customerId, setCustomerId] = useState(appt?.customer_id ?? "");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [nc, setNc] = useState({ firstName: "", lastName: "", phone: "", email: "", birthDate: "" });
  const [f, setF] = useState({
    serviceId: appt?.service_id ?? services[0]?.id ?? "",
    barberId: appt?.barber_id ?? "",
    date: appt ? romeDate(new Date(appt.starts_at)) : date,
    time: appt ? fmtTime(appt.starts_at) : "10:00",
    notes: appt?.notes ?? "",
    staffNotes: appt?.staff_notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const eligible = barbersForService(barbers, links, f.serviceId);
  const [hoursCheck, setHoursCheck] = useState<{ key: string; inside: boolean } | null>(null);
  const [confirmedKey, setConfirmedKey] = useState<string | null>(null);
  const windowKey = `${f.barberId}/${f.serviceId}/${f.date}/${f.time}`;
  const checked = hoursCheck?.key === windowKey;
  const outside = checked && hoursCheck?.inside === false;
  const confirmException = confirmedKey === windowKey;
  useEffect(() => {
    let current = true;
    if (f.barberId && f.serviceId) checkAdminWorkingHours({ data: { barberId: f.barberId, serviceId: f.serviceId, date: f.date, time: f.time } })
      .then((r) => { if (current) setHoursCheck({ key: windowKey, inside: r.inside }); })
      .catch(() => { if (current) setHoursCheck(null); });
    return () => { current = false; };
  }, [windowKey]);
  const barberOk = eligible.some((b) => b.id === f.barberId);
  const selected = customers.find((c) => c.id === customerId);
  const q = query.trim().toLowerCase();
  const matches = q ? customers.filter((c) => `${c.first_name} ${c.last_name} ${c.phone} ${c.email ?? ""}`.toLowerCase().includes(q)).slice(0, 6) : [];
  const svc = services.find((s) => s.id === f.serviceId);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!barberOk) { toast.error("Scegli un professionista abilitato al servizio"); return; }
    if (!checked || (outside && !confirmException)) { toast.error(OUTSIDE_HOURS_MESSAGE + " Conferma eccezione."); return; }
    setBusy(true);
    try {
      let id = customerId;
      if (creating) id = (await saveAdminCustomer({ data: nc })).id;
      if (!id) throw new Error("Seleziona o crea un cliente");
      const payload = { customerId: id, barberId: f.barberId, serviceId: f.serviceId, date: f.date, time: f.time, notes: f.notes || undefined, staffNotes: f.staffNotes || undefined, confirmException };
      if (appt) await updateAdminBooking({ data: { id: appt.id, ...payload } });
      else await createAdminBooking({ data: payload });
      toast.success(appt ? "Modifiche salvate" : "Appuntamento creato");
      onDone();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Errore"); }
    finally { setBusy(false); }
  }
  async function cancel() {
    if (!appt) return;
    setBusy(true);
    try { await cancelAdminBooking({ data: { id: appt.id } }); toast.success("Appuntamento annullato"); onDone(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Errore"); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="mt-6 space-y-4 px-1 pb-6">
      <fieldset className="space-y-2">
        <legend className="text-[10px] uppercase tracking-[0.25em] text-accent">Cliente</legend>
        {appt && !appt.customer_id && !customerId && !creating && <p className="text-xs text-muted-foreground">Prenotazione storica di {appt.customer_name}: collega un cliente in anagrafica.</p>}
        {selected && !creating ? (
          <div className="flex items-center justify-between border bg-secondary px-3 py-2 text-sm">
            <span>{selected.first_name} {selected.last_name} · {selected.phone}</span>
            <button type="button" onClick={() => setCustomerId("")} className="text-xs underline">Cambia</button>
          </div>
        ) : creating ? (
          <div className="grid grid-cols-2 gap-2">
            <input required placeholder="Nome" value={nc.firstName} onChange={(e) => setNc({ ...nc, firstName: e.target.value })} className={field} />
            <input required placeholder="Cognome" value={nc.lastName} onChange={(e) => setNc({ ...nc, lastName: e.target.value })} className={field} />
            <input required type="tel" minLength={6} placeholder="Telefono" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} className={`${field} col-span-2`} />
            <input type="email" placeholder="Email (facoltativa)" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} className={`${field} col-span-2`} />
            <label className="col-span-2 text-xs text-muted-foreground">Data di nascita (facoltativa)<input type="date" value={nc.birthDate} onChange={(e) => setNc({ ...nc, birthDate: e.target.value })} className={`${field} mt-1`} /></label>
            <button type="button" onClick={() => setCreating(false)} className="col-span-2 text-left text-xs underline">Cerca tra i clienti esistenti</button>
          </div>
        ) : (
          <>
            <input placeholder="Cerca per nome, telefono o email" value={query} onChange={(e) => setQuery(e.target.value)} className={field} />
            {matches.length > 0 && <ul className="divide-y divide-border border">
              {matches.map((c) => <li key={c.id}><button type="button" onClick={() => { setCustomerId(c.id); setQuery(""); }} className="w-full px-3 py-2 text-left text-sm hover:bg-secondary">{c.first_name} {c.last_name} <span className="text-muted-foreground">· {c.phone}</span></button></li>)}
            </ul>}
            <button type="button" onClick={() => setCreating(true)} className="text-xs uppercase tracking-[0.2em] underline">+ Nuovo cliente</button>
          </>
        )}
      </fieldset>

      <label className="block text-sm">Servizio
        <select value={f.serviceId} onChange={(e) => setF({ ...f, serviceId: e.target.value })} className={`${field} mt-1`}>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration_min} min · {servicePrice(s)}</option>)}
        </select>
      </label>
      <label className="block text-sm">Professionista
        <select required value={barberOk ? f.barberId : ""} onChange={(e) => setF({ ...f, barberId: e.target.value })} className={`${field} mt-1`}>
          <option value="">Scegli…</option>
          {eligible.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm">Data<input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={`${field} mt-1`} /></label>
        <label className="block text-sm">Ora<input type="time" step={300} required value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} className={`${field} mt-1`} /></label>
      </div>
      {svc && <p className="text-xs text-muted-foreground">Durata {svc.duration_min} min: la fine viene ricalcolata automaticamente.</p>}
      {outside && <div role="alert" className="border-l-2 border-accent bg-secondary p-4 text-sm"><p>{OUTSIDE_HOURS_MESSAGE}</p><label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={confirmException} onChange={(e) => setConfirmedKey(e.target.checked ? windowKey : null)} />Conferma eccezione</label></div>}
      {appt && <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Stato: {appt.status === "confirmed" ? "Confermato" : appt.status === "completed" ? "Completato" : "Annullato"}</p>}
      <label className="block text-sm">Note cliente<textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className={`${field} mt-1`} /></label>
      <label className="block text-sm">Note staff (riservate)<textarea rows={2} value={f.staffNotes} onChange={(e) => setF({ ...f, staffNotes: e.target.value })} className={`${field} mt-1`} /></label>
      <Button disabled={busy || !checked || (outside && !confirmException)} className="h-auto w-full py-3 text-xs uppercase tracking-[0.25em]">{busy ? "Attendi…" : appt ? "Salva modifiche" : "Crea appuntamento"}</Button>
      {appt && appt.status === "confirmed" && <button type="button" disabled={busy} onClick={cancel} className="w-full border border-destructive py-3 text-xs uppercase tracking-[0.25em] text-destructive">Annulla appuntamento</button>}
    </form>
  );
}


function OccurrenceForm({ o, barbers, services, links, onDone }: { o: Occ; barbers: Barber[]; services: Service[]; links: Link[]; onDone: (r?: NewReward[]) => void }) {
  const [mode, setMode] = useState<"menu" | "complete" | "move">("menu");
  const [amount, setAmount] = useState(String(Number(o.service?.price ?? 0)));
  const [mv, setMv] = useState({ barberId: o.barber_id, serviceId: o.service_id, date: o.date, time: fmtTime(o.starts_at), confirmException: false });
  const [busy, setBusy] = useState(false);
  const eligible = barbersForService(barbers, links, mv.serviceId);
  async function run(action: "complete" | "cancel" | "move", pay?: "paid" | "complimentary") {
    if (action === "cancel" && !confirm(`Annullare solo l'appuntamento del ${o.date.split("-").reverse().join("/")}? La ricorrenza resta attiva.`)) return;
    setBusy(true);
    try {
      const res = await materializeAdminRecurring({ data: { recurringId: o.recurringId, date: o.date, action, ...(pay ? { mode: pay, amount: pay === "paid" ? Number(amount.replace(",", ".")) : 0 } : {}), ...(action === "move" ? { move: mv } : {}) } });
      toast.success(action === "complete" ? "Completato e registrato nello storico" : action === "cancel" ? "Annullato per questa data" : "Spostato");
      onDone(res.rewards);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore";
      if (msg.startsWith(OUTSIDE_HOURS_MESSAGE)) toast.error(msg + " Spunta la conferma eccezione."); else toast.error(msg);
    } finally { setBusy(false); }
  }
  return (
    <div className="mt-6 space-y-4 px-1 pb-8">
      <div className="border bg-card p-4 text-sm">
        <p className="font-serif text-2xl">{o.customer_name}</p>
        <p>{o.service?.name} · {fmtTime(o.starts_at)}–{fmtTime(o.ends_at)}</p>
        <p className="text-muted-foreground">{o.interval_weeks === 2 ? "Ogni 2 settimane" : "Ogni settimana"}</p>
      </div>
      {mode === "menu" && <div className="grid gap-2">
        <Button onClick={() => setMode("complete")} className="h-auto py-4 text-xs uppercase tracking-[0.25em]">Completato</Button>
        <Button variant="outline" onClick={() => setMode("move")} className="h-auto py-4 text-xs uppercase tracking-[0.25em]">Sposta / modifica solo questa data</Button>
        <button disabled={busy} onClick={() => run("cancel")} className="border border-destructive py-4 text-xs uppercase tracking-[0.25em] text-destructive">Annulla solo questa data</button>
        {o.customer_phone && <a href={waLink(`Ciao ${o.customer_name.split(" ")[0]}, ti scriviamo da NDP per il tuo appuntamento delle ${fmtTime(o.starts_at)}.`, o.customer_phone)} target="_blank" rel="noreferrer" className="py-2 text-center text-xs underline">WhatsApp</a>}
      </div>}
      {mode === "complete" && <div className="space-y-3">
        <label className="block text-sm">Importo ricevuto (listino {o.service ? servicePrice(o.service) : euro(0)})<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} mt-1`} /></label>
        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => run("complete", "paid")} className="flex-1">Conferma</Button>
          <Button disabled={busy} variant="outline" onClick={() => run("complete", "complimentary")} className="flex-1">Omaggio</Button>
        </div>
        <button onClick={() => setMode("menu")} className="text-xs underline">Indietro</button>
      </div>}
      {mode === "move" && <div className="space-y-3">
        <label className="block text-sm">Servizio<select value={mv.serviceId} onChange={(e) => setMv({ ...mv, serviceId: e.target.value })} className={`${field} mt-1`}>{services.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label className="block text-sm">Professionista<select value={mv.barberId} onChange={(e) => setMv({ ...mv, barberId: e.target.value })} className={`${field} mt-1`}><option value="">Scegli…</option>{eligible.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm">Data<input type="date" value={mv.date} onChange={(e) => setMv({ ...mv, date: e.target.value })} className={`${field} mt-1`} /></label>
          <label className="block text-sm">Ora<input type="time" step={300} value={mv.time} onChange={(e) => setMv({ ...mv, time: e.target.value })} className={`${field} mt-1`} /></label>
        </div>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={mv.confirmException} onChange={(e) => setMv({ ...mv, confirmException: e.target.checked })} />Conferma eccezione se fuori orario di lavoro</label>
        <Button disabled={busy || !eligible.some((b) => b.id === mv.barberId)} onClick={() => run("move")} className="h-auto w-full py-4 text-xs uppercase tracking-[0.25em]">Salva solo per questa data</Button>
        <button onClick={() => setMode("menu")} className="text-xs underline">Indietro</button>
      </div>}
    </div>
  );
}
