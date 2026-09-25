import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { cancelBooking, getBooking } from "@/lib/booking.functions";
import { euro, fmtDay, fmtTime } from "@/lib/format";

const q = (token: string) => queryOptions({ queryKey: ["booking", token], queryFn: () => getBooking({ data: { token } }) });

export const Route = createFileRoute("/prenotazione/$token")({
  head: () => ({
    meta: [
      { title: "La tua prenotazione — NDP" },
      { name: "description", content: "Dettagli e gestione della tua prenotazione NDP." },
      { property: "og:title", content: "La tua prenotazione — NDP" },
      { property: "og:description", content: "Controlla o annulla il tuo appuntamento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(q(params.token)),
  component: Page,
});

function Page() {
  const { token } = Route.useParams();
  const { data } = useSuspenseQuery(q(token));
  const qc = useQueryClient();
  if (!data) return <main className="p-10 text-center font-serif text-2xl">Prenotazione non trovata.</main>;
  const b = data as unknown as { code: string; starts_at: string; status: string; customer_name: string; barbers: { name: string }; services: { name: string; price: number; duration_min: number } };
  const cancelled = b.status === "cancelled";
  const future = Date.parse(b.starts_at) > Date.now();

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-10 text-center">
      <Link to="/" className="font-serif text-xl tracking-[0.3em]">NDP</Link>
      <p className="mt-12 text-[11px] uppercase tracking-[0.4em] text-muted-foreground">{cancelled ? "Annullata" : "Prenotazione confermata"}</p>
      <h1 className="mt-3 font-serif text-4xl">{cancelled ? "Alla prossima" : `Ti aspettiamo, ${b.customer_name.split(" ")[0]}`}</h1>
      <div className="mt-8 border p-6 text-left">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Codice</p>
        <p className="font-serif text-3xl tracking-widest">{b.code}</p>
        <p className="mt-4 font-serif text-2xl">{b.services.name} con {b.barbers.name}</p>
        <p className="capitalize">{fmtDay(b.starts_at)} · ore {fmtTime(b.starts_at)}</p>
        <p className="text-sm text-muted-foreground">{b.services.duration_min} min · {euro(Number(b.services.price))}</p>
      </div>
      {!cancelled && (
        <p className="mt-4 text-sm text-muted-foreground">Salva questa pagina: è il tuo link per gestire l'appuntamento.</p>
      )}
      {!cancelled && future && (
        <button
          onClick={async () => {
            if (!confirm("Annullare la prenotazione?")) return;
            await cancelBooking({ data: { token } });
            qc.invalidateQueries({ queryKey: ["booking", token] });
          }}
          className="mt-8 text-sm text-destructive underline"
        >
          Annulla prenotazione
        </button>
      )}
      <Link to="/prenota" className="mt-10 block bg-primary py-4 text-sm uppercase tracking-[0.3em] text-primary-foreground">Nuova prenotazione</Link>
    </main>
  );
}
