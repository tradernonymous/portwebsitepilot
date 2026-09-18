import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGalleryStore } from './galleryStore';
import { DUST_FOR } from './quality';

/**
 * Dust in the light.
 *
 * Every real gallery has it — motes turning in a beam above the floor, the one moving thing
 * in an otherwise still room. This is the wing's equivalent: a sparse, slow drift that catches
 * where the light already is, near the paintings and plinths, and is invisible where the room
 * is dim. It reads as atmosphere precisely because it does almost nothing: no sparkle, no
 * pulse, no attention taken from the work.
 *
 * The count is the governor's business, not this component's: `high` carries 520 motes, `mid`
 * 220, `low` none. Under reduced motion the room is still entirely.
 */
export function WingDust({ reducedMotion }: { reducedMotion: boolean }) {
  const quality = useGalleryStore((s) => s.quality);
  const count = DUST_FOR[quality];

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      /* Loose bounds — the wings clamp the camera tighter than this, so dust fills the air
         around the visitor without ever being seen popping in or out. */
      arr[i * 3] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 1] = Math.random() * 5.2 + 0.3;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 90 - 20;
    }
    return arr;
  }, [count]);

  const pointsRef = useRef<THREE.Points>(null);

  useFrame(({ clock }) => {
    const points = pointsRef.current;
    if (!points) return;
    const t = clock.elapsedTime;
    const pos = points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += Math.sin(t * 0.3 + i * 0.61) * 0.00035;
      arr[i * 3] += Math.cos(t * 0.22 + i * 1.7) * 0.00028;
    }
    pos.needsUpdate = true;
  });

  if (!count) return null;
  if (reducedMotion) return null;

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        color={0xcfc9bd}
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
