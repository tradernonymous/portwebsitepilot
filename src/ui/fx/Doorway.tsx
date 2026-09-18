import { useCallback, useEffect, useRef, useState } from 'react';
import { announceDoorway, bindDoorway, type DoorwayPhase } from '../../lib/doorway';
import { useLang } from '../../lib/lang';
import { DUR } from '../../lib/motion';

/**
 * The doorway between rooms.
 *
 * A route change used to be a swap. The address changed, React replaced the page, and the
 * route veil covered the seam — which is why moving between rooms read as a page load rather
 * than as walking through the building. The veil can cover a seam, but it cannot make the
 * journey happen.
 *
 * This is the other half of the movement. Two dark leaves close over the page with the
 * gallery's light caught on their inner edges, the address changes while they are shut, and
 * they open onto the room that was asked for. The visitor passes through a door.
 *
 * Four rules keep it from becoming a tax on navigation:
 *
 *  - A touch screen gets a door too, but a shorter one. A phone had none at all before, which
 *    left the smaller screen with a plainer gallery than the larger one — the wrong way round.
 *    What makes a delayed tap feel broken is silence, not the delay, so the doors start moving
 *    on the tap itself and only the destination waits.
 *  - It only takes links that stay inside the gallery (`#/…`). Off-site links, modifier
 *    clicks, middle clicks and downloads are the browser's business and are left alone.
 *  - A room panel grows its own cover across the screen. That is already a door, so those
 *    links are skipped rather than being given two in a row.
 *  - Reduced motion gets none of it: the address changes at once.
 */

/** Long enough for the swapped page to have rendered behind the closed doors. */
const HOLD = Math.round(DUR.quick * 0.8);

type Timing = { close: number; hold: number; open: number };

/** A mouse can wait for a door; a thumb should not. */
function timingFor(touch: boolean): Timing {
  return touch
    ? { close: Math.round(DUR.quick * 1.1), hold: 60, open: Math.round(DUR.quick * 1.2) }
    : { close: DUR.base, hold: HOLD, open: DUR.base };
}

function motionAllowed(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function fitsFinePointer(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
  );
}

export function Doorway() {
  const { t } = useLang();
  const [phase, setPhase] = useState<DoorwayPhase>('idle');
  const [enabled] = useState(motionAllowed);
  const [fine] = useState(fitsFinePointer);
  const busy = useRef(false);
  const touch = useRef(false);
  const timers = useRef<number[]>([]);

  const go = useCallback((next: DoorwayPhase) => {
    setPhase(next);
    announceDoorway(next);
  }, []);

  /**
   * Take the visitor through. The action runs while the doors are shut, so whatever it does —
   * write the address, swap the page — happens out of sight and the doors open on the result.
   */
  const open = useCallback(
    (action: () => void) => {
      if (!enabled || busy.current) {
        action();
        return;
      }
      const beat = timingFor(touch.current);
      busy.current = true;
      go('closing');
      timers.current.push(
        window.setTimeout(() => {
          action();
          timers.current.push(
            window.setTimeout(() => {
              go('opening');
              timers.current.push(
                window.setTimeout(() => {
                  go('idle');
                  busy.current = false;
                }, beat.open),
              );
            }, beat.hold),
          );
        }, beat.close),
      );
    },
    [enabled, go],
  );

  useEffect(() => {
    bindDoorway(open);
    return () => bindDoorway(null);
  }, [open]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  /* Every in-gallery link, wherever it is written, comes through here. */
  useEffect(() => {
    if (!enabled) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const node = event.target;
      if (!(node instanceof Element)) return;
      const anchor = node.closest('a');
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href') ?? '';
      if (!href.startsWith('#/') || href === window.location.hash) return;
      if (anchor.closest('.room-panel')) return;
      /* A tap carries no pointer type on the click event, so the last input wins. */
      touch.current = !fine || window.matchMedia('(pointer: coarse)').matches;
      event.preventDefault();
      open(() => {
        window.location.hash = href;
      });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [enabled, fine, open]);

  if (!enabled) return null;

  return (
    <div className="doorway" data-phase={phase} aria-hidden="true">
      <span className="doorway-leaf is-left">
        <i className="doorway-edge" />
      </span>
      <span className="doorway-leaf is-right">
        <i className="doorway-edge" />
      </span>
      <span className="doorway-label">{t('doorKicker')}</span>
    </div>
  );
}
