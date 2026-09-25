import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getCatalog } from "@/lib/booking.functions";
import { fmtShort, fmtTime, euro } from "@/lib/format";
import logo from "@/assets/ndp-logo.png.asset.json";

export const catalogQuery = queryOptions({ queryKey: ["catalog"], queryFn: () => getCatalog(), staleTime: 30_000 });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NDP Nicola De Pompeis — Esclusive Hair Saloon" },
      { name: "description", content: "Tre poltrone, un solo standard. Prenota in pochi secondi il tuo taglio da Nicola, Daniele o Antonio." },
      { property: "og:title", content: "NDP Nicola De Pompeis — Esclusive Hair Saloon" },
      { property: "og:description", content: "Prenota online il tuo taglio: vedi subito il primo orario libero." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  component: Home,
});

function Home() {
  const { data } = useSuspenseQuery(catalogQuery);
  const next = [...data.next].filter((n) => n.start).sort((a, b) => a.start!.localeCompare(b.start!))[0];
  const nextBarber = data.barbers.find((b) => b.id === next?.barberId);

  return (
    <main className="pb-28">
      <div className="anim-intro fixed inset-0 z-50 flex items-center justify-center bg-background pointer-events-none">
        <img src={logo.url} alt="" className="anim-logo w-64" />
      </div>

      <header className="flex items-center justify-between px-6 py-5">
        <span className="font-serif text-xl tracking-[0.3em]">NDP</span>
        <Link to="/admin" className="text-xs uppercase tracking-widest text-muted-foreground">Area staff</Link>
      </header>

      <section className="px-6 pt-6 pb-16 text-center">
        <img src={logo.url} alt="NDP Nicola De Pompeis — Esclusive Hair Saloon" className="anim-fade mx-auto w-full max-w-md" style={{ animationDelay: "1.6s" }} />
        <p className="anim-fade mx-auto mt-2 max-w-sm font-serif text-2xl italic text-muted-foreground" style={{ animationDelay: "1.9s" }}>
          Tre poltrone. Un solo standard.
        </p>
        {next && (
          <Link
            to="/prenota"
            search={{ barber: next.barberId }}
            className="anim-fade mt-10 inline-flex flex-col items-center border border-accent px-8 py-4"
            style={{ animationDelay: "2.1s" }}
          >
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Prima disponibilità</span>
            <span className="mt-1 font-serif text-2xl capitalize">{fmtShort(next.start!)} · {fmtTime(next.start!)}</span>
            <span className="text-xs text-muted-foreground">con {nextBarber?.name}</span>
          </Link>
        )}
      </section>

      <section className="bg-primary px-6 py-16 text-primary-foreground">
        <h2 className="text-center text-[11px] uppercase tracking-[0.4em] text-accent">The Chair</h2>
        <p className="mt-3 text-center font-serif text-3xl">Scegli la tua poltrona</p>
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
          {data.barbers.map((b, i) => {
            const n = data.next.find((x) => x.barberId === b.id);
            return (
              <Link key={b.id} to="/prenota" search={{ barber: b.id }} className="group border border-primary-foreground/15 p-6 transition-colors hover:border-accent">
                <span className="font-serif text-5xl text-graphite">0{i + 1}</span>
                <h3 className="mt-4 font-serif text-3xl">{b.name}</h3>
                <p className="text-xs uppercase tracking-widest text-accent">{b.role_title}</p>
                <p className="mt-3 text-sm text-primary-foreground/70">{b.bio}</p>
                <p className="mt-6 border-t border-primary-foreground/15 pt-4 text-sm">
                  {n?.start ? <>Prossimo slot: <span className="capitalize">{fmtShort(n.start)}</span> · {fmtTime(n.start)}</> : "Nessuno slot a breve"}
                </p>
                <span className="mt-4 inline-block text-xs uppercase tracking-widest text-accent group-hover:underline">Prenota →</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-6 py-16">
        <h2 className="text-center text-[11px] uppercase tracking-[0.4em] text-muted-foreground">Servizi</h2>
        <ul className="mt-8 divide-y">
          {data.services.map((s) => (
            <li key={s.id}>
              <Link to="/prenota" search={{ service: s.id }} className="flex items-baseline justify-between gap-4 py-4">
                <span>
                  <span className="font-serif text-2xl">{s.name}</span>
                  <span className="block text-sm text-muted-foreground">{s.description} · {s.duration_min} min</span>
                </span>
                <span className="font-serif text-xl">{euro(Number(s.price))}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t px-6 py-12 text-center text-sm text-muted-foreground">
        <p className="font-serif text-2xl text-foreground">Il salone</p>
        <p className="mt-3">Via Esempio 1, Città (indirizzo da confermare)</p>
        <p>Mar–Sab 9:00–13:00 · 14:30–19:30</p>
        <p>Tel. +39 000 000 0000 · @ndp.hairsaloon</p>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-4 backdrop-blur">
        <Link to="/prenota" className="block bg-primary py-4 text-center text-sm uppercase tracking-[0.3em] text-primary-foreground">
          Prenota ora
        </Link>
      </div>
    </main>
  );
}
