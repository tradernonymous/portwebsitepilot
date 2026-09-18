import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGalleryStore } from './galleryStore';
import { CorridorExhibit } from './CorridorExhibit';
import { CorridorExit } from './CorridorExit';
import * as THREE from 'three';
import type { Station } from '../../content';

type CorridorProps = {
  station: Station;
  reducedMotion: boolean;
  onExhibitSelect?: (index: number) => void;
  onExhibitFocus?: (index: number) => void;
  onExit: () => void;
};

const SPACING = 7.4;

/**
 * One wing of the gallery: a floor, a ceiling, two walls, and every exhibit
 * hung along them. The camera walks the length; the nearest frame lights up.
 */
export function Corridor({ station, reducedMotion, onExhibitSelect, onExhibitFocus, onExit }: CorridorProps) {
  void reducedMotion;
  const { phase, setCorridorLength, setCorridorBounds } = useGalleryStore();
  const { camera, raycaster } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const camPos = useRef(new THREE.Vector3());
  const exhibits = station.exhibits;
  const length = Math.max(24, exhibits.length * SPACING + 12);

  /*
   * The camera, the wheel and a free-walking body all need the wing's shape. The viewing
   * spots stand back from the frames so a work fills a comfortable part of the view, and the
   * body's stops sit in the walkable aisle rather than inside a wall.
   */
  useEffect(() => {
    setCorridorLength(length);
    setCorridorBounds({
      zNear: 3.4,
      zFar: -length + 2.4,
      halfX: 3.35,
      plinths: [],
      works: exhibits.map((_, i) => ({
        x: 0,
        z: -2.4 - i * SPACING,
        progress: i / Math.max(1, exhibits.length - 1),
      })),
    });
    return () => {
      setCorridorLength(0);
      setCorridorBounds(null);
    };
  }, [length, exhibits, setCorridorLength, setCorridorBounds]);

  useFrame(() => {
    if (phase !== 'corridor') return;
    const group = groupRef.current;
    if (!group) return;

    /*
     * The camera rides in the rig, so its own position is always the origin — reading it here
     * asked "which frame is nearest the entrance" on every frame, which is why the readout
     * never left the first work. Where the visitor actually is lives in the world matrix.
     */
    camera.getWorldPosition(camPos.current);
    const camZ = camPos.current.z;
    let nearest = -1;
    let bestDist = Infinity;

    for (let i = 0; i < exhibits.length; i++) {
      const z = -5 - i * SPACING;
      const d = Math.abs(z - (camZ - 6));
      if (d < bestDist) {
        bestDist = d;
        nearest = i;
      }
    }

    if (nearest !== -1 && bestDist < 4.4) {
      onExhibitFocus?.(nearest);
    }
  });

  const onClick = () => {
    const targets: THREE.Object3D[] = [];
    groupRef.current?.traverse(obj => {
      if (obj.userData.exhibitIndex !== undefined) targets.push(obj);
    });
    const intersects = raycaster.intersectObjects(targets, false);
    if (intersects.length) {
      const index = intersects[0].object.userData.exhibitIndex;
      onExhibitSelect?.(index);
      return;
    }

    const exitMesh = groupRef.current?.getObjectByName('exit-door');
    if (exitMesh) {
      const exitIntersects = raycaster.intersectObject(exitMesh, false);
      if (exitIntersects.length) onExit();
    }
  };

  return (
    <group
      ref={groupRef}
      visible={phase === 'corridor'}
      onClick={onClick}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9, length + 20]} />
        <meshStandardMaterial color={0xe8e8e4} roughness={0.42} metalness={0.18} />
      </mesh>

      <mesh position={[0, 4.4, -length / 2 + 6]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9, length + 20]} />
        <meshStandardMaterial color={0xffffff} roughness={0.78} metalness={0.08} />
      </mesh>

      <mesh position={[-4.6, 2.2, -length / 2 + 6]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[length + 20, 4.6]} />
        <meshStandardMaterial color={0xf5f5f2} roughness={0.84} metalness={0.08} side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[4.6, 2.2, -length / 2 + 6]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[length + 20, 4.6]} />
        <meshStandardMaterial color={0xf5f5f2} roughness={0.84} metalness={0.08} side={THREE.DoubleSide} />
      </mesh>

      {exhibits.map((ex, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        const z = -5 - i * SPACING;
        return (
          <CorridorExhibit
            key={ex.id}
            exhibit={ex}
            index={i}
            side={side}
            z={z}
            spacing={SPACING}
            accent={station.accent}
            reducedMotion={reducedMotion}
          />
        );
      })}

      <CorridorExit length={length} stationLabel={station.label} onExit={onExit} />
    </group>
  );
}