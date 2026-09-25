import { useEffect, useRef, useState, type ElementType } from "react";

/** Titolo cinematografico: le parole emergono dal basso in sequenza. */
export function SplitText({ text, as: Tag = "h2", className = "", delay = 0 }: { text: string; as?: ElementType; className?: string; delay?: number }) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((entry) => { if (entry.isIntersecting) { setVisible(true); io.disconnect(); } }),
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={`split-text ${visible ? "is-visible" : ""} ${className}`}>
      {text.split(" ").map((word, i) => (
        <span key={`${word}-${i}`} className="split-word">
          <span className="split-inner" style={{ transitionDelay: `${delay + i * 90}ms` }}>{word}</span>
        </span>
      ))}
    </Tag>
  );
}
