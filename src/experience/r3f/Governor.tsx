import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGalleryStore } from './galleryStore';
import { loadQualityPref, saveQualityPref, stepDown, stepUp, DPR_FOR } from './quality';

/**
 * The performance governor.
 *
 * A gallery that stutters is a gallery people leave. This watches the real frame interval over
 * a rolling window and walks a three-rung ladder — low, mid, high — while the visitor's
 * preference is `auto`. A hand-picked level stands the sampler down entirely: a setting that
 * overrides its owner is a suggestion, not a setting.
 *
 * The ladder is deliberately coarse: each rung moves pixel ratio and ambient counts together,
 * because changes finer than that are not perceptible mid-walk. Only the worst quarter of the
 * window decides, so one hitch cannot downgrade the room, and recovery needs a longer settled
 * stretch than degradation did — a device that recovers its headroom earns it back, it does not
 * win it on one lucky frame.
 */
const WINDOW_MS = 4000;
const DOWN_AT_MS = 26; // sustained average above ~38 fps is asked to slow down
const UP_AT_MS = 14.5; // sustained average below ~69 fps earns more
const SETTLE_MS = 6000;
const DECIDE_EVERY_MS = 500;

export function Governor() {
  const gl = useThree((s) => s.gl);
  const quality = useGalleryStore((s) => s.quality);
  const qualityPref = useGalleryStore((s) => s.qualityPref);

  const frames = useRef<number[]>([]);
  const lastDecide = useRef(0);
  const lastChange = useRef(0);

  /* A stored hand-pick wins over auto on the first visit. */
  useEffect(() => {
    const pref = loadQualityPref();
    if (pref !== null && pref !== 'auto') {
      useGalleryStore.getState().setQualityPref(pref);
    }
  }, []);

  /* The visitor's preference is persisted the moment it is set, wherever it is set. */
  useEffect(() => {
    saveQualityPref(qualityPref);
  }, [qualityPref]);

  /* The level in force is applied to the renderer here, so no other component has to care. */
  useEffect(() => {
    const dpr = Math.min(DPR_FOR[quality], window.devicePixelRatio || 1);
    gl.setPixelRatio(dpr);
  }, [quality, gl]);

  useFrame(() => {
    if (useGalleryStore.getState().qualityPref !== 'auto') return;

    const now = performance.now();
    frames.current.push(now);
    const windowStart = now - WINDOW_MS;
    while (frames.current.length && frames.current[0] < windowStart) frames.current.shift();

    if (now - lastDecide.current < DECIDE_EVERY_MS) return;
    lastDecide.current = now;

    const times = frames.current;
    if (times.length < 8) return;

    /* The worst quarter of the window decides, so one hitch cannot downgrade the room. */
    const tail = times.slice(-Math.max(2, Math.floor(times.length / 4)));
    const avg = (tail[tail.length - 1] - tail[0]) / Math.max(1, tail.length - 1);

    const active = useGalleryStore.getState().quality;
    if (avg > DOWN_AT_MS) {
      const next = stepDown(active);
      if (next !== active) {
        useGalleryStore.getState().setQuality(next);
        lastChange.current = now;
        frames.current.length = 0;
      }
    } else if (avg < UP_AT_MS && now - lastChange.current > SETTLE_MS) {
      const next = stepUp(active);
      if (next !== active) {
        useGalleryStore.getState().setQuality(next);
        lastChange.current = now;
        frames.current.length = 0;
      }
    }
  });

  return null;
}
