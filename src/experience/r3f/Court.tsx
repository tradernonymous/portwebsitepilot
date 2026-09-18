import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGalleryStore } from './galleryStore';
import { CorridorExit } from './CorridorExit';
import { SCULPTURE_FORMS, Sculpture, isSculptureForm, type SculptureForm } from './Sculpture';
import { CourtLight } from './CourtLight';
import { ArtCanvas } from './ArtCanvas';
import * as THREE from 'three';
import type { Station } from '../../content';

type CourtProps = {
  station: Station;
  reducedMotion: boolean;
  onExhibitSelect?: (index: number) => void;
  onExhibitFocus?: (index: number) => void;
  onExit: () => void;
};

/**
 * The court's pitch is longer than the corridor's: an object has to be walked round, and a
 * visitor needs room to stand back from one before they reach the next.
 */
const SPACING = 9;
/** How far the camera starts before the first plinth. */
const ENTRY_Z = 6;
/** The court is a hall, not a passage — the walls stand well apart. */
const HALF_WIDTH = 8.5;
/** How far off the centre line the plinths stand, how wide their tops are, how high they rise. */
const PLINTH_X = 3.1;
const PLINTH_HALF = 0.85;
const PLINTH_TOP = 0.9;
/** How far into the aisle a thread of light leaves a plinth, clear of the piece standing on it. */
const THREAD_INSET = 0.45;

/**
 * The work a piece is made in.
 *
 * A work that names its own always keeps it. A work that does not gets one derived from its
 * id — stable, so a piece never changes language between visits, and unaffected by reordering
 * the court, which a position-based choice would not survive. The same rule the rooms use for
 * their wall motifs, applied to the objects standing on the floor.
 */
function formFor(exhibit: { id: string; form?: string }): SculptureForm {
  if (isSculptureForm(exhibit.form)) return exhibit.form;
  let hash = 0;
  for (let i = 0; i < exhibit.id.length; i += 1) hash = (hash * 31 + exhibit.id.charCodeAt(i)) >>> 0;
  return SCULPTURE_FORMS[hash % SCULPTURE_FORMS.length];
}

/**
 * A sculpture court: the wing that shows objects rather than photographs.
 *
 * It walks along the same axis as a corridor, publishes the same length and reports the same
 * nearest work, which is what lets the camera, the wheel, the arrow keys and the index rail
 * serve it without knowing it is a different kind of room. What changes is the hanging: the
 * pieces stand in the middle of the floor on plinths, at a height you can walk around, and
 * the room is lit from a slot in the roof instead of from the walls.
 */
export function Court({ station, reducedMotion, onExhibitSelect, onExhibitFocus, onExit }: CourtProps) {
  const { phase, setCorridorLength, setCorridorBounds } = useGalleryStore();
  const { camera, raycaster } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const camPos = useRef(new THREE.Vector3());
  const exhibits = station.exhibits;
  const length = Math.max(28, exhibits.length * SPACING + 16);

  /* The camera and the wheel need the length to know how far a walk goes. */
  useEffect(() => {
    setCorridorLength(length);
    return () => setCorridorLength(0);
  }, [length, setCorridorLength]);

  /*
   * A room's colour, walked a little further round the wheel for each piece, so the court has
   * colour in it without becoming a rack of swatches.
   */
  const accents = useMemo(() => {
    const base = new THREE.Color(station.accent);
    return exhibits.map((_, i) => {
      const c = base.clone();
      const hsl = { h: 0, s: 0, l: 0 };
      c.getHSL(hsl);
      c.setHSL((hsl.h + i * 0.085) % 1, Math.min(1, hsl.s * 1.15), Math.min(0.72, hsl.l * 1.05));
      return `#${c.getHexString()}`;
    });
  }, [exhibits, station.accent]);

  /*
   * The room's furniture, worked out once: where each plinth stands and the colour its work
   * carries. The plinths and the light threaded between them are both built from this, so the
   * two cannot drift apart.
   */
  const plinths = useMemo(
    () =>
      exhibits.map((ex, i) => ({
        id: ex.id,
        x: (i % 2 === 0 ? -1 : 1) * PLINTH_X,
        z: -ENTRY_Z - i * SPACING,
        accent: accents[i] ?? station.accent,
      })),
    [exhibits, accents, station.accent],
  );

  /* Where the light leaves each plinth: the aisle side of its top, at the piece's feet. */
  const anchors = useMemo(
    () =>
      plinths.map((plinth) => ({
        x: plinth.x - Math.sign(plinth.x) * (PLINTH_HALF + THREAD_INSET),
        y: PLINTH_TOP + 0.12,
        z: plinth.z,
        accent: plinth.accent,
      })),
    [plinths],
  );

  /*
   * The room's shape, for the camera, the wheel and a free-walking body. The court is the room
   * the body was built for: the viewing spots stand beside each piece rather than in front of
   * it, and the plinths are published so a body cannot walk through the art.
   */
  useEffect(() => {
    setCorridorBounds({
      zNear: 4.4,
      zFar: -length + 2.6,
      halfX: HALF_WIDTH - 0.7,
      plinths: plinths.map((p) => ({ x: p.x, z: p.z, radius: PLINTH_HALF + 0.35 })),
      works: plinths.map((p, i) => ({
        /* Standing off the piece, on its aisle side, looking back at it. */
        x: p.x + Math.sign(p.x) * 1.9,
        z: p.z + 1.4,
        progress: i / Math.max(1, exhibits.length - 1),
      })),
    });
    return () => setCorridorBounds(null);
  }, [length, plinths, exhibits.length, setCorridorBounds]);

  useFrame(() => {
    if (phase !== 'corridor') return;
    const group = groupRef.current;
    if (!group) return;

    /* Where the visitor actually is lives in the world matrix — the camera rides in the rig. */
    camera.getWorldPosition(camPos.current);
    const ahead = camPos.current.z - 7;
    let nearest = -1;
    let bestDist = Infinity;

    for (let i = 0; i < exhibits.length; i++) {
      const d = Math.abs(-ENTRY_Z - i * SPACING - ahead);
      if (d < bestDist) {
        bestDist = d;
        nearest = i;
      }
    }

    if (nearest !== -1 && bestDist < 5.2) onExhibitFocus?.(nearest);
  });

  const onClick = () => {
    const targets: THREE.Object3D[] = [];
    groupRef.current?.traverse((obj) => {
      if (obj.userData.exhibitIndex !== undefined) targets.push(obj);
    });
    const intersects = raycaster.intersectObjects(targets, false);
    if (intersects.length) {
      onExhibitSelect?.(intersects[0].object.userData.exhibitIndex);
      return;
    }

    const exitMesh = groupRef.current?.getObjectByName('exit-door');
    if (exitMesh && raycaster.intersectObject(exitMesh, false).length) onExit();
  };

  const ceiling = 5.6;

  return (
    <group ref={groupRef} visible={phase === 'corridor'} onClick={onClick}>
      {/* the floor: polished enough to carry the light, so the room reads as depth not a box */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HALF_WIDTH * 2, length + 24]} />
        <meshStandardMaterial color={0xe9e8e3} roughness={0.14} metalness={0.62} />
      </mesh>

      <mesh position={[0, ceiling, -length / 2 + 8]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HALF_WIDTH * 2, length + 24]} />
        <meshStandardMaterial color={0xf7f6f2} roughness={0.86} metalness={0.06} />
      </mesh>

      {/* the slot in the roof the court is lit by, and the shaft it throws */}
      <mesh position={[0, ceiling - 0.04, -length / 2 + 8]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, length + 16]} />
        <meshBasicMaterial color={0xfff8e8} toneMapped={false} />
      </mesh>
      <directionalLight position={[0, 14, -length / 2]} intensity={1.1} color={0xfff6e6} />

      <mesh position={[-HALF_WIDTH, ceiling / 2, -length / 2 + 8]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[length + 24, ceiling]} />
        <meshStandardMaterial color={0xf2f1ec} roughness={0.9} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[HALF_WIDTH, ceiling / 2, -length / 2 + 8]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[length + 24, ceiling]} />
        <meshStandardMaterial color={0xf2f1ec} roughness={0.9} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>

      {/*
       * Paintings hung on the court's walls, between the plinths. A sculpture court is not an
       * empty hall — the flat work gives the eye somewhere to rest between objects, and the
       * room stops reading as bare plaster. Each painting takes the accent of the plinth
       * opposite it, so wall and floor carry one colour at a time.
       */}
      {exhibits.map((ex, i) => {
        const side = i % 2 === 0 ? 1 : -1;
        const z = -ENTRY_Z - i * SPACING - SPACING / 2;
        return (
          <group key={`wall-${ex.id}`} position={[side * (HALF_WIDTH - 0.12), 2.6, z]} rotation={[0, side * -Math.PI / 2, 0]}>
            <ArtCanvas
              seed={`court:${ex.id}`}
              accent={accents[i] ?? station.accent}
              width={2.6}
              height={1.9}
              reducedMotion={reducedMotion}
            />
          </group>
        );
      })}

      {plinths.map((plinth, i) => {
        const { id, x, z, accent } = plinth;

        return (
          <group key={id} position={[x, 0, z]} userData={{ exhibitIndex: i }}>
            {/* the plinth the piece stands on */}
            <mesh position={[0, PLINTH_TOP / 2, 0]}>
              <boxGeometry args={[PLINTH_HALF * 2, PLINTH_TOP, PLINTH_HALF * 2]} />
              <meshStandardMaterial color={0x1c1c22} roughness={0.4} metalness={0.34} />
            </mesh>

            <group position={[0, PLINTH_TOP, 0]}>
              <Sculpture
                form={formFor(exhibits[i])}
                accent={accent}
                seed={i * 97 + 13}
                reducedMotion={reducedMotion}
              />
            </group>

            {/* the light the piece is shown in, from above and a little to the front */}
            <pointLight position={[0, 4.2, 1.1]} intensity={7} distance={9} decay={2} color={accent} />
            {/* and the pool it puts on the floor, which is what makes the object sit on it */}
            <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[1.5, 40]} />
              <meshBasicMaterial
                color={accent}
                transparent
                opacity={0.09}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}

      {/* the light the court is shown by, threading the aisle from plinth to plinth */}
      <CourtLight anchors={anchors} reducedMotion={reducedMotion} />

      <CorridorExit length={length} stationLabel={station.label} onExit={onExit} />
    </group>
  );
}
