import { useMemo, useRef, useLayoutEffect } from 'react';
import { useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';
import * as THREE from 'three';

type ArtworkProps = {
  image: { small: string; large: string; caption: string };
  fit?: 'cover' | 'contain';
  position?: [number, number, number];
  scale?: number;
  rotation?: [number, number, number];
  plane?: boolean;
};

/**
 * A picture plane. Texture loads lazily; the plane resizes itself to the
 * source image's aspect ratio so nothing is stretched.
 */
export function Artwork({
  image,
  fit = 'cover',
  position = [0, 0, 0],
  scale = 1,
  rotation = [0, 0, 0],
  plane = true,
}: ArtworkProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useLoader(TextureLoader, image.large);
  if (texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
  }

  const aspect = useMemo(() => {
    const img = texture?.image as HTMLImageElement | undefined;
    if (!img || !img.naturalWidth) return 1;
    return img.naturalHeight / img.naturalWidth;
  }, [texture]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.multiplyScalar(scale);
  }, [position, rotation, scale]);

  const targetW = fit === 'cover' ? 3.05 : 4.08;
  const targetH = fit === 'cover' ? 2.05 : 2.76;
  const w = targetW;
  const h = targetW * aspect;

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial
        side={THREE.DoubleSide}
        transparent
        alphaTest={0.01}
        map={texture || undefined}
      />
    </mesh>
  );
}