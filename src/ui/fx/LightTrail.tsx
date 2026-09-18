import { useEffect, useRef } from 'react';
import { onDoorway } from '../../lib/doorway';
import { onFrame } from '../../lib/frame';
import { getScrollState } from '../../lib/scroll';

/**
 * The light that moves with the visitor.
 *
 * Two things happen in this gallery that are physical and were invisible: passing through a
 * door, and travelling. A long-exposure photograph keeps both — dust lit by the torch, the
 * smear of everything that moved while the shutter was open. This draws the same thing.
 *
 *   doorway   When the doors shut, a stream of light crosses the screen through the gap and
 *             carries on into the room behind them. It is the one moment the whole page agrees
 *             the visitor is going somewhere, so the light goes with them.
 *   travel    While the page is moving, a thin drift of motes slides the other way, as if the
 *             air were being pushed past. It answers to the engine's own `--vigour`, read
 *             directly, so it is heaviest on a hard scroll and gone at rest.
 *
 * It costs nothing when the gallery is still: the frame subscription only exists while there
 * are particles alive. Reduced motion never starts it at all.
 */

const MAX = 110;
/** Speed the travel drift saturates at, in motes per second. */
const DRIFT = 26;
const COLOURS = ['#3de8ff', '#8b5cff', '#ff3dcb', '#ffb13d', '#ffffff'];

type Mote = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  span: number;
  size: number;
  colour: string;
};

export function LightTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof window.matchMedia !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let stopFrames: (() => void) | null = null;
    /** Where the last drift mote was laid, so the drift is a rate rather than a per-frame count. */
    let driftDebt = 0;

    const pool: Mote[] = [];
    let head = 0;

    const take = (): Mote => {
      if (pool.length < MAX) {
        pool.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, span: 1, size: 1, colour: COLOURS[0] });
        return pool[pool.length - 1];
      }
      head = (head + 1) % MAX;
      return pool[head];
    };

    /** This canvas is above the doors, so a burst is seen through the gap as they part. */
    const burst = () => {
      const count = Math.round(Math.min(64, width / 16));
      for (let i = 0; i < count; i += 1) {
        const mote = take();
        const fromLeft = i % 2 === 0;
        mote.x = fromLeft ? -20 : width + 20;
        mote.y = height * (0.12 + Math.random() * 0.76);
        const speed = 620 + Math.random() * 900;
        mote.vx = (fromLeft ? 1 : -1) * speed;
        mote.vy = (Math.random() - 0.5) * 60;
        mote.span = 1.4 + Math.random() * 1.6;
        mote.life = mote.span;
        mote.size = 1 + Math.random() * 2.6;
        mote.colour = COLOURS[(Math.random() * COLOURS.length) | 0];
      }
    };

    const drift = (dt: number) => {
      const speed = getScrollState().speed;
      if (speed <= 0.02) return;
      driftDebt += dt * DRIFT * speed;
      while (driftDebt >= 1) {
        driftDebt -= 1;
        const mote = take();
        mote.x = Math.random() * width;
        mote.y = -10;
        mote.vx = (Math.random() - 0.5) * 20;
        mote.vy = 120 + Math.random() * 220;
        mote.span = 0.8 + Math.random() * 0.9;
        mote.life = mote.span;
        mote.size = 0.7 + Math.random() * 1.2;
        mote.colour = COLOURS[(Math.random() * 3) | 0];
      }
    };

    const frame = (_now: number, dt: number) => {
      drift(dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';

      let alive = 0;
      for (const mote of pool) {
        if (mote.life <= 0) continue;
        mote.life -= dt;
        if (mote.life <= 0) continue;
        alive += 1;
        mote.x += mote.vx * dt;
        mote.y += mote.vy * dt;
        const t = mote.life / mote.span;
        /* the streak behind a mote is the long exposure of it */
        const tail = 0.02 + Math.min(0.1, Math.abs(mote.vx) / 9000);
        ctx.strokeStyle = mote.colour;
        ctx.globalAlpha = Math.min(1, t * 0.75);
        ctx.lineWidth = mote.size;
        ctx.beginPath();
        ctx.moveTo(mote.x, mote.y);
        ctx.lineTo(mote.x - mote.vx * tail, mote.y - mote.vy * tail);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      if (!alive) {
        ctx.clearRect(0, 0, width, height);
        stopFrames?.();
        stopFrames = null;
      }
    };

    const start = () => {
      if (!stopFrames) stopFrames = onFrame(frame);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const budget = 1_600_000;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(budget / (width * height)));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const unwatch = onDoorway((phase) => {
      if (phase !== 'closing') return;
      burst();
      start();
    });
    /* the drift needs the clock whenever the page moves, and the loop retires itself */
    const onScrollSignal = () => start();
    window.addEventListener('scroll', onScrollSignal, { passive: true });
    window.addEventListener('wheel', onScrollSignal, { passive: true });

    return () => {
      stopFrames?.();
      unwatch();
      observer.disconnect();
      window.removeEventListener('scroll', onScrollSignal);
      window.removeEventListener('wheel', onScrollSignal);
    };
  }, []);

  return <canvas ref={canvasRef} className="light-trail" aria-hidden="true" />;
}
