import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { deleteAdminProduct, saveAdminProduct } from "@/lib/admin-ops.functions";
import { uploadImage } from "@/lib/upload";

const field = "w-full border bg-card px-3 py-2 text-sm outline-none focus:border-accent";
type P = { id?: string; brand: string; name: string; description: string; image_url: string; sort: number; active: boolean };

export function ProductsPanel() {
  const [list, setList] = useState<Required<P>[]>([]);
  const [edit, setEdit] = useState<P | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  async function load() {
    const { data } = await supabase.from("products").select("id,brand,name,description,image_url,sort,active").order("sort");
    setList((data ?? []).map((p) => ({ ...p, description: p.description ?? "", image_url: p.image_url ?? "" })));
  }
  useEffect(() => { load(); }, []);
  const refresh = async () => { await qc.invalidateQueries({ queryKey: ["catalog"] }); await load(); };
  async function save() {
    if (!edit) return;
    setBusy(true);
    try { await saveAdminProduct({ data: edit }); toast.success("Prodotto salvato"); setEdit(null); await refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Errore"); } finally { setBusy(false); }
  }
  async function toggle(p: Required<P>) { await saveAdminProduct({ data: { ...p, active: !p.active } }); await refresh(); }
  async function remove(p: Required<P>) {
    if (!confirm(`Eliminare definitivamente "${p.name}"? Per toglierlo solo dal sito usa "Nascondi".`)) return;
    await deleteAdminProduct({ data: { id: p.id } }); toast.success("Prodotto eliminato"); await refresh();
  }
  async function photo(file?: File) {
    if (!file || !edit) return;
    setBusy(true);
    try { setEdit({ ...edit, image_url: await uploadImage(file, "products") }); } catch (e) { toast.error(e instanceof Error ? e.message : "Errore"); } finally { setBusy(false); }
  }
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-3xl">Prodotti</h2>
        <Button variant="outline" onClick={() => setEdit({ brand: "", name: "", description: "", image_url: "", sort: Math.max(0, ...list.map((p) => p.sort)) + 1, active: true })}>+ Aggiungi prodotto</Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Vetrina in homepage con "Disponibile in salone". Nessuna vendita online.</p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <li key={p.id} className={`flex gap-3 border bg-card p-3 ${p.active ? "" : "opacity-60"}`}>
            <div className="h-24 w-20 shrink-0 overflow-hidden bg-secondary">{p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover" />}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] uppercase tracking-[0.2em] text-accent">{p.brand}</p>
              <p className="font-serif text-lg leading-tight">{p.name}</p>
              <p className="text-xs text-muted-foreground">Posizione {p.sort} · {p.active ? "Visibile" : "Nascosto"}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <button onClick={() => setEdit(p)} className="underline">Modifica</button>
                <button onClick={() => toggle(p)} className="underline">{p.active ? "Nascondi" : "Mostra"}</button>
                <button onClick={() => remove(p)} className="text-destructive underline">Elimina</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Sheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle className="font-serif text-3xl">{edit?.id ? "Modifica prodotto" : "Nuovo prodotto"}</SheetTitle></SheetHeader>
          {edit && <div className="mt-6 space-y-4 px-1 pb-8">
            <div className="aspect-[4/5] w-40 overflow-hidden border bg-secondary">{edit.image_url && <img src={edit.image_url} alt="" className="h-full w-full object-cover" />}</div>
            <label className="inline-block cursor-pointer border px-3 py-2 text-xs uppercase tracking-[0.2em]">{edit.image_url ? "Cambia foto" : "Carica foto"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => photo(e.target.files?.[0])} /></label>
            <label className="block text-sm">Marca<input value={edit.brand} onChange={(e) => setEdit({ ...edit, brand: e.target.value })} className={`${field} mt-1`} /></label>
            <label className="block text-sm">Nome<input required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={`${field} mt-1`} /></label>
            <label className="block text-sm">Descrizione (facoltativa)<textarea rows={3} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} className={`${field} mt-1`} /></label>
            <label className="block text-sm">Posizione nella vetrina<input type="number" min={0} value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) })} className={`${field} mt-1`} /></label>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />Visibile sul sito</label>
            <Button disabled={busy || !edit.name.trim()} onClick={save} className="h-auto w-full py-4 text-xs uppercase tracking-[0.25em]">{busy ? "Attendi…" : "Salva"}</Button>
          </div>}
        </SheetContent>
      </Sheet>
    </section>
  );
}
