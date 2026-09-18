import { useThree, useFrame } from '@react-three/fiber';
import { useGalleryStore } from './galleryStore';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const HUB_CAMERA_POS = new THREE.Vector3(0, 1.72, 0);
const HUB_RADIUS = 8.1;

export function GalleryCamera({ reducedMotion }: { reducedMotion: boolean }) {
  const { camera, scene, raycaster, pointer } = useThree();
  const { phase, focusedStationId, walkProgress } = useGalleryStore();
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
  const corridorTargetRef = useRef(0);
  const corridorLengthRef = useRef(0);

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
    camera.domElement.setPointerCapture?.(event.pointerId);
    draggingRef.current = true;
    movedRef.current = 0;
    const rect = camera.domElement.getBoundingClientRect();
    pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };

  const onPointerMove = (event: PointerEvent) => {
    const rect = camera.domElement.getBoundingClientRect();
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
    camera.domElement.releasePointerCapture?.(event.pointerId);
    if (!wasDragging || movedRef.current > 12) return;
    pick();
  };

  const onPointerLeave = () => {
    draggingRef.current = false;
  };

  const onWheel = (event: WheelEvent) => {
    if (phase === 'hub') return;
    walk(event.deltaY * 0.012);
  };

  useEffect(() => {
    const canvas = camera.domElement;
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
  }, [phase, camera]);

  const pick = () => {
    raycaster.setFromCamera(pointerRef.current, camera);
    // Picking is delegated to Deck/Corridor components via their own click handlers.
  };

  const walk = (delta: number) => {
    if (phase !== 'corridor') return;
    corridorTargetRef.current = THREE.MathUtils.clamp(
      corridorTargetRef.current + delta,
      0,
      Math.max(0, corridorLengthRef.current - 8)
    );
    useGalleryStore.getState().setWalkProgress(
      corridorLengthRef.current <= 0 ? 0 :
      THREE.MathUtils.clamp(corridorTargetRef.current / (corridorLengthRef.current - 8), 0, 1)
    );
  };

  useFrame(({ clock, delta }) => {
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
      corridorWalkRef.current = reducedMotion
        ? corridorTargetRef.current
        : THREE.MathUtils.damp(corridorWalkRef.current, corridorTargetRef.current, 3.2, d);
      rig.position.z = 4.6 + corridorWalkRef.current;
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
  }, 1);

  return null;
}