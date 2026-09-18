import { useRef } from 'react';
import { useFrame, useThree, useLoader } from '@react-three/fiber';
import { ArtCanvas } from './ArtCanvas';
import { TextureLoader } from 'three';
import * as THREE from 'three';
import type { Exhibit } from '../../content';

/** A 1×1 transparent PNG — keeps `useLoader`'s input a string even when the exhibit
 *  carries no photograph; `undefined` there would crash the whole walk. */
const PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

type CorridorExhibitProps = {
  exhibit: Exhibit;
  index: number;
  side: number;
  z: number;
  spacing: number;
  /** The room's colour — a painted canvas carries it into its palette. */
  accent: string;
  reducedMotion: boolean;
};

/**
 * One frame on the corridor wall: a dark plate, gold edges, the artwork,
 * caption and meta plaques, and a spotlight that brightens as the visitor
 * walks past.
 */
export function CorridorExhibit({ exhibit, index, side, z, spacing, accent, reducedMotion }: CorridorExhibitProps) {
  void spacing;
  const frameRef = useRef<THREE.Group>(null);
  const spotlightRef = useRef<THREE.Mesh>(null);
  const { camera, clock } = useThree();

  const image = exhibit.images[0];
  const raw = useLoader(TextureLoader, image?.small ?? PLACEHOLDER);
  const texture = Array.isArray(raw) ? raw[0] : raw;
  if (texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
  }

  useFrame(() => {
    const frame = frameRef.current;
    const spotlight = spotlightRef.current;
    if (!frame) return;

    const camPos = camera.getWorldPosition(new THREE.Vector3());
    const dx = frame.position.x - camPos.x;
    const dz = frame.position.z - camPos.z;
    const dist = Math.hypot(dx, dz);

    const intensity = THREE.MathUtils.clamp(1 - dist / 15, 0, 1);
    const t = clock.getElapsedTime();

    if (spotlight) {
      const mat = spotlight.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.15 + intensity * 0.3 + Math.sin(t * 2) * 0.05 * intensity;
    }

    const plate = frame.getObjectByName('plate') as THREE.Mesh | undefined;
    if (plate) {
      const mat = plate.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.03 + intensity * 0.15;
    }
  });

  return (
    <group
      ref={frameRef}
      position={[side * 4.5, 2.1, z]}
      rotation={[0, side * (Math.PI / 2), 0]}
      userData={{ exhibitIndex: index }}
    >
      <mesh name="plate" castShadow receiveShadow>
        <boxGeometry args={[3.5, 2.5, 0.14]} />
        <meshStandardMaterial
          color={0x121212}
          metalness={0.72}
          roughness={0.38}
          emissive={0x221a10}
          emissiveIntensity={0.03}
        />
      </mesh>

      <lineSegments>
        <edgesGeometry>
          <boxGeometry args={[3.56, 2.56, 0.2]} />
        </edgesGeometry>
        <lineBasicMaterial color={0x111111} transparent opacity={0.72} />
      </lineSegments>

      {image ? (
        <mesh position={[0, 0, 0.1]}>
          <planeGeometry args={[3.05, 2.05]} />
          <meshBasicMaterial
            color={0xffffff}
            map={texture || undefined}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : (
        /* No photograph of this work exists — it still gets art, not a bare plate. */
        <ArtCanvas seed={exhibit.id} accent={accent} width={3.05} height={2.05} reducedMotion={reducedMotion} position={[0, 0, 0.1]} />
      )}

      <mesh name="caption" position={[0, -1.62, 0.12]}>
        <planeGeometry args={[3.3, 0.44]} />
        <meshBasicMaterial
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh name="meta" position={[0, -1.98, 0.12]}>
        <planeGeometry args={[3.3, 0.3]} />
        <meshBasicMaterial
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={spotlightRef} name="spotlight" position={[0, 0, 0.05]}>
        <planeGeometry args={[3.9, 2.9]} />
        <meshBasicMaterial
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}