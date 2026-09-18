import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

type CorridorExitProps = {
  length: number;
  stationLabel: string;
  onExit: () => void;
};

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

function textTexture(text: string, opts: { colour?: string; size?: number; spacing?: number } = {}): THREE.CanvasTexture {
  const { colour = '#e9dcc2', size = 42, spacing = 4 } = opts;
  const font = `600 ${size}px "Chakra Petch", ui-sans-serif, system-ui, sans-serif`;
  const measure = document.createElement('canvas').getContext('2d');
  let width = 512;
  if (measure) {
    measure.font = font;
    width = Math.ceil(measure.measureText(text).width + spacing * text.length + size);
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(256, Math.min(2048, width));
  canvas.height = Math.ceil(size * 2.2);
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = font;
  ctx.fillStyle = colour;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = colour;
  ctx.shadowBlur = size * 0.35;
  const glyphs = [...text];
  const widths = glyphs.map(g => ctx.measureText(g).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  let x = (canvas.width - total) / 2;
  for (let i = 0; i < glyphs.length; i++) {
    ctx.fillText(glyphs[i], x + widths[i] / 2 - spacing / 2, canvas.height / 2);
    x += widths[i];
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * The corridor's end: a glowing doorway back to the deck, with a sign above it.
 */
export function CorridorExit({ length, stationLabel, onExit }: CorridorExitProps) {
  void stationLabel;
  const { raycaster } = useThree();
  const doorGlowRef = useRef<THREE.Mesh>(null);
  const doorRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const doorGlow = doorGlowRef.current;
    const door = doorRef.current;

    if (doorGlow) {
      const mat = doorGlow.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.65 + 0.15 * Math.sin(t * 0.8);
    }
    if (door) {
      door.rotation.y = Math.sin(t * 0.3) * 0.05;
    }
  });

  const z = -length - 1.4;

  return (
    <group onClick={() => {
      const intersects = raycaster.intersectObjects(
        [doorRef.current, doorGlowRef.current].filter(Boolean) as THREE.Object3D[],
        false
      );
      if (intersects.length) onExit();
    }}>
      <mesh ref={doorGlowRef} position={[0, 2.4, z - 0.1]}>
        <planeGeometry args={[7, 7]} />
        <meshBasicMaterial
          transparent
          opacity={0.78}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          map={radialGlowTexture('rgba(255,246,228,0.78)', 'rgba(150,120,80,0.14)')}
        />
      </mesh>

      <mesh ref={doorRef} position={[0, 2.1, z - 0.25]}>
        <planeGeometry args={[3.3, 3.9]} />
        <meshBasicMaterial
          color={0xf4e9d2}
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh position={[0, 4.55, z - 0.15]}>
        <planeGeometry args={[5.2, 0.6]} />
        <meshBasicMaterial
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
          depthWrite={false}
          map={textTexture('KEMBALI KE DEK', { colour: '#e9dcc2', size: 42, spacing: 4 })}
        />
      </mesh>
    </group>
  );
}