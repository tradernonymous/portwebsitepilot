import { useCallback, useEffect, useRef, useState } from 'react';
import { useLang } from '../../lib/lang';
import { bindDoorway } from '../../lib/doorway';
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
 * Three rules keep it from becoming a tax on navigation:
 *
 *  - It only exists where a fine pointer is in use. On a touch screen an extra third of a
 *    second before a tap does anything reads as a broken tap, not as a door.
 *  - It only takes links that stay inside the gallery (`#/…`). Off-site links, modifier
 *    clicks, middle clicks and downloads are the browser's business and are left alone.
 *  - A room panel grows its own cover across the screen. That is already a door, so those
 *    links are skipped rather than being given two in a row.
 */
type Phase = 'idle' | 'closing' | 'opening';

/** Long enough for the swapped page to have rendered behind the closed doors. */
const HOLD = Math.round(DUR.quick * 0.8);

function fitsFinePointer(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function Doorway() {
  const { t } = useLang();
  const [phase, setPhase] = useState<Phase>('idle');
  const [enabled] = useState(fitsFinePointer);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);

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
      busy.current = true;
      setPhase('closing');
      timers.current.push(
        window.setTimeout(() => {
          action();
          timers.current.push(
            window.setTimeout(() => {
              setPhase('opening');
              timers.current.push(
                window.setTimeout(() => {
                  setPhase('idle');
                  busy.current = false;
                }, DUR.base),
              );
            }, HOLD),
          );
        }, DUR.base),
      );
    },
    [enabled],
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
      event.preventDefault();
      open(() => {
        window.location.hash = href;
      });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [enabled, open]);

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
