import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * A painted canvas, made rather than borrowed.
 *
 * The rooms this gallery walks hold more works than the scrape holds photographs for, and
 * hanging a dark plate where a painting should be reads as an empty gallery. So the gaps are
 * filled with paintings drawn on the spot — original works in four vocabularies borrowed
 * from famous modern movements, the way the sculpture court borrows its language:
 *
 *   field    — Rothko-style colour field: stacked soft-edged floats of colour
 *   grid     — Mondrian-style neoplasticism: white ground, black grid, primary blocks
 *   stripes  — Riley-style op art: stripes warped until the flat surface shimmers
 *   lyrical  — Kandinsky-style lyrical abstraction: arcs, chords and drifting circles
 *
 * Every canvas is seeded by the work's id, so a piece hangs the same painting on every
 * visit, and carries its room's accent somewhere in its palette. Under reduced motion the
 * canvas is a still painting; with motion it gets a slow sweep of light over the varnish.
 */

type Palette = {
  /** A colour in the room's family, at a hue offset, saturation and lightness. */
  at: (dh: number, s: number, l: number) => string;
  h: number;
};

type Ctx = CanvasRenderingContext2D;

function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePalette(accent: string): Palette {
  const hsl = { h: 0.12, s: 0.5, l: 0.5 };
  try {
    new THREE.Color(accent).getHSL(hsl);
  } catch {
    /* an unparsable accent still paints — it just paints warm */
  }
  return {
    h: hsl.h,
    at: (dh, s, l) =>
      `hsl(${Math.round((((hsl.h + dh) % 1) + 1 % 1) * 360)}, ${Math.round(
        Math.min(1, s) * 100,
      )}%, ${Math.round(Math.min(1, l) * 100)}%)`,
  };
}

/* --------------------------------------------------------------- the vocabularies */

function colourField(ctx: Ctx, W: number, H: number, pal: Palette, rng: () => number): void {
  ctx.fillStyle = pal.at(0.02 + rng() * 0.04, 0.3, 0.08);
  ctx.fillRect(0, 0, W, H);
  const bands = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < bands; i += 1) {
    const bh = H * (0.2 + rng() * 0.22);
    const y = H * (0.14 + (i / bands) * 0.62 + rng() * 0.04);
    ctx.filter = `blur(${Math.round(W * 0.05)}px)`;
    ctx.fillStyle = pal.at((rng() - 0.5) * 0.16, 0.45 + rng() * 0.35, 0.28 + rng() * 0.3);
    ctx.fillRect(W * 0.09, y, W * 0.82, bh);
  }
  ctx.filter = 'none';
}

function neoplasticism(ctx: Ctx, W: number, H: number, pal: Palette, rng: () => number): void {
  ctx.fillStyle = '#f3f0e8';
  ctx.fillRect(0, 0, W, H);
  const xs = [0];
  const cols = 3 + Math.floor(rng() * 3);
  for (let i = 1; i < cols; i += 1) xs.push(W * (0.16 + ((i - 1 + rng() * 0.5) / cols) * 0.84));
  xs.push(W);
  const ys = [0];
  const rows = 2 + Math.floor(rng() * 3);
  for (let i = 1; i < rows; i += 1) ys.push(H * (0.2 + ((i - 1 + rng() * 0.5) / rows) * 0.8));
  ys.push(H);
  const primaries = ['#cf3b2f', '#e6b83a', '#2f4fcf'];
  primaries[Math.floor(rng() * primaries.length)] = pal.at(0, 0.72, 0.45);
  const fills = 2 + Math.floor(rng() * 3);
  for (let c = 0; c < fills; c += 1) {
    const xi = Math.floor(rng() * (xs.length - 1));
    const yi = Math.floor(rng() * (ys.length - 1));
    ctx.fillStyle = primaries[c % primaries.length];
    ctx.fillRect(xs[xi], ys[yi], xs[xi + 1] - xs[xi], ys[yi + 1] - ys[yi]);
  }
  ctx.strokeStyle = '#141418';
  ctx.lineCap = 'square';
  for (const x of xs) {
    ctx.lineWidth = x === 0 || x === W ? 14 : 9 + rng() * 5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (const y of ys) {
    ctx.lineWidth = y === 0 || y === H ? 14 : 9 + rng() * 5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

function stripes(ctx: Ctx, W: number, H: number, _pal: Palette, rng: () => number): void {
  ctx.fillStyle = '#f1efe8';
  ctx.fillRect(0, 0, W, H);
  const count = 20 + Math.floor(rng() * 12);
  const sh = H / count;
  const freq = 2 + rng() * 3;
  const phase = rng() * Math.PI * 2;
  const amp = W * 0.07;
  ctx.fillStyle = '#141418';
  for (let i = 0; i < count; i += 1) {
    const y = i * sh;
    const k = Math.sin(Math.PI * (y / H));
    const off = Math.sin((y / H) * Math.PI * 2 * freq + phase) * amp * k;
    ctx.fillRect(off, y, W, sh * 0.6);
  }
}

function lyrical(ctx: Ctx, W: number, H: number, pal: Palette, rng: () => number): void {
  ctx.fillStyle = `hsl(${Math.round(pal.h * 360 + 28) % 360}, 16%, 88%)`;
  ctx.fillRect(0, 0, W, H);
  ctx.lineCap = 'round';
  const arcs = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < arcs; i += 1) {
    ctx.strokeStyle = pal.at((rng() - 0.5) * 0.3, 0.5 + rng() * 0.3, 0.34 + rng() * 0.28);
    ctx.lineWidth = 3 + rng() * 7;
    const a0 = rng() * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(W * (0.15 + rng() * 0.7), H * (0.15 + rng() * 0.7), W * (0.08 + rng() * 0.2), a0, a0 + Math.PI * (0.4 + rng() * 1.1));
    ctx.stroke();
  }
  const dots = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < dots; i += 1) {
    const fill = rng() > 0.45;
    ctx.fillStyle = pal.at((rng() - 0.5) * 0.5, 0.55, 0.48);
    ctx.beginPath();
    ctx.arc(W * rng(), H * rng(), W * (0.02 + rng() * 0.05), 0, Math.PI * 2);
    if (fill) ctx.fill();
    else {
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
  ctx.strokeStyle = pal.at(0.5, 0.35, 0.32);
  ctx.lineWidth = 2 + rng() * 3;
  ctx.beginPath();
  ctx.moveTo(W * (0.1 + rng() * 0.3), H * (0.1 + rng() * 0.8));
  ctx.lineTo(W * (0.6 + rng() * 0.3), H * (0.1 + rng() * 0.8));
  ctx.stroke();
}

const STYLES = [colourField, neoplasticism, stripes, lyrical];

function paint(seed: string, accent: string): HTMLCanvasElement {
  const rng = mulberry32(hashSeed(seed));
  const style = STYLES[hashSeed(`style:${seed}`) % STYLES.length];
  const W = 768;
  const H = 896;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (ctx) style(ctx, W, H, makePalette(accent), rng);
  return canvas;
}

/** The light that sweeps the varnish: a soft radial blob, tiled so it can drift across. */
let sheen: THREE.CanvasTexture | null = null;
function sheenTexture(): THREE.CanvasTexture {
  if (!sheen) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
    }
    sheen = new THREE.CanvasTexture(c);
  }
  return sheen;
}

type ArtCanvasProps = {
  /** Stable identity — the same work hangs the same painting on every visit. */
  seed: string;
  accent: string;
  width?: number;
  height?: number;
  reducedMotion?: boolean;
  position?: [number, number, number];
};

export function ArtCanvas({
  seed,
  accent,
  width = 3.05,
  height = 2.05,
  reducedMotion = false,
  position = [0, 0, 0],
}: ArtCanvasProps) {
  const sheenRef = useRef<THREE.Mesh>(null);
  const phase = useMemo(() => hashSeed(`phase:${seed}`) % 628 / 100, [seed]);

  const texture = useMemo(() => {
    const tex = new THREE.CanvasTexture(paint(seed, accent));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [seed, accent]);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const mesh = sheenRef.current;
    const mat = mesh?.material as THREE.MeshBasicMaterial | undefined;
    if (mat?.map) {
      const t = clock.getElapsedTime();
      mat.map.offset.x = 0.5 + 0.42 * Math.sin(t * 0.22 + phase);
      mat.opacity = 0.07 + 0.04 * Math.sin(t * 0.35 + phase * 1.3);
    }
  });

  const sheenMap = useMemo(() => {
    if (reducedMotion) return null;
    const tex = sheenTexture().clone();
    tex.needsUpdate = true;
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(1.6, 1);
    return tex;
  }, [reducedMotion]);

  useEffect(() => () => sheenMap?.dispose(), [sheenMap]);

  return (
    <group position={position}>
      {/* the stretcher behind the canvas, so it reads as a hung object, not a decal */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[width + 0.14, height + 0.14]} />
        <meshStandardMaterial color={0x17171b} roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {sheenMap && (
        <mesh ref={sheenRef} position={[0, 0, 0.012]}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial
            map={sheenMap}
            transparent
            opacity={0.09}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
