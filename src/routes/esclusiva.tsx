import { createFileRoute, Link } from "@tanstack/react-router";
import { ScrollReveal } from "@/components/scroll-reveal";
import { SplitText } from "@/components/split-text";
import { MemberPass } from "@/components/exclusive/member-pass";
import { GiftCardStudio } from "@/components/exclusive/gift-card-studio";
import "@/components/exclusive/exclusive.css";

export const Route = createFileRoute("/esclusiva")({
  head: () => ({
    meta: [
      { title: "Tessera Membro e Gift Card — NDP Esclusive Hair Saloon" },
      { name: "description", content: "Attiva la tessera membro NDP e componi una gift card su misura da inviare in pochi secondi." },
      { property: "og:title", content: "Tessera Membro e Gift Card — NDP" },
      { property: "og:description", content: "Livelli riservati, vantaggi su invito e il dono NDP personalizzato." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Exclusive,
});

function Exclusive() {
  return (
    <main className="min-h-svh bg-background pb-28 text-foreground">
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-border/40 bg-background/70 px-6 py-5 backdrop-blur-xl">
        <Link to="/" className="font-serif text-xl">NDP</Link>
        <Link to="/prenota" className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-accent">Prenota</Link>
      </header>

      <section className="px-6 pb-16 pt-36 text-center">
        <ScrollReveal>
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">NDP Membership</p>
          <SplitText text="Un club, non una lista." className="mx-auto mt-4 max-w-3xl font-serif text-5xl leading-none md:text-7xl" />
          <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
            La tessera riconosce chi torna. Il dono porta qualcuno di nuovo sulla poltrona.
          </p>
        </ScrollReveal>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <ScrollReveal>
          <p className="text-[10px] uppercase tracking-[0.3em] text-champagne">01 · Tessera Membro</p>
          <h2 className="mt-3 font-serif text-4xl leading-none md:text-5xl">Muovi la tessera, la luce la segue.</h2>
        </ScrollReveal>
        <ScrollReveal className="mt-12">
          <MemberPass />
        </ScrollReveal>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <ScrollReveal>
          <p className="text-[10px] uppercase tracking-[0.3em] text-champagne">02 · Il Dono NDP</p>
          <h2 className="mt-3 font-serif text-4xl leading-none md:text-5xl">Comporre un regalo, in un minuto.</h2>
        </ScrollReveal>
        <ScrollReveal className="mt-12">
          <GiftCardStudio />
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
