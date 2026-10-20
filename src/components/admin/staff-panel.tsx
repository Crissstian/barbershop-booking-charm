import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { addAdminBlock, removeAdminBlock, saveAdminBarber, saveAdminHours } from "@/lib/admin-ops.functions";
import { uploadImage } from "@/lib/upload";
import { romeDate, fmtTime } from "@/lib/format";
import { portraitFor } from "@/lib/portraits";

const field = "w-full border bg-card px-3 py-2 text-sm outline-none focus:border-accent";
export const WEEKDAYS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
type StaffRow = { id: string; name: string; role_title: string; bio: string | null; photo_url: string | null; active: boolean; slug: string | null };
type Svc = { id: string; name: string; category: string; active: boolean };
type Range = { start: string; end: string };
type Days = Record<number, Range[]>;
type Block = { id: string; barber_id: string; starts_at: string; ends_at: string; reason: string | null };

const fmtDate = (iso: string) => new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));

export function StaffPanel({ services, onChange }: { services: Svc[]; onChange: () => void }) {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [links, setLinks] = useState<{ barber_id: string; service_id: string }[]>([]);
  const [hours, setHours] = useState<{ barber_id: string; weekday: number; start_time: string; end_time: string }[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [open, setOpen] = useState<StaffRow | null>(null);
  async function load() {
    const [b, l, h, bl] = await Promise.all([
      supabase.from("barbers").select("id,name,role_title,bio,photo_url,active,slug").order("sort"),
      supabase.from("barber_services").select("barber_id,service_id"),
      supabase.from("working_hours").select("barber_id,weekday,start_time,end_time"),
      supabase.from("blocked_slots").select("id,barber_id,starts_at,ends_at,reason").gte("ends_at", new Date().toISOString()).order("starts_at"),
    ]);
    setStaff(b.data ?? []); setLinks(l.data ?? []); setHours(h.data ?? []); setBlocks(bl.data ?? []);
  }
  useEffect(() => { load(); }, []);
  const summary = (id: string) => ORDER.map((d) => {
    const r = hours.filter((h) => h.barber_id === id && h.weekday === d).sort((a, b) => a.start_time.localeCompare(b.start_time));
    return { d, text: r.length ? r.map((x) => `${x.start_time.slice(0, 5)}–${x.end_time.slice(0, 5)}`).join(" | ") : "Chiuso" };
  });
  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-serif text-3xl">Staff & orari</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {staff.map((s) => (
            <li key={s.id}>
              <button onClick={() => setOpen(s)} className={`w-full border bg-card p-4 text-left transition-colors hover:border-accent ${s.active ? "" : "opacity-60"}`}>
                <div className="flex items-baseline justify-between gap-2"><span className="font-serif text-2xl">{s.name}</span><span className="text-xs uppercase tracking-[0.2em] text-accent">{s.active ? "Attivo" : "Non attivo"}</span></div>
                <p className="text-sm text-muted-foreground">{s.role_title}</p>
                <ul className="mt-3 space-y-0.5 text-xs text-muted-foreground">{summary(s.id).map((x) => <li key={x.d} className="flex justify-between gap-2"><span>{WEEKDAYS[x.d]}</span><span>{x.text}</span></li>)}</ul>
                <p className="mt-3 text-xs underline">Modifica</p>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <Absences staff={staff} blocks={blocks} onChange={load} />
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader><SheetTitle className="font-serif text-3xl">{open?.name}</SheetTitle></SheetHeader>
          {open && <StaffEditor key={open.id} s={open} staff={staff} services={services} links={links} hours={hours} onDone={() => { setOpen(null); load(); onChange(); }} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StaffEditor({ s, staff, services, links, hours, onDone }: {
  s: StaffRow; staff: StaffRow[]; services: Svc[]; links: { barber_id: string; service_id: string }[];
  hours: { barber_id: string; weekday: number; start_time: string; end_time: string }[]; onDone: () => void;
}) {
  const [f, setF] = useState({ name: s.name, role_title: s.role_title, bio: s.bio ?? "", photo_url: s.photo_url ?? "", active: s.active });
  const [svc, setSvc] = useState(new Set(links.filter((l) => l.barber_id === s.id).map((l) => l.service_id)));
  const [days, setDays] = useState<Days>(() => Object.fromEntries(ORDER.map((d) => [d, hours.filter((h) => h.barber_id === s.id && h.weekday === d).sort((a, b) => a.start_time.localeCompare(b.start_time)).map((h) => ({ start: h.start_time.slice(0, 5), end: h.end_time.slice(0, 5) }))])));
  const [copyTo, setCopyTo] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const setDay = (d: number, r: Range[]) => setDays({ ...days, [d]: r });
  async function photo(file?: File) {
    if (!file) return;
    setBusy(true);
    try { setF({ ...f, photo_url: await uploadImage(file, "staff") }); toast.success("Foto caricata: ricordati di salvare"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Errore"); } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true);
    try {
      await saveAdminBarber({ data: { id: s.id, ...f, serviceIds: [...svc] } });
      await saveAdminHours({ data: { barberId: s.id, days: ORDER.map((d) => ({ weekday: d, ranges: days[d] ?? [] })), copyTo } });
      toast.success(copyTo.length ? "Salvato e orari copiati" : "Salvato"); onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Errore"); } finally { setBusy(false); }
  }
  const groups = [["capelli", "Capelli"], ["barba", "Barba"]] as const;
  return (
    <div className="mt-6 space-y-7 px-1 pb-8">
      <div className="space-y-3">
        <label className="block text-sm">Nome visualizzato<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={`${field} mt-1`} /></label>
        <label className="block text-sm">Ruolo<input value={f.role_title} onChange={(e) => setF({ ...f, role_title: e.target.value })} className={`${field} mt-1`} /></label>
        <label className="block text-sm">Bio (facoltativa)<textarea rows={3} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} className={`${field} mt-1`} /></label>
        <div className="flex items-center gap-4">
          <div className="h-20 w-16 shrink-0 overflow-hidden border bg-secondary">{portraitFor({ slug: s.slug, photo_url: f.photo_url || null }) && <img src={portraitFor({ slug: s.slug, photo_url: f.photo_url || null })} alt="" className="h-full w-full object-cover" />}</div>
          <div className="space-y-1 text-sm">
            <label className="inline-block cursor-pointer border px-3 py-2 text-xs uppercase tracking-[0.2em]">Cambia foto<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => photo(e.target.files?.[0])} /></label>
            {f.photo_url ? <button type="button" onClick={() => setF({ ...f, photo_url: "" })} className="block text-xs underline">Usa la foto ufficiale</button> : <p className="text-xs text-muted-foreground">Foto ufficiale del sito</p>}
          </div>
        </div>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Prenotabile (attivo)</label>
      </div>

      <fieldset>
        <legend className="text-[10px] uppercase tracking-[0.25em] text-accent">Servizi eseguibili da {f.name}</legend>
        {groups.map(([k, label]) => (
          <div key={k} className="mt-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            {services.filter((x) => x.active && x.category === k).map((x) => (
              <label key={x.id} className="flex items-center gap-3 py-1.5 text-sm"><input type="checkbox" className="h-5 w-5" checked={svc.has(x.id)} onChange={(e) => { const n = new Set(svc); if (e.target.checked) n.add(x.id); else n.delete(x.id); setSvc(n); }} />{x.name}</label>
            ))}
          </div>
        ))}
      </fieldset>

      <fieldset>
        <legend className="text-[10px] uppercase tracking-[0.25em] text-accent">Giorni e orari</legend>
        <ul className="mt-3 divide-y divide-border border">
          {ORDER.map((d) => {
            const r = days[d] ?? [];
            return (
              <li key={d} className="p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{WEEKDAYS[d]}</span>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="h-5 w-5" checked={r.length > 0} onChange={(e) => setDay(d, e.target.checked ? [{ start: "09:00", end: "13:00" }] : [])} />{r.length ? "Aperto" : "Chiuso"}</label>
                </div>
                {r.map((x, i) => (
                  <div key={i} className="mt-2 flex items-center gap-2">
                    <input type="time" value={x.start} onChange={(e) => setDay(d, r.map((y, j) => j === i ? { ...y, start: e.target.value } : y))} className={field} aria-label={`${WEEKDAYS[d]} inizio fascia ${i + 1}`} />
                    <span>–</span>
                    <input type="time" value={x.end} onChange={(e) => setDay(d, r.map((y, j) => j === i ? { ...y, end: e.target.value } : y))} className={field} aria-label={`${WEEKDAYS[d]} fine fascia ${i + 1}`} />
                    <button type="button" onClick={() => setDay(d, r.filter((_, j) => j !== i))} className="px-2 text-lg text-muted-foreground" aria-label="Rimuovi fascia">×</button>
                  </div>
                ))}
                {r.length > 0 && r.length < 3 && <button type="button" onClick={() => setDay(d, [...r, { start: "14:30", end: "19:30" }])} className="mt-2 text-xs underline">+ Aggiungi fascia</button>}
              </li>
            );
          })}
        </ul>
        <div className="mt-4 text-sm">
          <p className="text-xs text-muted-foreground">Copia questi orari anche su:</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {staff.filter((x) => x.id !== s.id).map((x) => <label key={x.id} className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={copyTo.includes(x.id)} onChange={(e) => setCopyTo(e.target.checked ? [...copyTo, x.id] : copyTo.filter((y) => y !== x.id))} />{x.name}</label>)}
          </div>
        </div>
      </fieldset>
      <Button disabled={busy} onClick={save} className="h-auto w-full py-4 text-xs uppercase tracking-[0.25em]">{busy ? "Attendi…" : "Salva"}</Button>
    </div>
  );
}

function Absences({ staff, blocks, onChange }: { staff: StaffRow[]; blocks: Block[]; onChange: () => void }) {
  const today = romeDate();
  const [f, setF] = useState({ barberId: "", mode: "days" as "days" | "hours", from: today, to: today, fromTime: "09:00", toTime: "13:00", reason: "" });
  const [busy, setBusy] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await addAdminBlock({ data: { ...f, reason: f.reason || undefined } }); toast.success("Assenza salvata"); onChange(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Errore"); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!confirm("Rimuovere questo blocco? Gli orari torneranno prenotabili.")) return;
    await removeAdminBlock({ data: { id } }); toast.success("Blocco rimosso"); onChange();
  }
  const name = (id: string) => staff.find((s) => s.id === id)?.name ?? "";
  const describe = (b: Block) => {
    const s = new Date(b.starts_at), e = new Date(b.ends_at);
    const allDay = fmtTime(b.starts_at) === "00:00" && fmtTime(b.ends_at) === "00:00";
    if (allDay) { const last = new Date(e.getTime() - 60000); return romeDate(s) === romeDate(last) ? `${fmtDate(b.starts_at)} · tutto il giorno` : `dal ${fmtDate(b.starts_at)} al ${fmtDate(last.toISOString())}`; }
    return `${fmtDate(b.starts_at)} · ${fmtTime(b.starts_at)}–${fmtTime(b.ends_at)}`;
  };
  return (
    <section>
      <h2 className="font-serif text-3xl">Assenze e ferie</h2>
      <form onSubmit={add} className="mt-5 space-y-3 border p-4">
        <select required value={f.barberId} onChange={(e) => setF({ ...f, barberId: e.target.value })} className={field}>
          <option value="">Professionista…</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          {([["days", "Giorni interi"], ["hours", "Alcune ore"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setF({ ...f, mode: k })} className={`border py-3 text-xs uppercase tracking-[0.2em] ${f.mode === k ? "border-foreground bg-foreground text-background" : ""}`}>{l}</button>)}
        </div>
        {f.mode === "days" ? (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">Dal<input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: e.target.value > f.to ? e.target.value : f.to })} className={`${field} mt-1`} /></label>
            <label className="text-sm">Al (incluso)<input type="date" value={f.to} min={f.from} onChange={(e) => setF({ ...f, to: e.target.value })} className={`${field} mt-1`} /></label>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <label className="text-sm">Giorno<input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: e.target.value })} className={`${field} mt-1`} /></label>
            <label className="text-sm">Dalle<input type="time" value={f.fromTime} onChange={(e) => setF({ ...f, fromTime: e.target.value })} className={`${field} mt-1`} /></label>
            <label className="text-sm">Alle<input type="time" value={f.toTime} onChange={(e) => setF({ ...f, toTime: e.target.value })} className={`${field} mt-1`} /></label>
          </div>
        )}
        <input placeholder="Motivo (facoltativo)" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} className={field} />
        <Button disabled={busy} className="h-auto w-full py-3 text-xs uppercase tracking-[0.25em]">Blocca</Button>
      </form>
      <ul className="mt-4 divide-y divide-border">
        {blocks.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <span><span className="font-medium">{name(b.barber_id)}</span> · {describe(b)}{b.reason ? <span className="text-muted-foreground"> · {b.reason}</span> : null}</span>
            <button onClick={() => remove(b.id)} className="shrink-0 text-xs underline">Rimuovi blocco</button>
          </li>
        ))}
        {blocks.length === 0 && <li className="py-3 text-sm text-muted-foreground">Nessuna assenza in programma.</li>}
      </ul>
    </section>
  );
}
