import { useEffect, useRef, type CSSProperties } from 'react';

/**
 * Prism light — PORT's own composition.
 *
 * Light thrown through cut glass onto a gallery wall breaks into long translucent shards of
 * pure colour that cross and burn brighter where they overlap. Every seed gives a fresh
 * arrangement: a few prisms (bright white knots) each cast a fan of shards, blended
 * additively, with a dim mirrored copy lying on the floor.
 *
 * Performance is the design constraint. Each prism's fan is painted exactly once, into its
 * own canvas, at load and on resize. What moves is those canvases — each one slowly reaching
 * out from its prism and drawing back, breathing in brightness — which is pure transform and
 * opacity work the compositor does without repainting a single shard.
 */

const COLOURS = ['#3de8ff', '#2f7bff', '#8b5cff', '#ff3dcb', '#ff5a36', '#ffb13d', '#ffe14d', '#6dff9c', '#ffffff'];

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

type Shard = { angle: number; length: number; w0: number; w1: number; colour: string; alpha: number };
type Fan = { x: number; y: number; shards: Shard[] };

/** Positions are fractions of the wall, so the composition holds its shape at any size. */
function compose(seed: number): Fan[] {
  const random = rng(seed);
  const count = 3;
  return Array.from({ length: count }, (_, p) => {
    const x = 0.2 + (p / (count - 1)) * 0.6 + (random() - 0.5) * 0.08;
    const y = 0.4 + (random() - 0.5) * 0.16 + (p === 1 ? -0.08 : 0.04);
    // the outer fans lean inwards, so the light piles up in the middle of the wall
    const lean = p === 0 ? 0.3 : p === count - 1 ? Math.PI - 0.3 : Math.PI / 2 + (random() - 0.5) * 0.6;
    const shards = Array.from({ length: 14 + Math.floor(random() * 7) }, () => {
      const spread = random() < 0.72 ? 1.2 : Math.PI;
      return {
        angle: lean + (random() - 0.5) * spread * 2,
        length: 0.18 + random() * 0.45,
        w0: 0.0008 + random() * 0.002,
        w1: 0.003 + random() * (random() < 0.25 ? 0.028 : 0.012),
        colour: COLOURS[Math.floor(random() * COLOURS.length)],
        alpha: 0.35 + random() * 0.45,
      };
    });
    return { x, y, shards };
  });
}

function paintFan(canvas: HTMLCanvasElement, fan: Fan, reflection: boolean) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(1_800_000 / (width * height)));
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'lighter';

  const floor = height * 0.8;
  const scale = width;
  const cx = fan.x * width;
  const cy = fan.y * height * 0.8;

  const draw = (mirror: boolean) => {
    for (const s of fan.shards) {
      const len = s.length * scale;
      const cos = Math.cos(s.angle);
      const sin = Math.sin(s.angle);
      const px = -sin;
      const py = cos;
      const w0 = s.w0 * scale;
      const w1 = s.w1 * scale;
      const ex = cx + cos * len;
      const ey = cy + sin * len;
      const pts: [number, number][] = [
        [cx + px * w0, cy + py * w0],
        [ex + px * w1, ey + py * w1],
        [ex - px * w1, ey - py * w1],
        [cx - px * w0, cy - py * w0],
      ];
      const gradient = ctx.createLinearGradient(cx, cy, ex, ey);
      gradient.addColorStop(0, s.colour);
      gradient.addColorStop(0.75, s.colour);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = s.alpha * (mirror ? 0.16 : 1);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      for (const [i, [x, y]] of pts.entries()) {
        const yy = mirror ? floor + (floor - y) : y;
        if (i === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.closePath();
      ctx.fill();
    }
  };

  if (reflection) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, floor, width, height - floor);
    ctx.clip();
    draw(true);
    ctx.restore();
  }
  ctx.save();
  if (reflection) {
    ctx.beginPath();
    ctx.rect(0, 0, width, floor);
    ctx.clip();
  }
  draw(false);
  ctx.restore();

  // the prism itself: a white-hot knot
  ctx.globalAlpha = 1;
  const knot = ctx.createRadialGradient(cx, cy, 0, cx, cy, width * 0.03);
  knot.addColorStop(0, 'rgba(255,255,255,1)');
  knot.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  knot.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = knot;
  ctx.beginPath();
  ctx.arc(cx, cy, width * 0.03, 0, Math.PI * 2);
  ctx.fill();
}

export function PrismShards({
  seed = 11,
  className,
  style,
  reflection = true,
}: {
  seed?: number;
  className?: string;
  style?: CSSProperties;
  reflection?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const fans = useRef(compose(seed));

  useEffect(() => {
    fans.current = compose(seed);
    const el = root.current;
    if (!el) return;
    const canvases = Array.from(el.querySelectorAll('canvas'));
    const paint = () => canvases.forEach((canvas, i) => paintFan(canvas, fans.current[i], reflection));
    paint();
    let timer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(paint, 120);
    });
    ro.observe(el);
    // off screen, the fans hold still
    const io = new IntersectionObserver(([entry]) => el.classList.toggle('is-idle', !entry.isIntersecting));
    io.observe(el);
    return () => {
      io.disconnect();
      ro.disconnect();
      window.clearTimeout(timer);
    };
  }, [seed, reflection]);

  return (
    <div ref={root} className={`prism${className ? ` ${className}` : ''}`} style={style} aria-hidden="true">
      {fans.current.map((fan, i) => (
        <canvas
          key={i}
          className="prism-fan"
          style={{
            transformOrigin: `${fan.x * 100}% ${fan.y * 80}%`,
            animationDelay: `${-i * 2.7}s`,
            animationDuration: `${9 + i * 2.3}s`,
          }}
        />
      ))}
    </div>
  );
}
