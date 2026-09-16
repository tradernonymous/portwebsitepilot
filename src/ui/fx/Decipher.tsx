import { useEffect, useState } from 'react';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>[]#*+=';

/**
 * Text that resolves out of noise, one character at a time — the way a HUD reads a label
 * in. Characters settle left to right; spaces never scramble, so the word shapes are
 * visible from the first frame and nothing jumps in width for proportional fonts.
 */
export function Decipher({
  text,
  duration = 700,
  delay = 0,
  reducedMotion = false,
  className,
}: {
  text: string;
  duration?: number;
  delay?: number;
  reducedMotion?: boolean;
  className?: string;
}) {
  const [shown, setShown] = useState(reducedMotion ? text : scramble(text, 0));

  useEffect(() => {
    if (reducedMotion) {
      setShown(text);
      return;
    }
    let raf = 0;
    let lastPaint = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / duration));
      // ~30 updates a second is plenty for a flicker and halves the React work
      if (now - lastPaint > 33 || p === 1) {
        lastPaint = now;
        setShown(p >= 1 ? text : scramble(text, p));
      }
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, duration, delay, reducedMotion]);

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden="true">{shown}</span>
    </span>
  );
}

function scramble(text: string, progress: number): string {
  const settled = Math.floor(text.length * progress);
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (i < settled || ch === ' ' || ch === '·' || ch === '/') out += ch;
    else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
  }
  return out;
}
