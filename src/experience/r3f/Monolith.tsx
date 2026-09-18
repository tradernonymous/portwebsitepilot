import { useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';
import { Artwork } from './Artwork';
import { ArtCanvas } from './ArtCanvas';
import * as THREE from 'three';
import type { Station } from '../../content';

const ACCENT_DIM = 0x141210;
const GOLD = 0x1a1a1a;
const GOLD_LEAF = 0x0f0f0f;

/** A 1×1 transparent PNG — keeps `useLoader`'s input a string even when no cover exists. */
const PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

type MonolithProps = {
  station: Station;
  position: [number, number, number];
  rotationY: number;
  accent: string;
  isFocused: boolean;
  reducedMotion: boolean;
  onClick: () => void;
};

/**
 * One station's monolith on the deck: a dark plate, gold edges, a pedestal,
 * a ring that lights when hovered, and the work hung on its face.
 */
export function Monolith({
  station,
  position,
  rotationY,
  accent,
  isFocused,
  reducedMotion,
  onClick,
}: MonolithProps) {
  void isFocused;
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  /* Each monolith breathes on its own clock, so the ring sways as a whole, not in lockstep. */
  const phase = useMemo(() => {
    let h = 0;
    for (let i = 0; i < station.id.length; i += 1) h = (h * 31 + station.id.charCodeAt(i)) % 628;
    return h / 100;
  }, [station.id]);

  const cover = station.deckCover;
  const coverUrl = cover?.small || station.heroImage?.small;
  const hasCover = Boolean(coverUrl);

  const texture = useLoader(TextureLoader, coverUrl ?? PLACEHOLDER);
  const tex = Array.isArray(texture) ? texture[0] : texture;
  if (tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
  }

  const hoverRef = useRef(false);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    const ring = ringRef.current;
    const halo = haloRef.current;
    const body = bodyRef.current;
    if (!group) return;
    const t = clock.getElapsedTime();

    /*
     * The deck breathes: each monolith bobs a few millimetres on its own phase, and leaning
     * in lifts it the rest of the way. Damped either way, so focus changes glide.
     */
    const bob = reducedMotion ? 0 : 0.05 + 0.04 * Math.sin(t * 0.5 + phase);
    const targetY = hoverRef.current ? 0.38 : bob;
    group.position.y = THREE.MathUtils.lerp(group.position.y, targetY, 0.1);

    if (ring) {
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, hoverRef.current ? 0.9 : 0, 0.1);
    }

    /* Hover answers with light, not just height: the halo and the plate glow brighter. */
    if (halo) {
      const mat = halo.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, hoverRef.current ? 0.34 : 0.15, 0.1);
    }
    if (body) {
      const mat = body.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, hoverRef.current ? 0.09 : 0.03, 0.1);
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[0, rotationY, 0]}
      onPointerOver={() => { hoverRef.current = true; }}
      onPointerOut={() => { hoverRef.current = false; }}
      onClick={onClick}
    >
      <mesh ref={bodyRef} name="body" position={[0, 2.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.9, 3.65, 0.26]} />
        <meshStandardMaterial
          color={ACCENT_DIM}
          emissive={GOLD}
          emissiveIntensity={0.03}
          roughness={0.52}
          metalness={0.55}
        />
      </mesh>

      <lineSegments name="edges" position={[0, 2.05, 0]}>
        <edgesGeometry>
          <boxGeometry args={[4.9, 3.65, 0.26]} />
        </edgesGeometry>
        <lineBasicMaterial color={GOLD_LEAF} transparent opacity={0.42} />
      </lineSegments>

      <mesh name="pedestal" position={[0, 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.35, 0.24, 1.2]} />
        <meshStandardMaterial color={0x121110} metalness={0.9} roughness={0.3} />
      </mesh>

      <mesh ref={ringRef} name="ring" position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 1.6, 40]} />
        <meshBasicMaterial
          color={GOLD}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <group name="mount" rotation={[0, Math.PI, 0]}>
        {hasCover && tex ? (
          <Artwork
            image={{
              small: cover?.small || station.heroImage?.small!,
              large: cover?.large || station.heroImage?.large!,
              caption: station.label,
            }}
            fit="cover"
            position={[0, 2.05, 0.23]}
          />
        ) : (
          /* No cover photograph — the monolith still carries art, not a tinted plane. */
          <ArtCanvas seed={`deck:${station.id}`} accent={accent} width={3.4} height={2.3} position={[0, 2.05, 0.23]} />
        )}

        <mesh ref={haloRef} name="halo" position={[0, 2.05, 0.16]} scale={[5.7, 4.5, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            color={GOLD}
            transparent
            opacity={0.15}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}