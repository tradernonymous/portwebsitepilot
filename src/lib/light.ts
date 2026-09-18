import { useEffect, type RefObject } from 'react';
import { onFrame } from './frame';

/**
 * The light the pointer carries.
 *
 * The gallery is lit, and the visitor is the one thing in it that moves with intent: a torch
 * in the hand, dragged across the wall. Every surface that answers to that needs the same
 * three numbers written in the same place, so they are computed once here instead of
 * re-derived per section:
 *
 *   --mx / --my   where the pointer is inside the surface, in percent
 *   --ml          how brightly the torch is burning, 0-1
 *
 * Brightness is the part that earns the effect. A light that simply teleports to the pointer
 * reads as a CSS trick; a light that flares while the hand moves and then settles back to a
 * resting glow reads as light. So `--ml` is driven by pointer speed and then decays on the
 * shared frame clock when the hand stops — and the frame subscription only exists while there
 * is something left to decay, so a section nobody is touching costs nothing.
 *
 * A touch pointer is not a torch, so it is left alone. Nor is a visitor who asked for reduced
 * motion: following is motion, and the light simply rests.
 */

/** How bright the torch is before anyone has moved it, and where it settles again. */
const REST = 0.34;
/** Pointer speed, in px/s, that counts as a full-throw flare. */
const FLARE = 2600;
/** Seconds of stillness before the decay loop lets go of the frame clock. */
const AFTERGLOW = 2.4;

export function usePointerLight(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window.matchMedia !== 'function') return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let lit = REST;
    el.style.setProperty('--ml', REST.toFixed(3));

    let stopFrames: (() => void) | null = null;
    let idle = 0;
    let lastX = 0;
    let lastY = 0;
    let lastAt = 0;
    let raf = 0;
    let pending: PointerEvent | null = null;

    const decay = (_now: number, dt: number) => {
      /* ease the torch back down to its resting glow */
      lit += (REST - lit) * Math.min(1, dt * 1.8);
      el.style.setProperty('--ml', lit.toFixed(3));
      if (performance.now() - idle > AFTERGLOW * 1000) {
        stopFrames?.();
        stopFrames = null;
      }
    };

    const apply = () => {
      raf = 0;
      const event = pending;
      pending = null;
      if (!event) return;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      el.style.setProperty('--mx', `${(((event.clientX - rect.left) / rect.width) * 100).toFixed(2)}%`);
      el.style.setProperty('--my', `${(((event.clientY - rect.top) / rect.height) * 100).toFixed(2)}%`);

      const now = performance.now();
      if (lastAt) {
        const travelled = Math.hypot(event.clientX - lastX, event.clientY - lastY);
        const speed = (travelled / Math.max(1, now - lastAt)) * 1000;
        const flare = REST + (1 - REST) * Math.min(1, speed / FLARE);
        /* rising instantly and falling slowly is what makes it read as light, not as a value */
        lit = Math.max(lit, flare);
      }
      lastX = event.clientX;
      lastY = event.clientY;
      lastAt = now;
      idle = now;
      el.style.setProperty('--ml', lit.toFixed(3));
      if (!stopFrames) stopFrames = onFrame(decay);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      pending = event;
      idle = performance.now();
      if (!raf) raf = requestAnimationFrame(apply);
    };

    el.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      stopFrames?.();
      el.removeEventListener('pointermove', onMove);
      el.style.removeProperty('--mx');
      el.style.removeProperty('--my');
      el.style.removeProperty('--ml');
    };
  }, [ref]);
}
