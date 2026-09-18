import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * The court's own light.
 *
 * The gallery's light paintings drift with the camera and are the same in every room. A court
 * is not the same room: it shows objects standing on the floor, and objects want light that
 * arrives *at* them. So the light is threaded here instead. A line of colour leaves each
 * plinth, crosses the aisle in an arc and arrives at the next one, and a single pulse runs the
 * whole relay, handing on from thread to thread, so the eye is walked from piece to piece
 * rather than left in front of a wall of ambient glow.
 *
 * The thread is drawn in the colour of the work it *leads to*, so what you are being taken to
 * is legible before you arrive. The pulse is nearly white and deliberately hot, and it is the
 * only thing in here that is: this is a pale room lit to the top of its range, where colour
 * laid over the walls adds almost nothing.
 *
 * Which is also why each thread is three radii of the same curve. Additive light over a white
 * hall is invisible — white plus cyan is white — so the stroke and its aura blend normally and
 * read as a drawn line of light, the way a light painting looks recorded against a bright
 * room, and only the pulse is allowed to be light: it adds, and it is hot enough to bloom.
 */

export type CourtAnchor = {
  /** Where the thread leaves its plinth, in the court's own space. */
  x: number;
  y: number;
  z: number;
  /** The work the thread leads to, whose colour it carries. */
  accent: string;
};

type Props = {
  anchors: CourtAnchor[];
  reducedMotion: boolean;
};

const SEGMENTS = 64;
const RADIAL = 6;
/** The three radii of one thread: the aura, the stroke, and the light that travels it. */
const AURA_RADIUS = 0.32;
const STROKE_RADIUS = 0.1;
const PULSE_RADIUS = 0.05;
/** How much of the stroke the aura carries, so the line sits in a glow rather than on nothing. */
const AURA = 0.34;
/** How much of a thread the passing light occupies, as a fraction of its length. */
const PULSE_WINDOW = 0.34;
/** Seconds for the light to cross one thread. The relay hands on when it arrives. */
const TRAVEL = 2.2;
/*
 * The lift of each arc over the aisle. A fixed rhythm rather than a random one: the light is
 * the room's, not the visitor's, and it should be the same light on every visit — the same
 * reasoning that keeps a sculpture the same sculpture.
 */
const LIFTS = [1.3, 1.6, 1.1, 1.45];
/** What a thread falls back to at the far end of the hall, where it is only a hint. */
const FAINTEST = 0.34;

const WHITE = new THREE.Color(0xffffff);

type Thread = {
  aura: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
  stroke: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
  pulse: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
  pulseGeometry: THREE.TubeGeometry;
  /** Indices per tubular slice, so a stretch of the thread can be lit through the draw range. */
  perSlice: number;
  /** The top of the arc, for asking how near the visitor is to this thread. */
  mid: THREE.Vector3;
  baseOpacity: number;
};

/**
 * One thread per pair of plinths, built once. Nothing here animates on its own: the curve never
 * changes, and the pulse travels by lighting a different stretch of it, which is why a long
 * hall of them costs no more than a short one.
 */
function threadTheCourt(anchors: CourtAnchor[]) {
  const group = new THREE.Group();
  const threads: Thread[] = [];

  for (let i = 0; i < anchors.length - 1; i += 1) {
    const from = anchors[i];
    const to = anchors[i + 1];
    const a = new THREE.Vector3(from.x, from.y, from.z);
    const b = new THREE.Vector3(to.x, to.y, to.z);
    const apex = new THREE.Vector3(
      (a.x + b.x) / 2,
      Math.max(a.y, b.y) + LIFTS[i % LIFTS.length],
      (a.z + b.z) / 2,
    );
    const curve = new THREE.CatmullRomCurve3([a, apex, b], false, 'catmullrom', 0.5);
    const accent = new THREE.Color(to.accent);

    const tube = (radius: number, material: THREE.MeshBasicMaterial) =>
      new THREE.Mesh(new THREE.TubeGeometry(curve, SEGMENTS, radius, RADIAL, false), material);

    /* The aura and the stroke: the path the light takes, in the colour of the work it leads to. */
    const aura = tube(
      AURA_RADIUS,
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    const stroke = tube(
      STROKE_RADIUS,
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    );

    /* The pulse: a lit stretch of the same curve, hot enough to bloom. */
    const pulseGeometry = new THREE.TubeGeometry(curve, SEGMENTS, PULSE_RADIUS, RADIAL, false);
    const pulse = new THREE.Mesh(
      pulseGeometry,
      new THREE.MeshBasicMaterial({
        color: accent.clone().lerp(WHITE, 0.7),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    pulse.visible = false;

    group.add(aura, stroke, pulse);
    threads.push({
      aura,
      stroke,
      pulse,
      pulseGeometry,
      perSlice: (pulseGeometry.index?.count ?? 0) / SEGMENTS,
      mid: apex,
      baseOpacity: 0.42 + (i % 2) * 0.08,
    });
  }

  return {
    group,
    threads,
    dispose() {
      for (const thread of threads) {
        thread.aura.geometry.dispose();
        thread.aura.material.dispose();
        thread.stroke.geometry.dispose();
        thread.stroke.material.dispose();
        thread.pulse.geometry.dispose();
        thread.pulse.material.dispose();
      }
    },
  };
}

export function CourtLight({ anchors, reducedMotion }: Props) {
  const { camera } = useThree();
  const eye = useRef(new THREE.Vector3());
  const built = useMemo(() => threadTheCourt(anchors), [anchors]);

  useEffect(() => () => built.dispose(), [built]);

  useFrame(({ clock }) => {
    const { threads } = built;
    if (!threads.length) return;

    camera.getWorldPosition(eye.current);

    /* Which thread the light is crossing, and how far along it. One pulse, handed on. */
    let active = -1;
    let local = 0;
    if (!reducedMotion) {
      const cursor = (clock.getElapsedTime() / TRAVEL) % threads.length;
      active = Math.floor(cursor);
      local = cursor - active;
    }

    for (let i = 0; i < threads.length; i += 1) {
      const thread = threads[i];

      /*
       * Light belongs to where you are standing. A thread near you burns and the far end of the
       * hall falls back to a hint, which is also what keeps a court this long from reading as
       * a diagram of itself.
       */
      const near = FAINTEST + (1 - FAINTEST) / (1 + Math.max(0, eye.current.distanceTo(thread.mid) - 9) * 0.2);
      thread.stroke.material.opacity = thread.baseOpacity * near;
      thread.aura.material.opacity = thread.baseOpacity * AURA * near;

      if (i !== active) {
        thread.pulse.visible = false;
        continue;
      }

      /* Fade in leaving one plinth, out arriving at the next, so the handover is the point. */
      const hand = Math.max(0, Math.min(1, local / 0.16, (1 - local) / 0.16));
      const window = PULSE_WINDOW * SEGMENTS;
      const start = THREE.MathUtils.clamp(local * SEGMENTS - window / 2, 0, SEGMENTS - window);

      thread.pulse.visible = true;
      thread.pulseGeometry.setDrawRange(
        Math.round(start) * thread.perSlice,
        Math.round(window) * thread.perSlice,
      );
      thread.pulse.material.opacity = near * hand;
    }
  });

  return <primitive object={built.group} />;
}
