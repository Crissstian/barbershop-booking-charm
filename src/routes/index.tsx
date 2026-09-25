import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getCatalog } from "@/lib/booking.functions";
import { fmtShort, fmtTime, euro } from "@/lib/format";
import logo from "@/assets/ndp-logo.png.asset.json";
import { ScrollReveal } from "@/components/scroll-reveal";

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
  const products = [
    { number: "01", name: "Cera Opaca", type: "Styling", note: "Tenuta decisa, finish naturale", shape: "product-jar" },
    { number: "02", name: "Olio Nutriente", type: "Beard ritual", note: "Legno di sandalo e cedro", shape: "product-bottle" },
    { number: "03", name: "Shampoo Daily", type: "Hair care", note: "Detersione delicata quotidiana", shape: "product-tube" },
  ];

  return (
    <main className="overflow-hidden bg-background pb-28 text-foreground">
      <div className="cinema-intro pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background" aria-hidden="true">
        <div className="intro-curtain intro-curtain-left" />
        <div className="intro-curtain intro-curtain-right" />
        <div className="intro-mark text-center">
          <p className="font-serif text-7xl sm:text-8xl">NDP</p>
          <span className="intro-line mx-auto mt-4 block h-px w-24 bg-accent" />
          <p className="mt-4 text-[9px] uppercase tracking-[0.45em] text-muted-foreground">Nicola De Pompeis</p>
        </div>
      </div>

      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-border/40 bg-background/70 px-6 py-5 backdrop-blur-xl">
        <Link to="/" className="font-serif text-xl">NDP</Link>
        <Link to="/admin" className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-accent">Area staff</Link>
      </header>

      <section className="hero-scene relative flex min-h-[92svh] flex-col items-center justify-center px-6 pt-20 text-center">
        <div className="hero-halo" aria-hidden="true" />
        <img src={logo.url} alt="NDP Nicola De Pompeis — Esclusive Hair Saloon" className="hero-logo relative z-10 w-full max-w-md" />
        <p className="hero-copy relative z-10 mx-auto mt-3 max-w-sm font-serif text-2xl italic text-muted-foreground">Tre poltrone. Un solo standard.</p>
        {next && (
          <Link
            to="/prenota"
            search={{ barber: next.barberId }}
            className="hero-availability group relative z-10 mt-10 inline-flex flex-col items-center overflow-hidden border border-accent/50 px-8 py-4 transition-colors hover:border-accent"
          >
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Prima disponibilità</span>
            <span className="mt-1 font-serif text-2xl capitalize">{fmtShort(next.start!)} · {fmtTime(next.start!)}</span>
             <span className="text-xs text-muted-foreground">con {nextBarber?.name}</span>
             <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-accent transition-transform duration-500 group-hover:scale-x-100" />
          </Link>
        )}
        <div className="hero-scroll absolute bottom-8 flex flex-col items-center gap-3 text-[9px] uppercase tracking-[0.25em] text-muted-foreground"><span>Scorri</span><span className="h-10 w-px bg-accent" /></div>
      </section>

      <section className="stone-band border-y border-border px-6 py-24 text-stone-foreground">
        <ScrollReveal className="mx-auto max-w-6xl">
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">The Chair · La collezione</p>
          <h2 className="mt-4 max-w-2xl font-serif text-5xl leading-none md:text-7xl">Scegli la tua poltrona.</h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-stone-muted">Tre professionisti, un rituale costruito intorno al tuo stile.</p>
        </ScrollReveal>
        <div className="mx-auto mt-16 max-w-6xl">
          {data.barbers.map((b, i) => {
            const n = data.next.find((x) => x.barberId === b.id);
            return (
              <ScrollReveal key={b.id}>
                <Link to="/prenota" search={{ barber: b.id }} className="typographic-chair group relative grid min-h-72 overflow-hidden border-t border-stone-line py-9 last:border-b md:grid-cols-[9rem_1fr_auto] md:items-center md:gap-10">
                  <span className="chair-number font-serif text-7xl text-stone-line transition-colors duration-500 group-hover:text-walnut">0{i + 1}</span>
                  <div className="relative z-10 mt-6 md:mt-0">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-walnut">{b.role_title}</p>
                    <h3 className="mt-2 font-serif text-6xl leading-none md:text-7xl">{b.name}</h3>
                    <p className="mt-5 max-w-lg text-sm text-stone-muted">{b.bio}</p>
                  </div>
                  <div className="relative z-10 mt-8 md:mt-0 md:text-right">
                    <p className="text-[9px] uppercase tracking-[0.2em] text-stone-muted">Prossimo orario</p>
                    <p className="mt-2 font-serif text-xl">{n?.start ? <><span className="capitalize">{fmtShort(n.start)}</span> · {fmtTime(n.start)}</> : "Da definire"}</p>
                    <span className="mt-5 inline-block text-[10px] uppercase tracking-[0.22em] text-walnut transition-transform group-hover:translate-x-2">Prenota →</span>
                  </div>
                  <span className="chair-sweep absolute inset-y-0 left-0 w-full origin-left scale-x-0 bg-stone-hover transition-transform duration-700 group-hover:scale-x-100" />
                </Link>
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      <section className="walnut-band overflow-hidden px-6 py-28 text-walnut-foreground">
        <ScrollReveal className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between gap-8">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-champagne">NDP Essentials</p>
              <h2 className="mt-4 max-w-xl font-serif text-5xl leading-none md:text-7xl">Il rituale continua.</h2>
            </div>
            <p className="hidden max-w-xs text-sm text-walnut-muted md:block">Una selezione essenziale per mantenere forma, texture e carattere ogni giorno.</p>
          </div>
        </ScrollReveal>
        <div className="product-track mx-auto mt-16 flex max-w-6xl snap-x snap-mandatory gap-5 overflow-x-auto pb-6">
          {products.map((product) => (
            <ScrollReveal key={product.number} className="min-w-[82%] snap-center sm:min-w-[48%] lg:min-w-[31%]">
              <article className="product-card group border border-walnut-line bg-walnut-card p-5">
                <div className="product-stage relative flex aspect-[4/5] items-center justify-center overflow-hidden border border-walnut-line">
                  <span className="absolute left-4 top-4 font-serif text-4xl text-walnut-line">{product.number}</span>
                  <div className={`${product.shape} product-shape relative transition-transform duration-700 group-hover:-translate-y-3`}>
                    <span>NDP</span>
                  </div>
                  <div className="product-shadow absolute bottom-[14%] h-5 w-28 rounded-full" />
                </div>
                <p className="mt-6 text-[9px] uppercase tracking-[0.22em] text-champagne">{product.type}</p>
                <h3 className="mt-2 font-serif text-3xl">{product.name}</h3>
                <p className="mt-2 text-sm text-walnut-muted">{product.note}</p>
                <p className="mt-6 border-t border-walnut-line pt-4 text-[10px] uppercase tracking-[0.2em]">Disponibile in salone</p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-28 md:pt-44">
        <ScrollReveal className="md:grid md:grid-cols-[1fr_1.35fr] md:gap-20">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-accent">I servizi</p>
            <h2 className="mt-4 font-serif text-5xl leading-none md:text-7xl">Precisione, senza compromessi.</h2>
          </div>
        <ul className="mt-12 divide-y divide-border md:mt-0">
          {data.services.map((s) => (
            <li key={s.id}>
              <Link to="/prenota" search={{ service: s.id }} className="service-row group flex items-baseline justify-between gap-4 py-6">
                <span>
                  <span className="font-serif text-2xl transition-colors group-hover:text-accent">{s.name}</span>
                  <span className="block text-sm text-muted-foreground">{s.description} · {s.duration_min} min</span>
                </span>
                <span className="font-serif text-xl transition-transform group-hover:-translate-x-2">{euro(Number(s.price))}</span>
              </Link>
            </li>
          ))}
        </ul>
        </ScrollReveal>
      </section>

      <section className="border-t border-border px-6 py-20 text-center text-sm text-muted-foreground">
        <ScrollReveal>
          <p className="font-serif text-4xl text-foreground">Il salone</p>
          <div className="mx-auto my-6 h-px w-16 bg-accent" />
          <p>Via Esempio 1, Città (indirizzo da confermare)</p>
          <p>Mar–Sab 9:00–13:00 · 14:30–19:30</p>
          <p>Tel. +39 000 000 0000 · @ndp.hairsaloon</p>
        </ScrollReveal>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/80 p-3 backdrop-blur-xl md:left-auto md:right-6 md:bottom-6 md:w-72 md:border">
        <Link to="/prenota" className="booking-cta group relative block overflow-hidden border border-accent/50 py-4 text-center text-xs uppercase tracking-[0.25em] text-foreground">
          <span className="relative z-10">Prenota ora</span>
        </Link>
      </div>
    </main>
  );
}
