import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PIGMENTS = [0x3de8ff, 0x8b5cff, 0xff3dcb, 0xffb13d, 0x6dff9c];

type Shard = {
  mesh: THREE.Group;
  material: THREE.MeshBasicMaterial;
  coreMaterial: THREE.MeshBasicMaterial;
  flow: THREE.Texture;
  origin: THREE.Vector3;
  drift: THREE.Vector3;
  rate: number;
  phase: number;
  baseOpacity: number;
  scroll: number;
  lean: THREE.Vector3;
};

function streakTexture(core: number): THREE.CanvasTexture {
  const w = 512;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const across = ctx.createLinearGradient(0, 0, w, 0);
  across.addColorStop(0, 'rgba(255,255,255,0)');
  across.addColorStop(0.16, 'rgba(255,255,255,0.9)');
  across.addColorStop(0.84, 'rgba(255,255,255,0.9)');
  across.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = across;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  const along = ctx.createLinearGradient(0, 0, 0, h);
  along.addColorStop(0, 'rgba(255,255,255,0.06)');
  along.addColorStop(Math.max(0.06, core - 0.3), 'rgba(255,255,255,0.96)');
  along.addColorStop(Math.min(0.94, core + 0.3), 'rgba(255,255,255,0.96)');
  along.addColorStop(1, 'rgba(255,255,255,0.06)');
  ctx.fillStyle = along;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

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

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function LightPaintings({
  tone = 'dark',
  count = 5,
  reducedMotion = false,
  weight = 1,
  speed = 1,
  seed = 7,
}: {
  tone?: 'dark' | 'light';
  count?: number;
  reducedMotion?: boolean;
  weight?: number;
  speed?: number;
  seed?: number;
}) {
  const { scene } = useThree();
  const groupRef = useRef(new THREE.Group());
  const shardsRef = useRef<Shard[]>([]);
  const texturesRef = useRef<THREE.Texture[]>([]);
  const glowTexRef = useRef<THREE.Texture | null>(null);
  const paintingGroupRef = useRef(new THREE.Group());
  const cursorWorldRef = useRef(new THREE.Vector3());
  const cursorLocalRef = useRef(new THREE.Vector3());
  const hasPointerRef = useRef(false);
  const ndcRef = useRef(new THREE.Vector2());
  const rayRef = useRef(new THREE.Raycaster());

  useEffect(() => {
    const paintingGroup = paintingGroupRef.current;
    const group = groupRef.current;
    const random = mulberry32(seed);
    const dark = tone === 'dark';

    const streaks = [
      streakTexture(1.0),
      streakTexture(0.55),
      streakTexture(0.34),
    ];
    texturesRef.current = streaks;

    glowTexRef.current = radialGlowTexture(
      'rgba(240,228,205,0.5)',
      'rgba(130,110,82,0.12)'
    );

    const geometry = new THREE.PlaneGeometry(1, 1);
    const clusters = reducedMotion ? 3 : 5;
    const barsPerCluster = reducedMotion ? 2 : 3;

    for (let c = 0; c < clusters; c++) {
      const bearing = (c / clusters) * Math.PI * 2 + 0.35;
      const distance = 22 + random() * 16;
      const centreY = 3.5 + random() * 11;
      const tilt = random() * Math.PI;
      const span = 14 + random() * 12;

      for (let b = 0; b < barsPerCluster; b++) {
        const angle = tilt + b * 0.14 - barsPerCluster * 0.07;
        const offset = (b - (barsPerCluster - 1) / 2) * 3.4;
        const along = (b - (barsPerCluster - 1) / 2) * span * 0.24;

        const origin = new THREE.Vector3(
          Math.cos(bearing) * distance + Math.cos(tilt) * along,
          centreY + Math.sin(angle) * offset + Math.sin(tilt) * along * 0.4,
          Math.sin(bearing) * distance + Math.sin(tilt) * along
        );

        const shape = (c + b) % streaks.length;
        const length = (16 + random() * 26) * (shape === 1 ? 1.5 : shape === 2 ? 0.7 : 1);
        const breadth = length * (shape === 1 ? 0.34 : shape === 2 ? 0.5 : 0.16);

        const material = new THREE.MeshBasicMaterial({
          map: streaks[shape],
          color: PIGMENTS[(c + b) % PIGMENTS.length],
          transparent: true,
          opacity: 0,
          blending: dark ? THREE.AdditiveBlending : THREE.MultiplyBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });

        const flow = streaks[shape].clone();
        flow.needsUpdate = true;
        flow.repeat.x = 0.68 + random() * 0.24;
        material.map = flow;

        const coreMaterial = new THREE.MeshBasicMaterial({
          map: glowTexRef.current,
          color: PIGMENTS[(c + b) % PIGMENTS.length],
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });

        const shard = new THREE.Group();
        const plate = new THREE.Mesh(geometry, material);
        plate.scale.set(length, breadth, 1);
        shard.add(plate);

        const heart = new THREE.Mesh(geometry, coreMaterial);
        heart.scale.set(length * 0.62, breadth * 0.74, 1);
        shard.add(heart);

        shard.position.copy(origin);
        shard.rotation.z = angle;
        paintingGroup.add(shard);

        shardsRef.current.push({
          mesh: shard,
          material,
          coreMaterial,
          flow,
          origin,
          drift: new THREE.Vector3(
            THREE.MathUtils.randFloatSpread(1.6),
            THREE.MathUtils.randFloatSpread(2.4),
            THREE.MathUtils.randFloatSpread(1.6),
          ),
          rate: 0.03 + random() * 0.05,
          phase: random() * Math.PI * 2,
          baseOpacity: 0.24 + random() * 0.14,
          scroll: 0.04 + random() * 0.1,
          lean: new THREE.Vector3(
            THREE.MathUtils.randFloatSpread(1),
            THREE.MathUtils.randFloatSpread(1),
            THREE.MathUtils.randFloatSpread(1),
          ).normalize(),
        });
      }
    }

    const washes: [number, number, number][] = [
      [PIGMENTS[0], 0.045, 0],
      [PIGMENTS[1], 0.035, Math.PI * 0.66],
      [PIGMENTS[3], 0.03, Math.PI * 1.33],
    ];

    for (const [pigment, opacity, angle] of washes) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(120, 70),
        new THREE.MeshBasicMaterial({
          map: glowTexRef.current,
          color: pigment,
          transparent: true,
          opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      mesh.position.set(Math.cos(angle) * 42, 4, Math.sin(angle) * 42);
      mesh.rotation.y = -angle + Math.PI / 2;
      paintingGroup.add(mesh);
    }

    group.add(paintingGroup);
    scene.add(group);

    return () => {
      scene.remove(group);
      paintingGroup.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else mat?.dispose();
      });
      texturesRef.current.forEach(t => t.dispose());
      glowTexRef.current?.dispose();
    };
  }, [scene, tone, count, reducedMotion, weight, speed, seed]);

  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    const delta = clock.getDelta();
    const paintingGroup = paintingGroupRef.current;
    const shards = shardsRef.current;
    const rig = camera.parent as THREE.Object3D | null;

    if (!rig) return;

    paintingGroup.position.copy(rig.position);

    let reaching = false;
    if (hasPointerRef.current) {
      rayRef.current.setFromCamera(ndcRef.current, camera);
      rayRef.current.ray.at(26, cursorWorldRef.current);
      cursorLocalRef.current.copy(cursorWorldRef.current).sub(paintingGroup.position);
      reaching = true;
    }

    const camPos = camera.getWorldPosition(new THREE.Vector3());
    const lean = THREE.MathUtils.clamp(delta * 1.6, 0, 1);

    for (const shard of shards) {
      const { mesh, material, coreMaterial, flow, origin, drift, rate, phase, baseOpacity, scroll, lean: leanVec } = shard;
      const sway = Math.sin(t * rate + phase);
      const lift = Math.cos(t * rate * 0.7 + phase);

      mesh.position.set(
        origin.x + drift.x * sway,
        origin.y + drift.y * lift,
        origin.z + drift.z * sway,
      );

      mesh.rotation.y = Math.atan2(camPos.x - mesh.position.x, camPos.z - mesh.position.z) - paintingGroup.rotation.y;

      flow.offset.x = (1 - flow.repeat.x) * (0.5 + 0.5 * Math.sin(t * scroll + phase * 1.7));

      const breath = 1 + 0.05 * lift;
      mesh.scale.set(breath, 1 + 0.08 * sway, 1);

      let brightness = baseOpacity + baseOpacity * 0.35 * sway;
      let coreTarget = brightness * 0.5;

      if (reaching) {
        const distance = mesh.position.distanceTo(cursorLocalRef.current);
        if (distance < 30) {
          const near = 1 - distance / 30;
          brightness += near * 0.16;
          mesh.position.addScaledVector(leanVec, near * 1.2 * lean * 6);
          coreTarget += near * near * 0.5;
        }
      }

      material.opacity += (brightness - material.opacity) * THREE.MathUtils.clamp(delta * 1.1, 0, 1);
      coreMaterial.opacity += (coreTarget - coreMaterial.opacity) * THREE.MathUtils.clamp(delta * 1.2, 0, 1);
    }

    paintingGroup.rotation.y = t * 0.008;
  }, -1);

  const onPointerMove = (event: React.PointerEvent) => {
    const canvas = event.currentTarget as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
    ndcRef.current.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
    hasPointerRef.current = true;
  };

  const onPointerLeave = () => {
    hasPointerRef.current = false;
  };

  return (
    <group ref={groupRef} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      <group ref={paintingGroupRef} />
    </group>
  );
}