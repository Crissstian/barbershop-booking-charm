import { useRef, useState } from "react";
import { SALON } from "@/lib/salon";

const TIERS = [
  { name: "Ospite", visits: 0 },
  { name: "Signature", visits: 3 },
  { name: "Maison", visits: 8 },
];

export function MemberPass() {
  const [name, setName] = useState("");
  const [visits, setVisits] = useState(3);
  const ref = useRef<HTMLDivElement>(null);

  const tier = [...TIERS].reverse().find((t) => visits >= t.visits) ?? { name: "Ospite", visits: 0 };
  const displayName = name.trim() || "Il tuo nome";
  const code = `NDP · ${(displayName.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase() || "MEMB")}-${String(1000 + visits * 137).slice(0, 4)}`;

  function move(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--py", `${x * 14}deg`);
    el.style.setProperty("--px", `${-y * 12}deg`);
    el.style.setProperty("--shine", `${x * 120}`);
  }

  function reset() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--py", "0deg");
    el.style.setProperty("--px", "0deg");
    el.style.setProperty("--shine", "0");
  }

  return (
    <div className="grid gap-12 md:grid-cols-[1.1fr_.9fr] md:items-center">
      <div className="pass-stage">
        <div ref={ref} onPointerMove={move} onPointerLeave={reset} className="pass-card p-6 sm:p-8">
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="pass-mono font-serif text-3xl sm:text-4xl">NDP</p>
                <p className="mt-1 text-[8px] uppercase tracking-[0.4em] text-muted-foreground">Esclusive Hair Saloon</p>
              </div>
              <div className="pass-chip" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[8px] uppercase tracking-[0.35em] text-muted-foreground">Membro</p>
              <p className="mt-1 font-serif text-2xl leading-none sm:text-3xl">{displayName}</p>
              <div className="mt-5 flex items-end justify-between gap-6">
                <div>
                  <p className="text-[8px] uppercase tracking-[0.3em] text-muted-foreground">Livello</p>
                  <p className="mt-1 font-serif text-xl">{tier.name}</p>
                </div>
                <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">{code}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Nome sulla tessera</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome e cognome"
          className="mt-3 w-full border border-border bg-card px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
        />

        <p className="mt-8 text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Rituali completati</p>
        <div className="mt-3 flex items-center gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1} rituali`}
              onClick={() => setVisits(i + 1)}
              className="tier-dot"
              data-filled={i < visits}
            />
          ))}
        </div>

        <ul className="mt-8 space-y-3 border-t border-border pt-6 text-sm text-muted-foreground">
          <li>Signature (3 rituali) · prenotazione prioritaria sugli orari serali.</li>
          <li>Maison (8 rituali) · rituale barba in omaggio e accesso alle serate su invito.</li>
        </ul>

        <a
          href={`https://wa.me/${SALON.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Ciao NDP, vorrei attivare la mia tessera membro a nome ${displayName}.`)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-block border border-accent/60 px-6 py-3 text-[10px] uppercase tracking-[0.25em] transition-transform hover:-translate-y-0.5"
        >
          Attiva la tessera
        </a>
      </div>
    </div>
  );
}
