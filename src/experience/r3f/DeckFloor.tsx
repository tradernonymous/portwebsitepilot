import { useRef, useFrame, useMemo } from '@react-three/fiber';
import * as THREE from 'three';

function radialGlowTexture(inner: string, outer: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  g.addColorStop(0, inner);
  g.addColorStop(0.45, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGridGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  for (let r = 2; r <= 24; r += 2) {
    const segments = 96;
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      positions.push(
        Math.cos(a0) * r, 0.012, Math.sin(a0) * r,
        Math.cos(a1) * r, 0.012, Math.sin(a1) * r,
      );
    }
  }
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    positions.push(
      Math.cos(a) * 2.4, 0.012, Math.sin(a) * 2.4,
      Math.cos(a) * 24, 0.012, Math.sin(a) * 24,
    );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

export function DeckFloor() {
  const poolRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const gridRef = useRef<THREE.LineSegments>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);

  const gridGeo = useMemo(() => createGridGeometry(), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const ring = ringRef.current;
    const pool = poolRef.current;

    if (ring) {
      ring.rotation.z = t * 0.045;
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.12 + 0.06 * Math.sin(t * 0.22);
    }

    if (pool) {
      const mat = pool.material as THREE.MeshBasicMaterial;
      const target = 0.42 + 0.1 * Math.sin(t * 0.16);
      mat.opacity += (target - mat.opacity) * 0.02;
    }
  });

  return (
    <group>
      <mesh ref={poolRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[30, 64]} />
        <meshBasicMaterial
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          map={radialGlowTexture('rgba(17,17,17,0.16)', 'rgba(17,17,17,0.02)')}
        />
      </mesh>

      <mesh ref={ringRef} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[9.2, 9.5, 96]} />
        <meshBasicMaterial
          color={0x0f0f0f}
          transparent
          opacity={0.18}
          blending={THREE.NormalBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <lineSegments ref={gridRef} geometry={gridGeo} position={[0, 0.012, 0]}>
        <lineBasicMaterial color={0x161616} transparent opacity={0.16} />
      </lineSegments>

      <mesh ref={glowRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshBasicMaterial
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          map={radialGlowTexture('rgba(240,228,205,0.5)', 'rgba(130,110,82,0.12)')}
        />
      </mesh>

      <mesh ref={beamRef} position={[0, 6, 0]}>
        <cylinderGeometry args={[0.65, 1.5, 12, 32, 1, true]} />
        <meshBasicMaterial
          color={0xfff6e6}
          transparent
          opacity={0.03}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[26, 72]} />
        <meshBasicMaterial color={0xf7f7f4} />
      </mesh>
    </group>
  );
}