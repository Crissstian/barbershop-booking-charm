import { useEffect } from "react";
import type { NewReward } from "@/lib/membership-rules";

function headline(r: NewReward) {
  if (r.type === "hairspray") return { title: "Traguardo raggiunto", body: `${r.customerName} ha completato ${r.threshold} tagli.` };
  if (r.type === "gift_card_20") return { title: `30 tagli nel ${r.year}`, body: `${r.customerName} ha raggiunto l'obiettivo annuale.` };
  return { title: "Buon compleanno", body: `${r.customerName} festeggia oggi.` };
}

/** Breve celebrazione premium quando un premio Membership viene sbloccato. */
export function RewardCelebration({ rewards, onDone }: { rewards: NewReward[]; onDone: () => void }) {
  useEffect(() => { if (!rewards.length) return; const t = setTimeout(onDone, 4600); return () => clearTimeout(t); }, [rewards, onDone]);
  const r = rewards[0];
  if (!r) return null;
  const h = headline(r);
  return (
    <div role="status" className="reward-overlay fixed inset-0 z-[60] flex items-center justify-center bg-background/70 p-6 backdrop-blur-md" onClick={onDone}>
      <div className="reward-card reward-shine relative w-full max-w-sm border border-accent/60 bg-card px-8 py-10 text-center shadow-2xl">
        <p className="text-[10px] uppercase tracking-[0.4em] text-accent">NDP Membership</p>
        <p className="mt-4 font-serif text-4xl leading-tight">{h.title}</p>
        <span className="reward-line mx-auto mt-5 block h-px w-24 bg-accent" />
        <p className="mt-5 text-sm text-muted-foreground">{h.body}</p>
        <p className="mt-2 font-serif text-xl">{rewards.map((x) => x.label).join(" · ")} sbloccata</p>
      </div>
    </div>
  );
}
