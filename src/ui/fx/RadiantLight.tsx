import { useEffect, useRef } from 'react';

/**
 * Radiant Light — Stephen Knapp–inspired lightpainting.
 *
 * Unlike the moving-painter approach, this renders fixed geometric light sources that
 * emit colourful beams outward — exactly how Knapp's photographs look: a white-hot knot
 * with beams of pure colour fanning across a dark wall, overlapping and blending
 * additively.
 *
 * Each "source" is a bright point that casts a fan of colour beams at angles determined
 * by a seed. The beams breathe slowly (opacity oscillation) and a subtle rotation gives
 * the sense of light shifting on a gallery wall. The pointer adds its own temporary beam.
 */

const BEAM_COLOURS = [
  '#3de8ff', // cyan
  '#8b5cff', // violet
  '#ff3dcb', // magenta
  '#ffb13d', // amber
  '#ff5a36', // coral
  '#6dff9c', // lime
  '#2f7bff', // blue
  '#ffe14d', // gold
  '#ffffff', // white
];

type Props = {
  /** Number of light sources to place. */
  sources?: number;
  /** Allow the pointer to cast a beam. */
  interactive?: boolean;
  reducedMotion?: boolean;
  /** Overall brightness multiplier. */
  weight?: number;
  /** Speed of the breathing animation. */
  speed?: number;
  seed?: number;
  className?: string;
};

type RGB = [number, number, number];

type Beam = {
  angle: number;
  length: number;
  width0: number;
  width1: number;
  colour: RGB;
  alpha: number;
};

type LightSource = {
  x: number;
  y: number;
  beams: Beam[];
  phase: number;
  breathRate: number;
  rotation: number;
};

function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const n = parseInt(clean.length === 3 ? clean.replace(/./g, '$&$&') : clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function compose(seed: number, count: number): LightSource[] {
  const random = rng(seed);
  const colours = BEAM_COLOURS.map(hexToRgb);

  return Array.from({ length: count }, (_, i) => {
    // Place sources in interesting positions — not perfectly centered
    const x = 0.15 + (i / Math.max(1, count - 1)) * 0.7 + (random() - 0.5) * 0.12;
    const y = 0.35 + (random() - 0.5) * 0.3 + (i % 2 ? -0.08 : 0.04);

    const beamCount = 12 + Math.floor(random() * 10);
    const baseAngle = random() * Math.PI * 2;

    const beams: Beam[] = Array.from({ length: beamCount }, () => {
      const spread = random() < 0.6 ? Math.PI * 1.6 : Math.PI * 2;
      return {
        angle: baseAngle + (random() - 0.5) * spread,
        length: 0.25 + random() * 0.55,
        width0: 0.0005 + random() * 0.0015,
        width1: 0.004 + random() * (random() < 0.2 ? 0.035 : 0.015),
        colour: colours[Math.floor(random() * colours.length)],
        alpha: 0.4 + random() * 0.45,
      };
    });

    return {
      x,
      y,
      beams,
      phase: random() * Math.PI * 2,
      breathRate: 0.15 + random() * 0.2,
      rotation: (random() - 0.5) * 0.003,
    };
  });
}

function paintSource(
  ctx: CanvasRenderingContext2D,
  source: LightSource,
  width: number,
  height: number,
  time: number,
  globalAlpha: number,
) {
  const cx = source.x * width;
  const cy = source.y * height;
  const scale = Math.max(width, height);
  const breathe = 0.7 + 0.3 * Math.sin(time * source.breathRate + source.phase);
  const rot = time * source.rotation;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);

  for (const beam of source.beams) {
    const len = beam.length * scale;
    const cos = Math.cos(beam.angle);
    const sin = Math.sin(beam.angle);
    const nx = -sin;
    const ny = cos;
    const w0 = beam.width0 * scale;
    const w1 = beam.width1 * scale;

    const ex = cos * len;
    const ey = sin * len;

    const [r, g, b] = beam.colour;
    const gradient = ctx.createLinearGradient(0, 0, ex, ey);
    gradient.addColorStop(0, `rgba(${r},${g},${b},${(beam.alpha * breathe * globalAlpha).toFixed(3)})`);
    gradient.addColorStop(0.5, `rgba(${r},${g},${b},${(beam.alpha * breathe * globalAlpha * 0.6).toFixed(3)})`);
    gradient.addColorStop(0.85, `rgba(${r},${g},${b},${(beam.alpha * breathe * globalAlpha * 0.15).toFixed(3)})`);
    gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(-nx * w0, -ny * w0);
    ctx.lineTo(ex - nx * w1, ey - ny * w1);
    ctx.lineTo(ex + nx * w1, ey + ny * w1);
    ctx.lineTo(nx * w0, ny * w0);
    ctx.closePath();
    ctx.fill();
  }

  // White-hot knot at the source
  const knotRadius = scale * 0.012 * breathe;
  const knot = ctx.createRadialGradient(0, 0, 0, 0, 0, knotRadius * 3);
  knot.addColorStop(0, `rgba(255,255,255,${(0.95 * globalAlpha).toFixed(3)})`);
  knot.addColorStop(0.2, `rgba(255,255,255,${(0.6 * globalAlpha).toFixed(3)})`);
  knot.addColorStop(0.5, `rgba(200,210,255,${(0.25 * globalAlpha).toFixed(3)})`);
  knot.addColorStop(1, 'rgba(200,210,255,0)');
  ctx.fillStyle = knot;
  ctx.beginPath();
  ctx.arc(0, 0, knotRadius * 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function RadiantLight({
  sources = 4,
  interactive = true,
  reducedMotion = false,
  weight = 1,
  speed = 1,
  seed = 42,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let lightSources = compose(seed, sources);
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let visible = true;
    let start = performance.now();

    // Pointer beam state
    const pointerBeam = { x: 0, y: 0, active: false, fade: 0 };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const budget = 2_000_000;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(budget / (width * height)));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };

    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      pointerBeam.x = x;
      pointerBeam.y = y;
      pointerBeam.active = true;
      pointerBeam.fade = 1;
      if (!raf && visible) schedule();
    };

    const frame = (nowMs: number) => {
      raf = 0;
      const time = ((nowMs - start) / 1000) * speed;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      // Draw all sources
      for (const source of lightSources) {
        paintSource(ctx, source, width, height, time, weight);
      }

      // Pointer beam
      if (interactive && pointerBeam.active && pointerBeam.fade > 0.01) {
        pointerBeam.fade *= 0.96;
        if (pointerBeam.fade < 0.01) pointerBeam.active = false;
        const tempSource: LightSource = {
          x: pointerBeam.x / width,
          y: pointerBeam.y / height,
          beams: Array.from({ length: 6 }, (_, i) => ({
            angle: (i / 6) * Math.PI * 2 + time * 0.3,
            length: 0.15 + Math.sin(time * 0.5 + i) * 0.05,
            width0: 0.0003,
            width1: 0.008,
            colour: hexToRgb(BEAM_COLOURS[i % BEAM_COLOURS.length]),
            alpha: 0.5,
          })),
          phase: time,
          breathRate: 0.5,
          rotation: 0,
        };
        paintSource(ctx, tempSource, width, height, time, pointerBeam.fade * weight);
      }

      if (visible && !document.hidden) schedule();
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        start = performance.now();
        schedule();
      }
    });
    io.observe(canvas);

    const onVisibility = () => {
      if (!document.hidden && visible) {
        start = performance.now();
        schedule();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    if (interactive && !reducedMotion) {
      window.addEventListener('pointermove', onPointer, { passive: true });
    }

    if (!reducedMotion) schedule();
    else {
      // Frozen: render one frame
      resize();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      for (const source of lightSources) {
        paintSource(ctx, source, width, height, 2.5, weight);
      }
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
    };
  }, [sources, interactive, reducedMotion, weight, speed, seed]);

  return (
    <canvas
      ref={canvasRef}
      className={`radiant-light${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    />
  );
}
