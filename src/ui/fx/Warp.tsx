import { useEffect, useRef } from 'react';
import { SPECTRUM } from './LightPainting';

/**
 * Stepping through the door: streaks of coloured light rush past from a vanishing point,
 * then the view washes to white — the gallery's own colour — and hands over.
 *
 * Canvas 2D, one short burst (~1.1s), and it removes itself. With reduced motion it is a
 * plain quick fade.
 */
export function Warp({
  onMidpoint,
  onDone,
  reducedMotion = false,
  duration = 1150,
}: {
  /** Called when the screen is fully covered — the moment to swap what is underneath. */
  onMidpoint: () => void;
  onDone: () => void;
  reducedMotion?: boolean;
  duration?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const wash = useRef<HTMLDivElement>(null);
  const midpoint = useRef(onMidpoint);
  const done = useRef(onDone);
  midpoint.current = onMidpoint;
  done.current = onDone;

  useEffect(() => {
    if (reducedMotion) {
      const a = window.setTimeout(() => midpoint.current(), 180);
      const b = window.setTimeout(() => done.current(), 420);
      return () => {
        window.clearTimeout(a);
        window.clearTimeout(b);
      };
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      midpoint.current();
      done.current();
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = 180;
    const stars = Array.from({ length: count }, (_, i) => ({
      angle: Math.random() * Math.PI * 2,
      dist: Math.random() * 0.4 + 0.02,
      speed: 0.6 + Math.random() * 1.6,
      colour: SPECTRUM[i % SPECTRUM.length],
      width: 0.6 + Math.random() * 1.8,
    }));

    const cx = w / 2;
    const cy = h / 2;
    const reach = Math.hypot(w, h) / 2;
    const start = performance.now();
    let raf = 0;
    let swapped = false;

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      // fade the previous frame rather than clearing it, so streaks smear like an exposure
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(5,5,8,${0.35 - p * 0.2})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      const accel = p * p * 3.2;
      for (const s of stars) {
        const d0 = s.dist + accel * s.speed * 0.18;
        const d1 = d0 + 0.02 + accel * s.speed * 0.12;
        const x0 = cx + Math.cos(s.angle) * d0 * reach;
        const y0 = cy + Math.sin(s.angle) * d0 * reach;
        const x1 = cx + Math.cos(s.angle) * d1 * reach;
        const y1 = cy + Math.sin(s.angle) * d1 * reach;
        ctx.strokeStyle = s.colour;
        ctx.globalAlpha = Math.min(1, 0.25 + p);
        ctx.lineWidth = s.width * (1 + accel);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      if (wash.current) {
        const white = Math.max(0, (p - 0.62) / 0.28);
        wash.current.style.opacity = String(Math.min(1, white));
      }
      if (!swapped && p >= 0.9) {
        swapped = true;
        midpoint.current();
      }
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        // the new view is already underneath: dissolve the wash into it, then leave
        root.current?.classList.add('is-leaving');
        leave = window.setTimeout(() => done.current(), 560);
      }
    };
    let leave = 0;
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(leave);
    };
  }, [reducedMotion, duration]);

  return (
    <div ref={root} className={`warp${reducedMotion ? ' is-reduced' : ''}`} aria-hidden="true">
      {reducedMotion ? null : <canvas ref={canvasRef} />}
      <div className="warp-wash" ref={wash} />
    </div>
  );
}
