import { useEffect } from 'react';
import { onFrame } from './frame';
import { getScrollState } from './scroll';

/**
 * The mood of the room you are standing in.
 *
 * Every room already carries an accent — the colour of its own cover, its own light. Indoors
 * that colour is everywhere: the wall you are facing tints the whole space. On the page it was
 * confined to the room's own card, so walking the corridor past eight rooms looked like one
 * long grey wall with eight coloured rectangles on it.
 *
 * This reads the `[data-mood]` elements the walk is built from and publishes the colour of
 * whichever one the visitor is actually standing in front of, blended by how present each is.
 * Two rooms either side of the reading line mix while the visitor is between them, so the
 * light changes as they move rather than switching as they cross a boundary.
 *
 * It is deliberately cheap. The measurements are only taken while the page is actually moving
 * — at rest, nothing is read and nothing is written — and the colour is eased toward its
 * target rather than assigned, so a hard scroll cannot make the room flash.
 */

export const MOOD_ATTRIBUTE = 'data-mood';

type Rgb = [number, number, number];

function parse(hex: string): Rgb | null {
  const clean = hex.trim().replace('#', '');
  if (clean.length !== 3 && clean.length !== 6) return null;
  const full = clean.length === 3 ? clean.replace(/./g, '$&$&') : clean;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * How present an element is, as 0-1.
 *
 * The test is the reading line — the middle of the screen — not the element's centre, so it
 * works for a room a dozen screens tall and for a single panel alike: while the line is inside
 * the element it owns the mood, and it hands over gradually as the line leaves. Two neighbours
 * are both fully present at the moment the line crosses between them, which is what makes the
 * change a blend rather than a switch.
 */
function presence(rect: DOMRect, viewport: number): number {
  const line = viewport / 2;
  if (line >= rect.top && line <= rect.bottom) return 1;
  const away = line < rect.top ? rect.top - line : line - rect.bottom;
  return Math.max(0, 1 - away / (viewport * 0.6));
}

/**
 * Mount once, for the whole app. It owns no markup: it only publishes three numbers, and the
 * `.mood` layer in the stylesheet is what the visitor actually sees.
 */
export function useRoomMood(): void {
  useEffect(() => {
    const root = document.documentElement;
    let stopFrames: (() => void) | null = null;
    /** The colour on screen, eased toward what the rooms ask for. */
    const shown: Rgb = [139, 92, 255];
    let live = false;

    const write = (rgb: Rgb) => {
      root.style.setProperty('--mood-r', String(Math.round(rgb[0])));
      root.style.setProperty('--mood-g', String(Math.round(rgb[1])));
      root.style.setProperty('--mood-b', String(Math.round(rgb[2])));
    };

    const tick = (_now: number, dt: number) => {
      const moving = getScrollState().speed > 0.005;
      const target: Rgb = [0, 0, 0];
      let weight = 0;

      if (moving) {
        const viewport = window.innerHeight || 1;
        for (const el of document.querySelectorAll<HTMLElement>(`[${MOOD_ATTRIBUTE}]`)) {
          const colour = parse(el.getAttribute(MOOD_ATTRIBUTE) ?? '');
          if (!colour) continue;
          const p = presence(el.getBoundingClientRect(), viewport);
          if (p <= 0) continue;
          target[0] += colour[0] * p;
          target[1] += colour[1] * p;
          target[2] += colour[2] * p;
          weight += p;
        }
      }

      if (weight > 0) {
        target[0] /= weight;
        target[1] /= weight;
        target[2] /= weight;
      } else {
        /* nothing on screen to answer to: hold where the light already is */
        target[0] = shown[0];
        target[1] = shown[1];
        target[2] = shown[2];
      }

      const ease = Math.min(1, dt * 3.2);
      let settled = true;
      for (let i = 0; i < 3; i += 1) {
        const gap = target[i] - shown[i];
        if (Math.abs(gap) > 0.4) settled = false;
        shown[i] += gap * ease;
      }
      write(shown);

      /* At rest, with the colour settled, there is nothing left to do — let the clock go. */
      if (!moving && settled) {
        stopFrames?.();
        stopFrames = null;
      }
    };

    const start = () => {
      if (!stopFrames) stopFrames = onFrame(tick);
    };

    const onScroll = () => {
      if (!live) return;
      start();
    };

    write(shown);
    live = true;
    window.addEventListener('scroll', onScroll, { passive: true });
    start();

    return () => {
      live = false;
      window.removeEventListener('scroll', onScroll);
      stopFrames?.();
      root.style.removeProperty('--mood-r');
      root.style.removeProperty('--mood-g');
      root.style.removeProperty('--mood-b');
    };
  }, []);
}
