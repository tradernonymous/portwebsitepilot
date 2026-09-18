import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * SCULPTURE — the sculptural languages of the last seventy years, generated.
 *
 * The same discipline as `motifs.ts`, one dimension further out. What a room wears on its
 * wall there, this is in the round: the stacked slab, the pierced monolith, the hanging
 * strand, the leaning shard, the turning ring, the balanced form. Every piece is built from
 * primitives under a seed, so no two are identical and none is a reproduction of anybody's
 * work — the vocabulary is borrowed, the object is ours.
 *
 * A form is a *language*, chosen to suit the work it carries, and the piece's placard in the
 * reader says which one it is and what that language was asking.
 */

export type SculptureForm = 'stack' | 'column' | 'ribbon' | 'veil' | 'shards' | 'orbit';

/** The vocabulary, in the order the content names it. */
export const SCULPTURE_FORMS: SculptureForm[] = [
  'stack',
  'column',
  'ribbon',
  'veil',
  'shards',
  'orbit',
];

export function isSculptureForm(value: string | undefined): value is SculptureForm {
  return !!value && (SCULPTURE_FORMS as string[]).includes(value);
}

/**
 * A stable PRNG, so a piece is the same piece every visit. An exhibit that changed shape
 * between visits would be a different work, not the same one seen again.
 */
function seeded(seed: number): () => number {
  let a = (seed * 1664525 + 1013904223) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Props = {
  form: SculptureForm;
  /** The room's own colour, so a piece belongs to where it stands. */
  accent: string;
  seed: number;
  reducedMotion: boolean;
};

/** How tall the piece stands on its plinth. The court uses this to frame it. */
export const SCULPTURE_HEIGHT = 2.5;

export function Sculpture({ form, accent, seed, reducedMotion }: Props) {
  const groupRef = useRef<THREE.Group>(null);

  /*
   * The pieces are gathered once, per seed. This is deliberately not reactive state: it is a
   * sculpture, and a sculpture does not get rebuilt when an unrelated thing re-renders.
   */
  const parts = useMemo(() => {
    const r = seeded(seed);
    const dark = 0x14141a;
    const stone = 0xdedbd2;

    switch (form) {
      /* Minimalism: the stacked slab, each one a little further out of true. */
      case 'stack': {
        const count = 4 + Math.floor(r() * 2);
        const out: { size: [number, number, number]; y: number; lean: number; tone: number }[] = [];
        let y = 0.16;
        for (let i = 0; i < count; i += 1) {
          const w = 1.5 - i * 0.22 - r() * 0.1;
          const h = 0.3 + r() * 0.18;
          out.push({ size: [w, h, w * (0.7 + r() * 0.5)], y, lean: (r() - 0.5) * 0.16, tone: i % 2 ? stone : dark });
          y += h;
        }
        return { kind: 'stack' as const, slabs: out, height: y };
      }

      /* Light-and-space: a monolith with a lit slit cut down it. */
      case 'column': {
        const width = 0.85 + r() * 0.25;
        return {
          kind: 'column' as const,
          width,
          height: 2.1 + r() * 0.5,
          slit: 0.1 + r() * 0.08,
          tilt: (r() - 0.5) * 0.1,
        };
      }

      /* Kinetic: a ribbon turning on its own axis. */
      case 'ribbon': {
        return {
          kind: 'ribbon' as const,
          turns: 2 + Math.floor(r() * 2),
          radius: 0.75 + r() * 0.2,
          tube: 0.07 + r() * 0.05,
          height: 1.7 + r() * 0.4,
        };
      }

      /* The hanging strand field: a curtain of light you can stand inside. */
      case 'veil': {
        const strands = 14 + Math.floor(r() * 6);
        const radii: number[] = [];
        const phases: number[] = [];
        for (let i = 0; i < strands; i += 1) {
          radii.push(0.5 + r() * 0.5);
          phases.push(r() * Math.PI * 2);
        }
        return { kind: 'veil' as const, strands, radii, phases, height: 1.9 + r() * 0.4 };
      }

      /* The broken form: plates leaning against each other, held by nothing. */
      case 'shards': {
        const plates = 3 + Math.floor(r() * 2);
        const out: { rot: [number, number, number]; pos: [number, number, number]; size: [number, number, number] }[] = [];
        for (let i = 0; i < plates; i += 1) {
          const angle = (i / plates) * Math.PI - Math.PI / 2 + (r() - 0.5) * 0.5;
          out.push({
            rot: [0.28 + r() * 0.3, angle, (r() - 0.5) * 0.4],
            pos: [(r() - 0.5) * 0.5, 0.7 + i * 0.12, (r() - 0.5) * 0.5],
            size: [0.9 + r() * 0.5, 1.6 + r() * 0.5, 0.07],
          });
        }
        return { kind: 'shards' as const, plates: out };
      }

      /* Op and kinetic: rings at right angles, turning at different rates. */
      case 'orbit': {
        const rings = 2 + Math.floor(r() * 2);
        const out: { radius: number; tilt: number; spin: number }[] = [];
        for (let i = 0; i < rings; i += 1) {
          out.push({
            radius: 0.6 + i * 0.24,
            tilt: (r() - 0.5) * 1.1,
            spin: (0.15 + r() * 0.2) * (i % 2 ? -1 : 1),
          });
        }
        return { kind: 'orbit' as const, rings: out, core: 0.3 + r() * 0.14 };
      }
    }
  }, [form, seed]);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group || reducedMotion) return;
    const t = clock.getElapsedTime();
    /* A slow turn on the spot, so a piece reads as an object in the round rather than a prop. */
    group.rotation.y = t * 0.07 + seed * 0.37;
  });

  const accentColor = useMemo(() => new THREE.Color(accent), [accent]);

  return (
    <group ref={groupRef}>
      {parts.kind === 'stack'
        ? parts.slabs.map((slab, i) => (
            <mesh key={i} position={[slab.lean, slab.y + slab.size[1] / 2, 0]} rotation={[0, slab.lean, slab.lean * 0.6]}>
              <boxGeometry args={slab.size} />
              <meshStandardMaterial color={slab.tone} roughness={0.42} metalness={0.22} />
            </mesh>
          ))
        : null}

      {parts.kind === 'column' ? (
        <>
          <mesh position={[0, parts.height / 2, 0]} rotation={[0, 0, parts.tilt]}>
            <boxGeometry args={[parts.width, parts.height, parts.width * 0.42]} />
            <meshStandardMaterial color={0x16161c} roughness={0.34} metalness={0.3} />
          </mesh>
          {/* the lit cut: the light-and-space language's whole argument */}
          <mesh position={[0, parts.height * 0.54, parts.width * 0.22]}>
            <boxGeometry args={[parts.slit, parts.height * 0.72, 0.02]} />
            <meshBasicMaterial color={accentColor} toneMapped={false} />
          </mesh>
          <mesh position={[0, parts.height * 0.54, -parts.width * 0.22]}>
            <boxGeometry args={[parts.slit, parts.height * 0.72, 0.02]} />
            <meshBasicMaterial color={accentColor} toneMapped={false} />
          </mesh>
        </>
      ) : null}

      {parts.kind === 'ribbon' ? (
        <mesh position={[0, parts.height / 2, 0]}>
          <torusKnotGeometry args={[parts.radius, parts.tube, 160, 12, parts.turns, 3]} />
          <meshStandardMaterial color={0xe6e2d8} roughness={0.28} metalness={0.55} />
        </mesh>
      ) : null}

      {parts.kind === 'veil'
        ? Array.from({ length: parts.strands }, (_, i) => {
            const angle = (i / parts.strands) * Math.PI * 2;
            const radius = parts.radii[i];
            return (
              <mesh
                key={i}
                position={[Math.cos(angle) * radius, parts.height / 2, Math.sin(angle) * radius]}
              >
                <cylinderGeometry args={[0.012, 0.012, parts.height, 6]} />
                <meshBasicMaterial
                  color={i % 3 === 0 ? accentColor : 0xf2eee4}
                  toneMapped={false}
                  transparent
                  opacity={0.72}
                />
              </mesh>
            );
          })
        : null}

      {parts.kind === 'shards'
        ? parts.plates.map((plate, i) => (
            <mesh key={i} position={plate.pos} rotation={plate.rot}>
              <boxGeometry args={plate.size} />
              <meshStandardMaterial color={i % 2 ? 0xd9d5cb : 0x1a1a20} roughness={0.5} metalness={0.18} />
            </mesh>
          ))
        : null}

      {parts.kind === 'orbit' ? (
        <>
          <mesh position={[0, 1.2, 0]}>
            <sphereGeometry args={[parts.core, 32, 24]} />
            <meshStandardMaterial color={0x101014} roughness={0.2} metalness={0.7} />
          </mesh>
          {parts.rings.map((ring, i) => (
            <mesh
              key={i}
              position={[0, 1.2, 0]}
              rotation={[Math.PI / 2 + ring.tilt, ring.spin * 2, 0]}
            >
              <torusGeometry args={[ring.radius, 0.022, 8, 96]} />
              <meshBasicMaterial color={i === 0 ? accentColor : 0xefeade} toneMapped={false} />
            </mesh>
          ))}
        </>
      ) : null}
    </group>
  );
}
