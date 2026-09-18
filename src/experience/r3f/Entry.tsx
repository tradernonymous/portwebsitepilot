import { useRef, useEffect } from 'react';
import { useFrame, useThree, useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';
import * as THREE from 'three';
import { entranceStages } from '../../content';

type EntryProps = {
  reducedMotion: boolean;
  onMidpoint: () => void;
  onDone: () => void;
};

const ENTRY_DURATION = 8.5;
const MIDPOINT = 0.5;

/**
 * The approach: a series of parallax photographs — the street front, then the
 * lobby — the camera travelling through them toward the doorway. At the
 * midpoint the gate opens; at the end the deck is revealed.
 */
export function Entry({ reducedMotion, onMidpoint, onDone }: EntryProps) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const planeRefs = useRef<THREE.Mesh[]>([]);
  const startedRef = useRef(false);
  const midpointFiredRef = useRef(false);
  const doneFiredRef = useRef(false);
  const timeRef = useRef(0);

  const stages = entranceStages;
  const textures = useLoader(
    TextureLoader,
    stages.map(s => s.src)
  );
  textures.forEach(t => {
    if (t) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
    }
  });

  useEffect(() => {
    if (reducedMotion) {
      onMidpoint();
      onDone();
    }
  }, [reducedMotion, onMidpoint, onDone]);

  useFrame((_state, delta) => {
    if (reducedMotion) return;
    const group = groupRef.current;
    if (!group) return;

    if (!startedRef.current) {
      startedRef.current = true;
      timeRef.current = 0;
    }

    timeRef.current += delta;
    const p = THREE.MathUtils.clamp(timeRef.current / ENTRY_DURATION, 0, 1);

    if (!midpointFiredRef.current && p >= MIDPOINT) {
      midpointFiredRef.current = true;
      onMidpoint();
    }
    if (!doneFiredRef.current && p >= 1) {
      doneFiredRef.current = true;
      onDone();
    }

    const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

    camera.position.z = 66 - eased * 66;
    camera.position.y = Math.sin(p * Math.PI * 1.6) * 0.9 * (1 - p) + 0.1;

    const layers = planeRefs.current;
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (!layer) continue;
      const depth = (i + 1) / layers.length;
      const z = -2 - depth * 30 + eased * depth * 34;
      layer.position.z = z;
      layer.position.y = 0;

      const scale = 1 + eased * depth * 0.5;
      layer.scale.set(scale, scale * 0.72, 1);

      const mat = layer.material as THREE.MeshBasicMaterial;
      const fade = Math.max(0, 1 - Math.abs(eased - depth) * 4);
      mat.opacity = fade * 0.92;
    }
  });

  return (
    <group ref={groupRef}>
      {stages.map((_, i) => {
        const texture = textures[i];
        const depth = (i + 1) / stages.length;
        return (
          <mesh
            key={i}
            ref={ref => {
              if (ref) planeRefs.current[i] = ref;
              else planeRefs.current[i] = null!;
            }}
            position={[0, 0, -2 - depth * 30]}
            rotation={[0, 0, 0]}
          >
            <planeGeometry args={[60, 42]} />
            <meshBasicMaterial
              map={texture || undefined}
              transparent
              opacity={0.92}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        );
      })}

      <mesh position={[0, 0, 0.5]}>
        <ringGeometry args={[0, 32, 64]} />
        <meshBasicMaterial
          color={0x050507}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}