import { useThree, useFrame } from '@react-three/fiber';
import { useGalleryStore } from './galleryStore';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { moveInput, heldKeys, clearInput, freeWalkBus, MOVE_KEYS, addWheelImpulse, takeWheelImpulse } from './input';

/**
 * Where a standing body is: eye height, and a radius that keeps it out of the walls and the
 * plinths. The rig rides at the feet, so a body only exists once the visitor takes the walk
 * into their own legs — on the rail, the rig is the rail's camera, not a person.
 */
const EYE_HEIGHT = 1.62;
const BODY_RADIUS = 0.55;

/** How fast a free-walking body moves, and how fast the rail carries it between works. */
const WALK_SPEED = 3.1;
const CARRY_SPEED = 3.6;

const HUB_CAMERA_POS = new THREE.Vector3(0, 1.72, 0);

/** Where the walk starts: standing off the first frame, looking down the wing. */
const CORRIDOR_START_Z = 4.6;

/**
 * How far the camera travels walking a wing end to end.
 *
 * The wing runs into negative z — its frames are hung from -5 downward and its exit door sits
 * just past the far end — so the walk moves the camera *towards* the door, and this span is
 * what a progress of 1 covers. The two units the walk used to be written in (a raw z offset
 * and a 0–1 progress) are reconciled here, once, instead of at each caller.
 */
function corridorSpan(length: number): number {
  return Math.max(12, length + 2.2);
}

type Bounds = NonNullable<ReturnType<typeof useGalleryStore.getState>['bounds']>;
type Body = { pos: THREE.Vector3; active: boolean };

export function GalleryCamera({ reducedMotion }: { reducedMotion: boolean }) {
  const { camera, scene, raycaster, gl } = useThree();
  const { phase } = useGalleryStore();
  const gyroLook = useGalleryStore((s) => s.gyroLook);
  const rigRef = useRef(new THREE.Object3D());
  const yawRef = useRef(new THREE.Object3D());
  const pitchRef = useRef(new THREE.Object3D());
  const lookRef = useRef({ yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0 });
  const pointerRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const movedRef = useRef(0);
  const entryArmedRef = useRef(false);
  const entryTRef = useRef(0);
  const corridorWalkRef = useRef(0);
  /**
   * The free-walking body. It lives in refs so a body in motion re-renders nothing, and it is
   * not reset when the visitor steps back to the rail — where they were standing is where they
   * are standing. It resets only when a different wing opens.
   */
  const bodyRef = useRef<Body>({ pos: new THREE.Vector3(0, 0, CORRIDOR_START_Z), active: false });
  const bodyWingIdRef = useRef<string | null>(null);
  /** Where a carried body is heading, and which work the body is standing nearest. */
  const carryTargetRef = useRef<{ x: number; z: number } | null>(null);
  const nearestStopRef = useRef(0);

  useEffect(() => {
    const rig = rigRef.current;
    const yaw = yawRef.current;
    const pitch = pitchRef.current;

    rig.add(yaw);
    yaw.add(pitch);
    pitch.add(camera);
    scene.add(rig);

    if (reducedMotion) {
      rig.position.copy(HUB_CAMERA_POS);
    } else {
      rig.position.set(0, 0.1, 66);
    }

    return () => {
      scene.remove(rig);
      pitch.remove(camera);
      yaw.remove(pitch);
      rig.remove(yaw);
    };
  }, [camera, scene, reducedMotion]);

  const onPointerDown = (event: PointerEvent) => {
    if (phase === 'entry' && !entryArmedRef.current) return;
    const canvas = gl.domElement;
    canvas.setPointerCapture?.(event.pointerId);
    draggingRef.current = true;
    movedRef.current = 0;
    const rect = canvas.getBoundingClientRect();
    pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };

  const onPointerMove = (event: PointerEvent) => {
    const rect = gl.domElement.getBoundingClientRect();
    pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    if (draggingRef.current) {
      movedRef.current += Math.abs(event.movementX) + Math.abs(event.movementY);
      const speed = phase === 'entry' ? 0.0008 : 0.0032;
      lookRef.current.targetYaw -= event.movementX * speed;
      lookRef.current.targetPitch = THREE.MathUtils.clamp(
        lookRef.current.targetPitch - event.movementY * speed,
        -0.85, 0.85
      );
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    const wasDragging = draggingRef.current;
    draggingRef.current = false;
    gl.domElement.releasePointerCapture?.(event.pointerId);
    if (!wasDragging || movedRef.current > 12) return;
    pick();
  };

  const onPointerLeave = () => {
    draggingRef.current = false;
  };

  /*
   * The phase is read at the moment of the wheel, not from the render that registered this
   * listener. Closing over it meant the handler kept the phase the component first rendered
   * with — every notch scrolled before that caught up was thrown away, which reads as a wheel
   * that works only sometimes.
   */
  const onWheel = (event: WheelEvent) => {
    if (useGalleryStore.getState().phase !== 'corridor') return;
    /*
     * With a body the wheel nudges the body along the wing; without one it moves the line as
     * it always did. The impulse is consumed on the next frame either way.
     */
    if (useGalleryStore.getState().freeWalk) {
      addWheelImpulse(-event.deltaY * 0.0045);
      return;
    }
    walk(event.deltaY * 0.05);
  };

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
    /* Nothing but the canvas is captured now, so the listener is attached once per canvas. */
  }, [gl]);

  /*
   * Pointer-locked look. Locking is requested by the free-walk toggle itself, as part of the
   * same visitor gesture — a click on the canvas cannot do it, because that click is already
   * the gesture that opens a work. While locked, mouse movement turns the head and the usual
   * drag handlers idle; Escape releases the lock (the browser does it) and the body stays
   * exactly where it was standing.
   */
  useEffect(() => {
    const onLockMove = (event: MouseEvent) => {
      if (!document.pointerLockElement) return;
      const speed = 0.0026;
      lookRef.current.targetYaw -= event.movementX * speed;
      lookRef.current.targetPitch = THREE.MathUtils.clamp(
        lookRef.current.targetPitch - event.movementY * speed,
        -0.85, 0.85
      );
    };
    const onLockChange = () => {
      if (!document.pointerLockElement) clearInput();
    };
    document.addEventListener('mousemove', onLockMove);
    document.addEventListener('pointerlockchange', onLockChange);
    return () => {
      document.removeEventListener('mousemove', onLockMove);
      document.removeEventListener('pointerlockchange', onLockChange);
    };
  }, []);

  /*
   * The keyboard. Two jobs: with a body (WASD and the arrows move it), and without one (the
   * arrows walk the rail, which ImmersiveWalk wires — that handler stands down its movement
   * keys while a body is active, so the two listeners never fight over one press).
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const store = useGalleryStore.getState();
      if (store.phase !== 'corridor' || !store.freeWalk) return;
      const key = event.key.toLowerCase();
      if ((MOVE_KEYS as readonly string[]).includes(key)) {
        heldKeys.add(key);
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      heldKeys.delete(event.key.toLowerCase());
    };
    const onBlur = () => clearInput();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      clearInput();
    };
  }, []);

  /* Gyro look: the device reports its tilt, the head follows the change. Off until asked for. */
  useEffect(() => {
    if (!gyroLook) return;
    let lastGamma: number | null = null;
    let lastBeta: number | null = null;
    const onOrient = (event: DeviceOrientationEvent) => {
      if (event.gamma == null || event.beta == null) return;
      if (lastGamma != null) {
        const speed = 0.0045;
        lookRef.current.targetYaw -= (event.gamma - lastGamma) * speed;
        lookRef.current.targetPitch = THREE.MathUtils.clamp(
          lookRef.current.targetPitch - (event.beta - (lastBeta as number)) * speed,
          -0.85, 0.85
        );
      }
      lastGamma = event.gamma;
      lastBeta = event.beta;
    };
    window.addEventListener('deviceorientation', onOrient);
    return () => {
      window.removeEventListener('deviceorientation', onOrient);
      lastGamma = null;
      lastBeta = null;
    };
  }, [gyroLook]);

  const pick = () => {
    raycaster.setFromCamera(new THREE.Vector2(pointerRef.current.x, pointerRef.current.y), camera);
    // Picking is delegated to Deck/Corridor components via their own click handlers.
  };

  /**
   * A step of the walk, in world units, expressed as progress. Progress is the store's, so the
   * wheel, the rail, the arrow keys and the camera all move the same number rather than four
   * private targets that can disagree.
   */
  const walk = (delta: number) => {
    const store = useGalleryStore.getState();
    if (store.phase !== 'corridor') return;
    const span = corridorSpan(store.corridorLength);
    store.setWalkProgress(THREE.MathUtils.clamp(store.walkProgress + delta / span, 0, 1));
  };

  /*
   * The carry mechanic: the rail asks the camera to walk the body to a work's viewing spot.
   * Guarded on the state at the moment of the call, the same way the wheel reads its phase.
   */
  useEffect(() => {
    const carryTo = (index: number) => {
      const store = useGalleryStore.getState();
      if (store.phase !== 'corridor' || !store.freeWalk || !store.bounds) return;
      const works = store.bounds.works;
      if (!works.length) return;
      const i = THREE.MathUtils.clamp(Math.round(index), 0, works.length - 1);
      carryTargetRef.current = { x: works[i].x, z: works[i].z };
      store.setWalkProgress(works[i].progress);
    };
    freeWalkBus.carryBy = (dir: number) => carryTo(nearestStopRef.current + dir);
    freeWalkBus.carryTo = carryTo;
    return () => {
      freeWalkBus.carryBy = null;
      freeWalkBus.carryTo = null;
    };
  }, []);

  /**
   * One frame of a body in the wing.
   *
   * A carried body glides to its viewing spot; otherwise held keys and the joystick move it.
   * Motion is axis-separated and then pushed out of the plinths — not the world's finest
   * collision solver, but stable at walking speed and unable to tunnel through anything at
   * three metres a second.
   */
  const integrateBody = (d: number, rig: THREE.Object3D, bounds: Bounds, railZ: number) => {
    const body = bodyRef.current;
    if (!body.active) {
      /* A body is born where the rail camera is, at the feet, so the handover is invisible. */
      body.pos.set(rig.position.x, 0, railZ);
      body.active = true;
    }
    const look = lookRef.current;

    if (carryTargetRef.current) {
      const target = carryTargetRef.current;
      const dx = target.x - body.pos.x;
      const dz = target.z - body.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.14) {
        body.pos.x = target.x;
        body.pos.z = target.z;
        carryTargetRef.current = null;
      } else {
        const step = Math.min(CARRY_SPEED * d, dist);
        moveBody(body, bounds, (dx / dist) * step, (dz / dist) * step);
        /* A carried body faces where it is going. */
        look.targetYaw = dampAngle(look.targetYaw, Math.atan2(-dx, -dz), d * 6);
        look.targetPitch = dampAngle(look.targetPitch, 0, d * 6);
      }
    } else {
      /* Held keys, the joystick and the wheel's impulse all add into the same axes. */
      let ix = THREE.MathUtils.clamp(moveInput.x, -1, 1);
      let iy = THREE.MathUtils.clamp(moveInput.y, -1, 1) + takeWheelImpulse() * 0.25;
      if (heldKeys.has('w') || heldKeys.has('arrowup')) iy += 1;
      if (heldKeys.has('s') || heldKeys.has('arrowdown')) iy -= 1;
      if (heldKeys.has('d') || heldKeys.has('arrowright')) ix += 1;
      if (heldKeys.has('a') || heldKeys.has('arrowleft')) ix -= 1;
      const len = Math.hypot(ix, iy);
      if (len > 0.001) {
        ix /= len;
        iy /= len;
        const speed = WALK_SPEED * d;
        /* Forward is where the camera faces; strafe is across it. */
        const sin = Math.sin(look.yaw);
        const cos = Math.cos(look.yaw);
        const dx = (-sin * iy + cos * ix) * speed;
        const dz = (-cos * iy - sin * ix) * speed;
        moveBody(body, bounds, dx, dz);
        look.targetPitch = dampAngle(look.targetPitch, 0, d * 2);
      }
    }

    /* Which work the body is standing nearest — the rail's MAJU/UNDUR step from here. */
    let nearest = 0;
    let bestDist = Infinity;
    for (let i = 0; i < bounds.works.length; i += 1) {
      const w = bounds.works[i];
      const dist = Math.hypot(w.x - body.pos.x, w.z - body.pos.z);
      if (dist < bestDist) {
        bestDist = dist;
        nearest = i;
      }
    }
    nearestStopRef.current = nearest;

    rig.position.x = body.pos.x;
    rig.position.y = EYE_HEIGHT;
    rig.position.z = body.pos.z;
  };

  /** Axis-separated movement with the walls and the plinths respected. */
  const moveBody = (body: Body, bounds: Bounds, dx: number, dz: number) => {
    const tryX = body.pos.x + dx;
    if (Math.abs(tryX) <= bounds.halfX - BODY_RADIUS) body.pos.x = tryX;
    const tryZ = body.pos.z + dz;
    if (tryZ <= bounds.zNear && tryZ >= bounds.zFar) body.pos.z = tryZ;
    for (const p of bounds.plinths) {
      const ex = body.pos.x - p.x;
      const ez = body.pos.z - p.z;
      const dist = Math.hypot(ex, ez);
      const min = p.radius + BODY_RADIUS;
      if (dist < min && dist > 1e-4) {
        body.pos.x = p.x + (ex / dist) * min;
        body.pos.z = p.z + (ez / dist) * min;
      }
    }
  };

  useFrame(({ clock }) => {
    const d = Math.min(clock.getDelta(), 0.12);
    const t = clock.elapsedTime;
    const rig = rigRef.current;
    const yaw = yawRef.current;
    const pitch = pitchRef.current;
    const look = lookRef.current;

    if (phase === 'entry') {
      if (!entryArmedRef.current) {
        entryArmedRef.current = true;
        entryTRef.current = 0;
      }
      entryTRef.current += d;
      const p = THREE.MathUtils.clamp(entryTRef.current / 8.5, 0, 1);
      useGalleryStore.getState().setEntryProgress(p);
      const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

      rig.position.z = 66 - eased * 66;
      rig.position.y = Math.sin(p * Math.PI * 1.6) * 0.9 * (1 - p) + 0.1;
      look.targetPitch = Math.sin(p * Math.PI * 2.2) * 0.12 * (1 - p);

      if (p >= 1) {
        useGalleryStore.getState().setPhase('hub');
        rig.position.copy(HUB_CAMERA_POS);
        entryArmedRef.current = false;
      }
    } else if (phase === 'warp') {
      look.targetYaw += d * 1.4;
    } else if (phase === 'corridor') {
      const store = useGalleryStore.getState();
      const { walkProgress, corridorLength, freeWalk, bounds, currentStation } = store;

      /* The rail position is always integrated, so stepping between modes never teleports. */
      corridorWalkRef.current = reducedMotion
        ? walkProgress
        : THREE.MathUtils.damp(corridorWalkRef.current, walkProgress, 3.2, d);
      const railZ = CORRIDOR_START_Z - corridorWalkRef.current * corridorSpan(corridorLength);

      /* A body belongs to one wing; a new wing is a new place to stand. */
      if (bodyWingIdRef.current !== currentStation?.id) {
        bodyWingIdRef.current = currentStation?.id ?? null;
        bodyRef.current.active = false;
        carryTargetRef.current = null;
      }

      if (freeWalk && bounds) {
        integrateBody(d, rig, bounds, railZ);
      } else {
        bodyRef.current.active = false;
        rig.position.x = 0;
        rig.position.y = 0;
        rig.position.z = railZ;
        /*
         * On the rail, the visitor's own drag-look stands; the head reset that used to live
         * here fought it. The line's glide stays readable because the drag handler is the
         * only thing writing the look while the body is away.
         */
      }
    }

    if (phase === 'hub' || phase === 'warp') {
      rig.position.y = HUB_CAMERA_POS.y + Math.sin(t * 0.6) * 0.045;
    }

    look.yaw += (look.targetYaw - look.yaw) * THREE.MathUtils.clamp(d * 7, 0, 1);
    look.pitch += (look.targetPitch - look.pitch) * THREE.MathUtils.clamp(d * 7, 0, 1);
    yaw.rotation.y = look.yaw;
    pitch.rotation.x = look.pitch;

    if (reducedMotion) {
      look.targetYaw = look.yaw;
      look.targetPitch = look.pitch;
    }
    /*
     * Priority 0 on purpose. A positive priority tells react-three-fiber to stop rendering on
     * its own and leaves it to whoever owns that priority — which is the post-processing
     * composer, and nothing at all when the visitor has asked for reduced motion. That made the
     * canvas come up blank for exactly the people who asked for the calmer version.
     */
  }, 0);

  return null;
}

/** Damp an angle towards a target without taking the long way round. */
function dampAngle(current: number, target: number, blend: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * THREE.MathUtils.clamp(blend, 0, 1);
}
