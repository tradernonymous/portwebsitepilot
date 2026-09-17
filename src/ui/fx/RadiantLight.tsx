import { useEffect, useRef } from 'react';
import { onFrame } from '../../lib/frame';
import { getScrollState } from '../../lib/scroll';

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
 *
 * The beams also open up when the visitor moves: scrolling hard stretches and brightens
 * them, and they settle back as the page comes to rest.
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
  /**
   * Scroll progress 0-1. Beams shift colour, spread, and intensity as the visitor
   * scrolls deeper into the gallery. 0 = entrance (cool, narrow), 1 = core (warm, wide).
   */
  scrollProgress?: number;
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

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Map scroll progress to visual modifiers. */
type Modifiers = {
  /** Beam length multiplier. */
  lengthMul: number;
  /** Beam width multiplier. */
  widthMul: number;
  /** Alpha multiplier. */
  alphaMul: number;
  /** Hue rotation in degrees. */
  hueShift: number;
};

/** The resting look, for a frozen panel — shared so nothing allocates per frame. */
const NEUTRAL: Modifiers = { lengthMul: 1, widthMul: 1, alphaMul: 1, hueShift: 0 };

/**
 * Map where the visitor is, and how fast they are moving, onto the light.
 *
 * Position sets the palette: cool and narrow at the entrance (0-0.3), spreading through the
 * middle (0.3-0.7), full warmth and spread at the core (0.7-1). Speed then opens the beams
 * further on top of that, so a hard scroll flares the light and stopping lets it settle.
 */
function scrollModifiers(progress: number, speed: number, out: Modifiers) {
  const p = Math.max(0, Math.min(1, progress));
  const entry = p < 0.3;
  const middle = p < 0.7;
  const t = entry ? p / 0.3 : middle ? (p - 0.3) / 0.4 : (p - 0.7) / 0.3;

  out.lengthMul = (entry ? lerp(0.7, 0.9, t) : middle ? lerp(0.9, 1.1, t) : lerp(1.1, 1.2, t)) * (1 + speed * 0.3);
  out.widthMul = entry ? lerp(0.6, 0.85, t) : middle ? lerp(0.85, 1.15, t) : lerp(1.15, 1.4, t);
  out.alphaMul =
    (entry ? lerp(0.6, 0.85, t) : middle ? lerp(0.85, 1.1, t) : lerp(1.1, 1.35, t)) * (1 + speed * 0.45);
  out.hueShift = p * 25;
}

/** The pointer's own beam, allocated once and rewritten each frame. */
function pointerSource(): LightSource {
  return {
    x: 0,
    y: 0,
    beams: Array.from({ length: 6 }, (_, i) => ({
      angle: 0,
      length: 0.15,
      width0: 0.0003,
      width1: 0.008,
      colour: hexToRgb(BEAM_COLOURS[i % BEAM_COLOURS.length]),
      alpha: 0.5,
    })),
    phase: 0,
    breathRate: 0.5,
    rotation: 0,
  };
}

function paintSource(
  ctx: CanvasRenderingContext2D,
  source: LightSource,
  width: number,
  height: number,
  time: number,
  globalAlpha: number,
  mods: Modifiers = NEUTRAL,
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
    const len = beam.length * scale * mods.lengthMul;
    const cos = Math.cos(beam.angle);
    const sin = Math.sin(beam.angle);
    const nx = -sin;
    const ny = cos;
    const w0 = beam.width0 * scale * mods.widthMul;
    const w1 = beam.width1 * scale * mods.widthMul;

    const ex = cos * len;
    const ey = sin * len;

    const [r, g, b] = beam.colour;
    const a = beam.alpha * breathe * globalAlpha * mods.alphaMul;
    const gradient = ctx.createLinearGradient(0, 0, ex, ey);
    gradient.addColorStop(0, `rgba(${r},${g},${b},${Math.min(1, a).toFixed(3)})`);
    gradient.addColorStop(0.5, `rgba(${r},${g},${b},${Math.min(1, a * 0.6).toFixed(3)})`);
    gradient.addColorStop(0.85, `rgba(${r},${g},${b},${Math.min(1, a * 0.15).toFixed(3)})`);
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

  // White-hot knot at the source — grows brighter and warmer with scroll
  const knotRadius = scale * 0.012 * breathe * mods.widthMul;
  const knotAlpha = Math.min(1, 0.95 * mods.alphaMul);
  const knot = ctx.createRadialGradient(0, 0, 0, 0, 0, knotRadius * 3);
  knot.addColorStop(0, `rgba(255,255,255,${knotAlpha.toFixed(3)})`);
  knot.addColorStop(0.2, `rgba(255,255,255,${(knotAlpha * 0.63).toFixed(3)})`);
  knot.addColorStop(0.5, `rgba(200,210,255,${(knotAlpha * 0.26).toFixed(3)})`);
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
  scrollProgress = 0,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Smoothed scroll progress — lerps toward the target each frame
  const smoothProgress = useRef(0);
  // Keep the latest scrollProgress in a ref so the effect doesn't re-run on every scroll
  const scrollTarget = useRef(scrollProgress);
  scrollTarget.current = scrollProgress;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const lightSources = compose(seed, sources);
    let width = 0;
    let height = 0;
    let dpr = 1;
    let stopFrames: (() => void) | null = null;

    // Pointer beam state
    const pointerBeam = { x: 0, y: 0, active: false, fade: 0 };
    const pointer = pointerSource();
    /* One modifiers object, rewritten every frame — never reallocated. */
    const mods: Modifiers = { lengthMul: 1, widthMul: 1, alphaMul: 1, hueShift: 0 };

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
    };

    const frame = (_nowMs: number, _dt: number, elapsed: number) => {
      const time = elapsed * speed;

      // Smooth the scroll progress toward the target (lerp 8% per frame)
      smoothProgress.current += (scrollTarget.current - smoothProgress.current) * 0.08;
      scrollModifiers(smoothProgress.current, getScrollState().speed, mods);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      // Draw all sources with scroll-driven modifiers
      for (const source of lightSources) {
        paintSource(ctx, source, width, height, time, weight, mods);
      }

      // Pointer beam
      if (interactive && pointerBeam.active && pointerBeam.fade > 0.01) {
        pointerBeam.fade *= 0.96;
        if (pointerBeam.fade < 0.01) pointerBeam.active = false;
        pointer.x = pointerBeam.x / width;
        pointer.y = pointerBeam.y / height;
        pointer.phase = time;
        for (let i = 0; i < pointer.beams.length; i += 1) {
          const beam = pointer.beams[i];
          beam.angle = (i / pointer.beams.length) * Math.PI * 2 + time * 0.3;
          beam.length = 0.15 + Math.sin(time * 0.5 + i) * 0.05;
        }
        paintSource(ctx, pointer, width, height, time, pointerBeam.fade * weight, mods);
      }
    };

    /* One long exposure, for a visitor who has asked for no motion. */
    const drawStill = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      for (const source of lightSources) paintSource(ctx, source, width, height, 2.5, weight);
    };

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (reducedMotion) drawStill();
    });
    ro.observe(canvas);

    let io: IntersectionObserver | null = null;
    if (reducedMotion) {
      drawStill();
    } else {
      /* Subscribe only while the canvas is on screen. */
      io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          if (!stopFrames) stopFrames = onFrame(frame);
        } else if (stopFrames) {
          stopFrames();
          stopFrames = null;
        }
      });
      io.observe(canvas);
    }

    if (interactive && !reducedMotion) {
      window.addEventListener('pointermove', onPointer, { passive: true });
    }

    return () => {
      stopFrames?.();
      ro.disconnect();
      io?.disconnect();
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
