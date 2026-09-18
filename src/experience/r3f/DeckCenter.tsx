import { useRef, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function labelTexture(text: string, opts: { colour?: string; size?: number; spacing?: number } = {}): THREE.CanvasTexture {
  const { colour = '#f2ece0', size = 200, spacing = 36 } = opts;
  const font = `600 ${size}px "Chakra Petch", ui-sans-serif, system-ui, sans-serif`;
  const measure = document.createElement('canvas').getContext('2d');
  let width = 1024;
  if (measure) {
    measure.font = font;
    width = Math.ceil(measure.measureText(text).width + spacing * text.length + size);
  }
  const canvas = document.createElement('canvas');
  const height = Math.ceil(size * 2.2);
  canvas.width = Math.max(256, Math.min(4096, width));
  canvas.height = height;
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
    ctx.fillText(glyphs[i], x + widths[i] / 2 - spacing / 2, height / 2);
    x += widths[i];
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function DeckCenter() {
  const logoRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const logo = logoRef.current;
    if (logo) {
      logo.rotation.z = Math.sin(t * 0.25) * 0.03;
    }
  });

  return (
    <group>
      <mesh ref={logoRef} position={[0, 6.4, 0]} rotation={[Math.PI / 2.1, 0, 0]}>
        <planeGeometry args={[11, 2.75]} />
        <meshBasicMaterial
          transparent
          opacity={0.72}
          side={THREE.DoubleSide}
          map={labelTexture('PORT', { colour: '#f2ece0', size: 200, spacing: 36 })}
        />
      </mesh>

      <Medallion radius={3.1} colour={0xd9b978} opacity={0.4} />
      <Medallion radius={3.35} colour={0xd9b978} opacity={0.18} />
    </group>
  );
}

function Medallion({ radius, colour, opacity }: { radius: number; colour: number; opacity: number }) {
  const points: THREE.Vector3[] = [];
  for (let j = 0; j <= 128; j++) {
    const angle = (j / 128) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0.02, Math.sin(angle) * radius));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  return (
    <line geometry={geo} material={
      new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity })
    } />
  );
}