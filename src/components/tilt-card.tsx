import { useRef, type ReactNode } from "react";

/** Inclinazione 3D e riflesso satinato che segue il puntatore. */
export function Tilt({ children, className = "", intensity = 7 }: { children: ReactNode; className?: string; intensity?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  function move(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--tilt-x", `${(0.5 - py) * intensity}deg`);
    el.style.setProperty("--tilt-y", `${(px - 0.5) * intensity}deg`);
    el.style.setProperty("--sheen-x", `${px * 100}%`);
    el.style.setProperty("--sheen-y", `${py * 100}%`);
    el.style.setProperty("--sheen-o", "1");
  }

  function reset() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
    el.style.setProperty("--sheen-o", "0");
  }

  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={reset} className={`tilt-layer ${className}`}>
      {children}
      <span className="tilt-sheen" aria-hidden="true" />
    </div>
  );
}
