import { useThree, useFrame } from '@react-three/fiber';
import { useGalleryStore } from './galleryStore';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

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

export function GalleryCamera({ reducedMotion }: { reducedMotion: boolean }) {
  const { camera, scene, raycaster, gl } = useThree();
  const { phase } = useGalleryStore();
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
      const { walkProgress, corridorLength } = useGalleryStore.getState();
      corridorWalkRef.current = reducedMotion
        ? walkProgress
        : THREE.MathUtils.damp(corridorWalkRef.current, walkProgress, 3.2, d);
      rig.position.z = CORRIDOR_START_Z - corridorWalkRef.current * corridorSpan(corridorLength);
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