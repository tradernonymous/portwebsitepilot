import { useRef, useFrame, useThree } from '@react-three/fiber';
import { useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';
import { Artwork } from './Artwork';
import * as THREE from 'three';
import type { Station } from '../../content';

const ACCENT_DIM = 0x141210;
const GOLD = 0x1a1a1a;
const GOLD_LEAF = 0x0f0f0f;

type MonolithProps = {
  station: Station;
  position: [number, number, number];
  rotationY: number;
  accent: string;
  isFocused: boolean;
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
  onClick,
}: MonolithProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const { camera, clock } = useThree();

  const cover = station.deckCover;
  const texture = useLoader(TextureLoader, cover?.small || station.heroImage?.small);
  if (texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
  }

  const hoverRef = useRef(false);

  useFrame(() => {
    const group = groupRef.current;
    const ring = ringRef.current;
    if (!group) return;

    if (hoverRef.current) {
      group.position.y = THREE.MathUtils.lerp(group.position.y, 0.38, 0.1);
    } else {
      group.position.y = THREE.MathUtils.lerp(group.position.y, 0, 0.1);
    }

    if (ring) {
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, hoverRef.current ? 0.9 : 0, 0.1);
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
      <mesh name="body" position={[0, 2.05, 0]} castShadow receiveShadow>
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
        {texture ? (
          <Artwork
            image={{
              small: cover?.small || station.heroImage?.small,
              large: cover?.large || station.heroImage?.large,
              caption: station.label,
            }}
            fit="cover"
            position={[0, 2.05, 0.23]}
          />
        ) : (
          <mesh position={[0, 2.05, 0.23]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              color={accent}
              transparent
              opacity={0.3}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        <mesh name="halo" position={[0, 2.05, 0.16]} scale={[5.7, 4.5, 1]}>
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