import { useEffect, useRef } from 'react';

/**
 * Light painting, drawn live.
 *
 * Light painters work with a long exposure and a moving torch: the photograph keeps the path
 * of the light, bright at the torch and fading behind it. This does the same on a 2D canvas.
 * A handful of "painters" move along slow, never-repeating curves (a sum of sines), and each
 * keeps a short tail of where it has been. The pointer is a painter too.
 *
 * Built to be cheap: no per-frame allocation beyond a few colour strings, a fixed number of
 * strokes per frame, device-pixel-ratio capped, and the loop stops whenever the canvas is off
 * screen or the tab is hidden. With reduced motion — or `still` — it renders one long
 * exposure and never animates at all.
 */

export const SPECTRUM = ['#3de8ff', '#8b5cff', '#ff3dcb', '#ffb13d', '#6dff9c'];

type Props = {
  /** `dark`: additive glow on black. `light`: coloured light on a white wall. */
  tone?: 'dark' | 'light';
  painters?: number;
  /** Let the pointer paint. */
  interactive?: boolean;
  palette?: string[];
  /** One frozen long exposure instead of live motion. */
  still?: boolean;
  reducedMotion?: boolean;
  /** Stroke weight multiplier. */
  weight?: number;
  /** How fast the painters travel. */
  speed?: number;
  seed?: number;
  className?: string;
};

type RGB = [number, number, number];

type Painter = {
  fx: number[];
  fy: number[];
  px: number[];
  py: number[];
  ax: number[];
  ay: number[];
  cx: number;
  cy: number;
  time: number;
  hue: number;
  hueRate: number;
  width: number;
  trail: Float32Array;
  head: number;
  count: number;
};

const TRAIL = 72;
const POINTER_LIFE = 0.85;
const POINTER_MAX = 48;

function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const n = parseInt(clean.length === 3 ? clean.replace(/./g, '$&$&') : clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mix(palette: RGB[], position: number): RGB {
  const n = palette.length;
  const p = ((position % n) + n) % n;
  const i = Math.floor(p);
  const f = p - i;
  const a = palette[i];
  const b = palette[(i + 1) % n];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

function rgba([r, g, b]: RGB, alpha: number) {
  return `rgba(${r | 0},${g | 0},${b | 0},${alpha.toFixed(3)})`;
}

/** A soft round glow, pre-rendered once per colour so the heads cost one drawImage each. */
function glowSprite([r, g, b]: RGB): HTMLCanvasElement {
  const size = 64;
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = size;
  const ctx = sprite.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, `rgba(255,255,255,1)`);
  gradient.addColorStop(0.18, `rgba(${r},${g},${b},0.9)`);
  gradient.addColorStop(0.5, `rgba(${r},${g},${b},0.22)`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return sprite;
}

export function LightPainting({
  tone = 'dark',
  painters = 5,
  interactive = false,
  palette = SPECTRUM,
  still = false,
  reducedMotion = false,
  weight = 1,
  speed = 1,
  seed = 7,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const colours = palette.map(hexToRgb);
    const sprites = colours.map(glowSprite);
    const random = mulberry32(seed);
    const frozen = still || reducedMotion;
    const dark = tone === 'dark';

    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let visible = true;
    let last = performance.now();

    const makePainter = (index: number): Painter => {
      const harmonics = 3;
      const pick = () => Array.from({ length: harmonics }, () => random());
      const fx = pick().map((v, i) => (0.08 + v * 0.22) * (i + 1) * 0.6);
      const fy = pick().map((v, i) => (0.07 + v * 0.24) * (i + 1) * 0.6);
      const amplitudes = (spread: number) =>
        pick().map((v, i) => (spread * (0.55 + v * 0.45)) / (i + 1.2));
      return {
        fx,
        fy,
        px: pick().map((v) => v * Math.PI * 2),
        py: pick().map((v) => v * Math.PI * 2),
        ax: amplitudes(0.46),
        ay: amplitudes(0.4),
        cx: 0.5 + (random() - 0.5) * 0.2,
        cy: 0.5 + (random() - 0.5) * 0.2,
        time: random() * 100,
        hue: index * (colours.length / Math.max(1, painters)),
        hueRate: 0.05 + random() * 0.08,
        width: (0.9 + random() * 1.4) * weight,
        trail: new Float32Array(TRAIL * 2),
        head: 0,
        count: 0,
      };
    };

    const crowd: Painter[] = Array.from({ length: painters }, (_, i) => makePainter(i));

    const position = (p: Painter, time: number, out: { x: number; y: number }) => {
      let x = p.cx;
      let y = p.cy;
      for (let i = 0; i < p.fx.length; i += 1) {
        x += Math.sin(time * p.fx[i] + p.px[i]) * p.ax[i];
        y += Math.cos(time * p.fy[i] + p.py[i]) * p.ay[i];
      }
      out.x = x * width;
      out.y = y * height;
    };

    const point = { x: 0, y: 0 };

    /* ------------------------------------------------------------ pointer */
    const pointer = { xs: new Float32Array(POINTER_MAX), ys: new Float32Array(POINTER_MAX), ts: new Float64Array(POINTER_MAX), head: 0, count: 0, hue: 0 };

    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      pointer.xs[pointer.head] = x;
      pointer.ys[pointer.head] = y;
      pointer.ts[pointer.head] = performance.now() / 1000;
      pointer.head = (pointer.head + 1) % POINTER_MAX;
      pointer.count = Math.min(POINTER_MAX, pointer.count + 1);
      if (!raf && visible && !frozen) schedule();
    };

    /* ------------------------------------------------------------ drawing */
    const strokeTrail = (xs: ArrayLike<number>, ys: ArrayLike<number>, n: number, hueStart: number, hueSpan: number, baseWidth: number, fade: number) => {
      if (n < 3) return;
      const chunk = 4;
      for (let start = 0; start < n - 1; start += chunk) {
        const end = Math.min(n - 1, start + chunk);
        const along = end / (n - 1);
        const alpha = Math.pow(along, 1.6) * fade;
        if (alpha < 0.01) continue;
        const colour = mix(colours, hueStart + along * hueSpan);
        ctx.beginPath();
        ctx.moveTo(xs[start], ys[start]);
        for (let i = start + 1; i <= end; i += 1) ctx.lineTo(xs[i], ys[i]);
        // wide, faint halo
        ctx.strokeStyle = rgba(colour, alpha * (dark ? 0.16 : 0.1));
        ctx.lineWidth = baseWidth * (dark ? 9 : 7) * (0.35 + along * 0.65);
        ctx.stroke();
        // bright core
        ctx.strokeStyle = dark ? rgba([255, 255, 255], alpha * 0.55) : rgba(colour, alpha * 0.9);
        ctx.lineWidth = baseWidth * (0.4 + along * 0.8);
        ctx.stroke();
        if (dark) {
          ctx.strokeStyle = rgba(colour, alpha * 0.85);
          ctx.lineWidth = baseWidth * (1.2 + along * 1.6);
          ctx.stroke();
        }
      }
    };

    const xs = new Float32Array(TRAIL);
    const ys = new Float32Array(TRAIL);

    const drawPainter = (p: Painter) => {
      const n = p.count;
      for (let i = 0; i < n; i += 1) {
        const idx = (p.head - n + i + TRAIL) % TRAIL;
        xs[i] = p.trail[idx * 2];
        ys[i] = p.trail[idx * 2 + 1];
      }
      strokeTrail(xs, ys, n, p.hue, 0.8, p.width * Math.max(1, Math.min(width, height) / 700), 1);
      if (n > 0 && dark) {
        const sprite = sprites[Math.floor(((p.hue % colours.length) + colours.length) % colours.length)];
        const r = 18 * p.width;
        ctx.globalAlpha = 0.9;
        ctx.drawImage(sprite, xs[n - 1] - r, ys[n - 1] - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      }
    };

    const pxs = new Float32Array(POINTER_MAX);
    const pys = new Float32Array(POINTER_MAX);

    const drawPointer = (now: number) => {
      let n = 0;
      for (let i = 0; i < pointer.count; i += 1) {
        const idx = (pointer.head - pointer.count + i + POINTER_MAX) % POINTER_MAX;
        if (now - pointer.ts[idx] > POINTER_LIFE) continue;
        pxs[n] = pointer.xs[idx];
        pys[n] = pointer.ys[idx];
        n += 1;
      }
      if (n < 3) return false;
      const newest = pointer.ts[(pointer.head - 1 + POINTER_MAX) % POINTER_MAX];
      const fade = 1 - Math.min(1, (now - newest) / POINTER_LIFE);
      pointer.hue += 0.02;
      strokeTrail(pxs, pys, n, pointer.hue, 2.2, 2.2 * weight, fade);
      if (dark) {
        const r = 26 * fade;
        ctx.globalAlpha = fade;
        ctx.drawImage(sprites[Math.floor(pointer.hue) % sprites.length], pxs[n - 1] - r, pys[n - 1] - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      }
      return true;
    };

    const beginFrame = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = dark ? 'lighter' : 'multiply';
      // butt caps: with additive light, round caps overlap at every segment join and the
      // stroke comes out as a string of beads
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'round';
    };

    /** The long exposure: every painter's full path, laid down in one pass. */
    const renderStill = () => {
      beginFrame();
      const steps = 220;
      for (const p of crowd) {
        const span = 26 / speed;
        const lx = new Float32Array(steps);
        const ly = new Float32Array(steps);
        for (let i = 0; i < steps; i += 1) {
          position(p, p.time + (i / steps) * span, point);
          lx[i] = point.x;
          ly[i] = point.y;
        }
        // the halo is one continuous stroke, so it has no seams to double up on
        ctx.beginPath();
        ctx.moveTo(lx[0], ly[0]);
        for (let i = 1; i < steps; i += 1) ctx.lineTo(lx[i], ly[i]);
        ctx.strokeStyle = rgba(mix(colours, p.hue + 0.7), dark ? 0.09 : 0.05);
        ctx.lineWidth = p.width * 9;
        ctx.stroke();
        // an exposure has no fading tail — the whole path is lit, brightest in its middle
        const chunk = 6;
        for (let start = 0; start < steps - 1; start += chunk) {
          const end = Math.min(steps - 1, start + chunk);
          const along = end / (steps - 1);
          const alpha = Math.sin(along * Math.PI) * 0.9 + 0.1;
          const colour = mix(colours, p.hue + along * 1.4);
          ctx.beginPath();
          ctx.moveTo(lx[start], ly[start]);
          for (let i = start + 1; i <= end; i += 1) ctx.lineTo(lx[i], ly[i]);
          ctx.strokeStyle = rgba(colour, alpha * (dark ? 0.8 : 0.55));
          ctx.lineWidth = p.width * 1.4;
          ctx.stroke();
        }
      }
    };

    const frame = (nowMs: number) => {
      raf = 0;
      const dt = Math.min(0.1, (nowMs - last) / 1000);
      last = nowMs;
      beginFrame();
      for (const p of crowd) {
        p.time += dt * 0.9 * speed;
        p.hue += dt * p.hueRate;
        position(p, p.time, point);
        p.trail[p.head * 2] = point.x;
        p.trail[p.head * 2 + 1] = point.y;
        p.head = (p.head + 1) % TRAIL;
        p.count = Math.min(TRAIL, p.count + 1);
        drawPainter(p);
      }
      if (interactive) drawPointer(nowMs / 1000);
      if (visible && !document.hidden) schedule();
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      // Cap the backing store: a 4K screen does not need four times the strokes' pixels.
      const budget = 2_000_000;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(budget / (width * height)));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      for (const p of crowd) p.count = 0;
      if (frozen) renderStill();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frozen) {
        last = performance.now();
        schedule();
      }
    });
    io.observe(canvas);

    const onVisibility = () => {
      if (!document.hidden && visible && !frozen) {
        last = performance.now();
        schedule();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    if (interactive && !frozen) window.addEventListener('pointermove', onPointer, { passive: true });

    if (!frozen) schedule();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
    };
    // palette is compared by content so an inline array literal does not restart the loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tone, painters, interactive, palette.join(','), still, reducedMotion, weight, speed, seed]);

  return <canvas ref={canvasRef} className={`light-painting${className ? ` ${className}` : ''}`} aria-hidden="true" />;
}
