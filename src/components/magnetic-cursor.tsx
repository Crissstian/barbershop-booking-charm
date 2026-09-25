import { useEffect, useRef } from "react";

/** Cursore satinato magnetico: solo desktop con puntatore fine. */
export function MagneticCursor() {
  const dot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fine = window.matchMedia("(pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduced.matches) return;

    const el = dot.current;
    if (!el) return;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let tx = x;
    let ty = y;
    let scale = 1;
    let target = 1;
    let frame = 0;

    const selector = "a,button,[data-magnetic]";
    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      const hit = (e.target as HTMLElement | null)?.closest(selector);
      target = hit ? 2.6 : 1;
      el.style.opacity = "1";
    };
    const onLeave = () => { el.style.opacity = "0"; };

    const loop = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      scale += (target - scale) * 0.12;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`;
      frame = requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    frame = requestAnimationFrame(loop);
    document.documentElement.classList.add("has-magnetic-cursor");
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.documentElement.classList.remove("has-magnetic-cursor");
    };
  }, []);

  return <div ref={dot} className="magnetic-cursor" aria-hidden="true" />;
}
