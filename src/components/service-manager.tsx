import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveAdminService } from "@/lib/admin.functions";
import type { ServiceInput } from "@/lib/service-rules";
import { servicePrice } from "@/lib/format";

export type ManagedService = ServiceInput & { id: string };
const field = "w-full border bg-card px-3 py-2 text-sm outline-none focus:border-accent";
const empty: ServiceInput = { name: "", category: "capelli", price: 0, price_from: false, duration_min: 30, sort: 0, active: true, counts_as_haircut: false };

export function ServiceManager({ services, onChange }: { services: ManagedService[]; onChange: () => void }) {
  const [editing, setEditing] = useState<ServiceInput | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      await saveAdminService({ data: editing });
      await Promise.all([qc.invalidateQueries({ queryKey: ["catalog"] }), qc.invalidateQueries({ queryKey: ["slots"] }), qc.invalidateQueries({ queryKey: ["slots-14"] })]);
      toast.success("Servizio salvato"); setEditing(null); onChange();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Impossibile salvare"); }
    finally { setBusy(false); }
  }
  return <section className="mt-10 border-t border-border pt-8" aria-label="Gestione servizi">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-serif text-3xl">Gestione servizi</h2>
      <Button variant="outline" onClick={() => setEditing({ ...empty, sort: Math.max(0, ...services.map((s) => s.sort)) + 1 })}><Plus /> Aggiungi servizio</Button>
    </div>
    {editing && <form onSubmit={save} className="mt-6 grid gap-4 border-b border-border pb-6 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm sm:col-span-2">Nome<input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={`${field} mt-1`} /></label>
      <label className="text-sm">Categoria<select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value === "barba" ? "barba" : "capelli" })} className={`${field} mt-1`}><option value="capelli">Capelli</option><option value="barba">Barba</option></select></label>
      <label className="text-sm">Prezzo (€)<input type="number" min="0" step="0.01" required value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} className={`${field} mt-1`} /></label>
      <label className="text-sm">Durata (minuti)<input type="number" min="10" max="480" required value={editing.duration_min} onChange={(e) => setEditing({ ...editing, duration_min: Number(e.target.value) })} className={`${field} mt-1`} /></label>
      <label className="text-sm">Ordine<input type="number" min="0" required value={editing.sort} onChange={(e) => setEditing({ ...editing, sort: Number(e.target.value) })} className={`${field} mt-1`} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.price_from} onChange={(e) => setEditing({ ...editing, price_from: e.target.checked })} />Prezzo a partire da</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />Attivo</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.counts_as_haircut} onChange={(e) => setEditing({ ...editing, counts_as_haircut: e.target.checked })} />Conta per obiettivi Membership</label>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-4"><Button disabled={busy}><Save />Salva servizio</Button><Button type="button" variant="ghost" onClick={() => setEditing(null)}><X />Annulla</Button></div>
    </form>}
    <ul className="mt-5 divide-y divide-border">
      {services.map((s) => <li key={s.id} className={`flex items-center justify-between gap-3 py-4 ${s.active ? "" : "opacity-60"}`}>
        <div className="min-w-0"><p className="font-serif text-xl">{s.name}</p><p className="text-sm capitalize text-muted-foreground">{s.category} · {s.duration_min} min · {servicePrice(s)} · {s.active ? "Attivo" : "Non attivo"}{s.counts_as_haircut ? " · Membership" : ""}</p></div>
        <Button size="icon" variant="ghost" aria-label={`Modifica ${s.name}`} title={`Modifica ${s.name}`} onClick={() => setEditing(s)}><Pencil /></Button>
      </li>)}
    </ul>
  </section>;
}