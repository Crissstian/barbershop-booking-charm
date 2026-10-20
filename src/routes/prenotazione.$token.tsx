import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { cancelBooking, getBooking } from "@/lib/booking.functions";
import { servicePrice, fmtDay, fmtTime } from "@/lib/format";
import { downloadIcs, googleCalendarUrl } from "@/lib/calendar";
import { SALON, waLink } from "@/lib/salon";

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
  const b = data as unknown as { code: string; starts_at: string; ends_at: string; status: string; customer_name: string; whatsapp_sent_at: string | null; barbers: { name: string }; services: { name: string; price: number; price_from: boolean; duration_min: number } };
  const cancelled = b.status === "cancelled";
  const future = Date.parse(b.starts_at) > Date.now();
  const event = {
    title: `${b.services.name} · NDP`,
    details: `Appuntamento ${b.code} con ${b.barbers.name}. ${b.services.duration_min} minuti.`,
    location: SALON.address,
    start: b.starts_at,
    end: b.ends_at,
  };
  const waText = `Ciao ${SALON.name}, confermo l'appuntamento ${b.code}: ${b.services.name} con ${b.barbers.name}, ${fmtDay(b.starts_at)} alle ${fmtTime(b.starts_at)}.`;

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-10 text-center">
      <div className="page-curtain" aria-hidden="true" />
      <Link to="/" className="font-serif text-xl tracking-[0.3em]">NDP</Link>
      <p className="mt-12 text-[11px] uppercase tracking-[0.4em] text-muted-foreground">{cancelled ? "Annullata" : "Prenotazione confermata"}</p>
      <h1 className="mt-3 font-serif text-4xl">{cancelled ? "Alla prossima" : `Ti aspettiamo, ${b.customer_name.split(" ")[0]}`}</h1>
      <div className="booking-panel mt-8 border p-6 text-left">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Codice</p>
        <p className="font-serif text-3xl tracking-widest">{b.code}</p>
        <p className="mt-4 font-serif text-2xl">{b.services.name} con {b.barbers.name}</p>
        <p className="capitalize">{fmtDay(b.starts_at)} · ore {fmtTime(b.starts_at)}</p>
        <p className="text-sm text-muted-foreground">{b.services.duration_min} min · {servicePrice(b.services)}</p>
        <span className="progress-gold mt-5 block h-px w-full" />
      </div>

      {!cancelled && (
        <>
          <a
            href={waLink(waText)}
            target="_blank"
            rel="noreferrer"
            className="wa-cta mt-6 block border border-accent/60 py-4 text-xs uppercase tracking-[0.25em] transition-transform hover:-translate-y-0.5"
          >
            Scrivi al salone su WhatsApp
          </a>
          {b.whatsapp_sent_at && <p className="mt-3 text-xs text-muted-foreground">Ti abbiamo inviato la conferma su WhatsApp al tuo numero.</p>}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer" className="border py-3 text-[10px] uppercase tracking-[0.2em] transition-colors hover:border-accent">Google Calendar</a>
            <button onClick={() => downloadIcs(event)} className="border py-3 text-[10px] uppercase tracking-[0.2em] transition-colors hover:border-accent">iPhone / Calendario</button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Salva questa pagina: è il tuo link per gestire l'appuntamento.</p>
        </>
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
