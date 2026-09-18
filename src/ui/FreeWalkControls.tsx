import { useEffect, useRef, useState } from 'react';
import { useGalleryStore } from '../experience/r3f/galleryStore';
import { moveInput, clearInput } from '../experience/r3f/input';
import { useLang } from '../lib/lang';

/**
 * The walk's mode toggle: rail or body. On a mouse it also takes the pointer lock, so the
 * same gesture that frees your legs frees your head; leaving the lock keeps the body — the
 * visitor may just want the wheel back for a moment — and the rail's wheel still moves the
 * line even with a body standing in the wing.
 */
export function FreeWalkToggle({ coarse }: { coarse: boolean }) {
  const { t } = useLang();
  const freeWalk = useGalleryStore((s) => s.freeWalk);
  const setFreeWalk = useGalleryStore((s) => s.setFreeWalk);
  const [error, setError] = useState(false);

  const toggle = () => {
    setError(false);
    if (freeWalk) {
      if (document.pointerLockElement) document.exitPointerLock();
      setFreeWalk(false);
      return;
    }
    setFreeWalk(true);
    if (!coarse) {
      const canvas = document.querySelector('.walk canvas');
      const request = canvas?.requestPointerLock?.bind(canvas);
      try {
        const maybe = request?.();
        if (maybe && typeof (maybe as unknown as Promise<void>).catch === 'function') {
          (maybe as unknown as Promise<void>).catch(() => setError(true));
        }
      } catch {
        setError(true);
      }
    }
  };

  return (
    <>
      <button
        type="button"
        className={`freewalk-toggle${freeWalk ? ' is-on' : ''}`}
        onClick={toggle}
        aria-pressed={freeWalk}
      >
        {t(freeWalk ? 'freeWalkOff' : 'freeWalkOn')}
      </button>
      {error ? <p className="freewalk-error" role="status">{t('freeWalkError')}</p> : null}
    </>
  );
}

/**
 * The free walk's handheld controls: a thumb stick to move by, and a toggle that lets the
 * device itself turn the head. Both exist only while a body is active — on the rail, a phone
 * visitor has the swipe gestures they already had.
 *
 * The stick is deliberately small and sits bottom-left, clear of the rail's sheet along the
 * bottom edge; it writes the shared input and owns no state of its own beyond which knob is
 * being held. iOS asks permission for motion sensors and must be answered from a tap, which
 * is why the gyro toggle requests it inside its own click.
 */
export function FreeWalkControls({ coarse }: { coarse: boolean }) {
  const { t } = useLang();
  const freeWalk = useGalleryStore((s) => s.freeWalk);
  const gyroLook = useGalleryStore((s) => s.gyroLook);
  const setGyroLook = useGalleryStore((s) => s.setGyroLook);
  const stickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const [gyroError, setGyroError] = useState(false);

  useEffect(() => {
    if (!freeWalk) {
      clearInput();
      activePointer.current = null;
    }
  }, [freeWalk]);

  useEffect(() => () => clearInput(), []);

  if (!freeWalk || !coarse) return null;

  const onStickDown = (event: React.PointerEvent) => {
    event.preventDefault();
    activePointer.current = event.pointerId;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    moveFromEvent(event);
  };

  const onStickMove = (event: React.PointerEvent) => {
    if (activePointer.current !== event.pointerId) return;
    event.preventDefault();
    moveFromEvent(event);
  };

  const onStickUp = (event: React.PointerEvent) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    moveInput.x = 0;
    moveInput.y = 0;
    if (knobRef.current) knobRef.current.style.transform = 'translate(-50%, -50%)';
  };

  /** The stick reads as an offset from its centre, clamped to its own radius. */
  const moveFromEvent = (event: React.PointerEvent) => {
    const stick = stickRef.current;
    if (!stick) return;
    const rect = stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const max = rect.width / 2;
    let dx = event.clientX - cx;
    let dy = event.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > max) {
      dx = (dx / dist) * max;
      dy = (dy / dist) * max;
    }
    moveInput.x = dx / max;
    moveInput.y = -dy / max;
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
  };

  const toggleGyro = async () => {
    setGyroError(false);
    /*
     * iOS gates motion sensors behind an explicit permission ask, which must run inside the
     * tap. Everywhere else the plain event either exists or does not.
     */
    const motion = (window as unknown as {
      DeviceOrientationEvent?: { requestPermission?: () => Promise<'granted' | 'denied'> };
    }).DeviceOrientationEvent;
    if (motion?.requestPermission) {
      try {
        const answer = await motion.requestPermission();
        if (answer !== 'granted') {
          setGyroError(true);
          return;
        }
      } catch {
        setGyroError(true);
        return;
      }
    }
    setGyroLook(!gyroLook);
  };

  return (
    <>
      <div
        ref={stickRef}
        className="joystick"
        onPointerDown={onStickDown}
        onPointerMove={onStickMove}
        onPointerUp={onStickUp}
        onPointerCancel={onStickUp}
      >
        <div ref={knobRef} className="joystick-knob" />
      </div>
      <button
        type="button"
        className={`gyro-toggle${gyroLook ? ' is-on' : ''}`}
        onClick={toggleGyro}
        aria-pressed={gyroLook}
      >
        {t('gyroLook')}
      </button>
      {gyroError ? <p className="gyro-error">{t('gyroDenied')}</p> : null}
    </>
  );
}
