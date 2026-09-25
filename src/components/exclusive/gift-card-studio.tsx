import { useMemo, useState } from "react";
import { SALON } from "@/lib/salon";

const EXPERIENCES = [
  { id: "taglio", name: "Rituale Taglio", note: "Consulenza, taglio sartoriale e styling finale.", price: 30 },
  { id: "barba", name: "Barba Regale", note: "Panno caldo, lama artigianale e oli nutrienti.", price: 25 },
  { id: "total", name: "Total Experience", note: "Taglio, barba e rituale completo con Nicola.", price: 60 },
];

export function GiftCardStudio() {
  const [exp, setExp] = useState("total");
  const [to, setTo] = useState("");
  const [from, setFrom] = useState("");
  const [note, setNote] = useState("");

  const chosen = EXPERIENCES.find((e) => e.id === exp)!;
  const code = useMemo(() => {
    const base = `${chosen.id}${to}${from}`.toUpperCase().replace(/[^A-Z0-9]/g, "");
    let h = 7;
    for (const c of base) h = (h * 31 + c.charCodeAt(0)) % 9000;
    return `NDP-GIFT-${1000 + h}`;
  }, [chosen.id, to, from]);

  const message = `Hai ricevuto un dono da NDP Esclusive Hair Saloon.\n\nPer: ${to || "…"}\nDa: ${from || "…"}\nEsperienza: ${chosen.name}\n${note ? `\n"${note}"\n` : ""}\nCodice: ${code}\nPrenota su ${SALON.name}.`;

  return (
    <div className="grid gap-12 md:grid-cols-[.95fr_1.05fr] md:items-start">
      <div className="space-y-8">
        <div>
          <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Scegli l'esperienza</p>
          <div className="mt-4 space-y-3">
            {EXPERIENCES.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setExp(e.id)}
                data-active={e.id === exp}
                className="gift-option flex w-full items-baseline justify-between gap-4 border border-border bg-card px-5 py-4 text-left"
              >
                <span>
                  <span className="font-serif text-xl">{e.name}</span>
                  <span className="block text-xs text-muted-foreground">{e.note}</span>
                </span>
                <span className="font-serif text-lg">€{e.price}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Per (nome)" className="border border-border bg-card px-4 py-3 text-sm outline-none focus:border-accent" />
          <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Da (nome)" className="border border-border bg-card px-4 py-3 text-sm outline-none focus:border-accent" />
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 140))}
          rows={3}
          placeholder="Dedica (max 140 caratteri)"
          className="w-full border border-border bg-card px-4 py-3 text-sm outline-none focus:border-accent"
        />

        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-block border border-accent/60 px-6 py-3 text-[10px] uppercase tracking-[0.25em] transition-transform hover:-translate-y-0.5"
        >
          Invia il dono su WhatsApp
        </a>
      </div>

      <div className="gift-paper p-8 sm:p-10">
        <div className="relative z-10 text-center">
          <p className="font-serif text-3xl">NDP</p>
          <p className="mt-1 text-[8px] uppercase tracking-[0.4em] text-muted-foreground">Il Dono</p>
          <div className="mx-auto my-7 h-px w-16 bg-accent" />
          <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Per</p>
          <p className="font-serif text-2xl">{to || "…"}</p>
          <p className="mt-6 font-serif text-4xl leading-none">{chosen.name}</p>
          <p className="mt-3 text-sm text-muted-foreground">{chosen.note}</p>
          {note && <p className="mt-6 font-serif text-lg italic text-foreground/80">“{note}”</p>}
          <div className="mt-8 flex items-center justify-center">
            <span key={code} className="gift-seal font-serif text-xl">NDP</span>
          </div>
          <p className="mt-6 text-[10px] uppercase tracking-[0.3em]">{code}</p>
          <p className="mt-2 text-xs text-muted-foreground">Da {from || "…"} · valido 12 mesi</p>
        </div>
      </div>
    </div>
  );
}
