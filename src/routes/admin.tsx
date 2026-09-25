import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { addDays, euro, fmtTime, romeDate } from "@/lib/format";

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
  async function go(e: React.FormEvent) {
    e.preventDefault();
    const { error } = signup
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/admin` } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error(error.message);
    else if (signup) toast.success("Controlla la tua email per confermare l'account");
  }
  const input = "mt-1 w-full border bg-card px-3 py-3 outline-none focus:border-foreground";
  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <Link to="/" className="font-serif text-xl tracking-[0.3em]">NDP</Link>
      <h1 className="mt-10 font-serif text-4xl">Area staff</h1>
      <form onSubmit={go} className="mt-6 space-y-4">
        <label className="block text-sm">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} /></label>
        <label className="block text-sm">Password<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={input} /></label>
        <button className="w-full bg-primary py-3 text-sm uppercase tracking-widest text-primary-foreground">{signup ? "Crea account" : "Accedi"}</button>
      </form>
      <button onClick={() => setSignup(!signup)} className="mt-4 text-sm text-muted-foreground underline">
        {signup ? "Ho già un account" : "Primo accesso? Crea account"}
      </button>
    </main>
  );
}

type Appt = { id: string; starts_at: string; ends_at: string; status: string; customer_name: string; customer_phone: string; notes: string | null; code: string; barber_id: string; services: { name: string } | null };

function Dashboard({ userId }: { userId: string }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [date, setDate] = useState(romeDate());
  const [barbers, setBarbers] = useState<{ id: string; name: string }[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [services, setServices] = useState<{ id: string; name: string; price: number; duration_min: number }[]>([]);
  const [block, setBlock] = useState({ barber: "", from: "13:00", to: "14:00", reason: "" });

  async function load() {
    const from = new Date(`${date}T00:00:00`).toISOString();
    const to = new Date(`${addDays(date, 1)}T00:00:00`).toISOString();
    const [a, b, s] = await Promise.all([
      supabase.from("appointments").select("id,starts_at,ends_at,status,customer_name,customer_phone,notes,code,barber_id,services(name)").gte("starts_at", from).lt("starts_at", to).order("starts_at"),
      supabase.from("barbers").select("id,name").order("sort"),
      supabase.from("services").select("id,name,price,duration_min").order("sort"),
    ]);
    setAppts((a.data as Appt[]) ?? []);
    setBarbers(b.data ?? []);
    setServices(s.data ?? []);
  }

  useEffect(() => {
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle().then(({ data }) => setIsAdmin(!!data));
  }, [userId]);
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, date]);

  if (isAdmin === null) return null;
  if (!isAdmin)
    return (
      <main className="p-10 text-center">
        <p className="font-serif text-2xl">Questo account non ha accesso all'area staff.</p>
        <button onClick={() => supabase.auth.signOut()} className="mt-4 underline">Esci</button>
      </main>
    );

  async function setStatus(id: string, status: string) {
    await supabase.from("appointments").update({ status }).eq("id", id);
    load();
  }
  async function addBlock(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("blocked_slots").insert({
      barber_id: block.barber, reason: block.reason || null,
      starts_at: new Date(`${date}T${block.from}:00`).toISOString(), ends_at: new Date(`${date}T${block.to}:00`).toISOString(),
    });
    if (error) toast.error(error.message); else toast.success("Orario bloccato");
  }
  async function savePrice(id: string, price: number) {
    await supabase.from("services").update({ price }).eq("id", id);
    toast.success("Prezzo aggiornato");
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-6">
      <header className="flex items-center justify-between">
        <Link to="/" className="font-serif text-xl tracking-[0.3em]">NDP</Link>
        <button onClick={() => supabase.auth.signOut()} className="text-sm text-muted-foreground">Esci</button>
      </header>
      <div className="mt-8 flex items-center gap-3">
        <button onClick={() => setDate(addDays(date, -1))} className="border px-3 py-2">←</button>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border bg-card px-3 py-2" />
        <button onClick={() => setDate(addDays(date, 1))} className="border px-3 py-2">→</button>
        <button onClick={() => setDate(romeDate())} className="text-sm underline">Oggi</button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {barbers.map((b) => (
          <section key={b.id} className="border p-4">
            <h2 className="font-serif text-2xl">{b.name}</h2>
            <ul className="mt-3 space-y-2">
              {appts.filter((a) => a.barber_id === b.id).map((a) => (
                <li key={a.id} className={`border-l-2 p-2 text-sm ${a.status === "cancelled" ? "border-border opacity-50 line-through" : a.status === "completed" ? "border-graphite" : "border-accent"}`}>
                  <p className="font-medium">{fmtTime(a.starts_at)}–{fmtTime(a.ends_at)} · {a.services?.name}</p>
                  <p>{a.customer_name} · <a href={`tel:${a.customer_phone}`} className="underline">{a.customer_phone}</a></p>
                  {a.notes && <p className="text-muted-foreground">{a.notes}</p>}
                  <p className="text-xs text-muted-foreground">{a.code}</p>
                  {a.status === "confirmed" && (
                    <div className="mt-1 flex gap-3 text-xs">
                      <button onClick={() => setStatus(a.id, "completed")} className="underline">Completato</button>
                      <button onClick={() => setStatus(a.id, "cancelled")} className="text-destructive underline">Annulla</button>
                    </div>
                  )}
                </li>
              ))}
              {!appts.some((a) => a.barber_id === b.id) && <li className="text-sm text-muted-foreground">Nessun appuntamento</li>}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <form onSubmit={addBlock} className="space-y-3 border p-4">
          <h2 className="font-serif text-2xl">Blocca orario ({date})</h2>
          <select required value={block.barber} onChange={(e) => setBlock({ ...block, barber: e.target.value })} className="w-full border bg-card px-3 py-2">
            <option value="">Professionista…</option>
            {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <div className="flex gap-2">
            <input type="time" value={block.from} onChange={(e) => setBlock({ ...block, from: e.target.value })} className="flex-1 border bg-card px-3 py-2" />
            <input type="time" value={block.to} onChange={(e) => setBlock({ ...block, to: e.target.value })} className="flex-1 border bg-card px-3 py-2" />
          </div>
          <input placeholder="Motivo (facoltativo)" value={block.reason} onChange={(e) => setBlock({ ...block, reason: e.target.value })} className="w-full border bg-card px-3 py-2" />
          <button className="w-full bg-primary py-2 text-sm uppercase tracking-widest text-primary-foreground">Blocca</button>
        </form>
        <section className="border p-4">
          <h2 className="font-serif text-2xl">Listino</h2>
          <ul className="mt-3 space-y-2">
            {services.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{s.name} · {s.duration_min} min <span className="text-muted-foreground">({euro(Number(s.price))})</span></span>
                <input type="number" step="0.5" defaultValue={Number(s.price)} onBlur={(e) => savePrice(s.id, Number(e.target.value))} className="w-20 border bg-card px-2 py-1" />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
