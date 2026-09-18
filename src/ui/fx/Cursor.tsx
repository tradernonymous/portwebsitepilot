import { useEffect, useRef, useState } from 'react';
import type { I18nKey } from '../../content/i18n';
import { onFrame } from '../../lib/frame';
import { useLang } from '../../lib/lang';

/**
 * The curator's pointer.
 *
 * The sites this gallery is measured against lead with their cursor: a small bright point
 * with a ring that settles behind it, and the ring changing what it promises as the pointer
 * crosses the gallery — OPEN on a door, WALK on a corridor, ← / → on the pager. That is the
 * one layer of chrome the visitor always sees, so it is worth handing it the language the
 * rest of the space already speaks.
 *
 * A few rules keep it honest:
 *
 *  - It only exists where a fine pointer can be relied on (hover: hover, pointer: fine), so
 *    a trackpad-and-cursor visit gets it and a finger never does. The native cursor is hidden
 *    only while the custom one is actually there to replace it.
 *  - Reduced motion turns it back into a plain cursor. Following is motion too.
 *  - It never takes the pointer (`pointer-events: none`), so nothing underneath changes.
 *  - The label is decorative (`aria-hidden`) and only ever restates what the focused element
 *    already says for itself.
 *
 * The follow is two-stage: the dot rides the pointer, the ring catches up on the shared frame
 * clock, so the page and the ring settle to the same tempo.
 */

type CursorMode =
  | 'enter'
  | 'open'
  | 'close'
  | 'prev'
  | 'next'
  | 'walk'
  | 'read'
  | 'play'
  | 'drag'
  | 'esc'
  | 'view';

const KEY: Record<CursorMode, I18nKey> = {
  enter: 'cursorEnter',
  open: 'cursorOpen',
  close: 'cursorClose',
  prev: 'cursorPrev',
  next: 'cursorNext',
  walk: 'cursorWalk',
  read: 'cursorRead',
  play: 'cursorPlay',
  drag: 'cursorDrag',
  esc: 'cursorEsc',
  view: 'cursorView',
};

const MODES = Object.keys(KEY) as CursorMode[];

/** Anything you can click becomes a target for the ring. */
const INTERACTIVE =
  'a, button, [role="button"], summary, input, select, textarea, [tabindex]:not([tabindex="-1"]), .work, .rail-item';
/** A short list of high-value controls that pull the cursor into them. */
const MAGNETIC =
  '.btn-glow, .room-panel-enter, .onview-card, .pager-link, .threshold-film, .video-card, .menu-room';

function fitsFinePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function Cursor() {
  const { t } = useLang();
  const [enabled] = useState(fitsFinePointer);
  const [mode, setMode] = useState<CursorMode | null>(null);
  const [hover, setHover] = useState(false);
  const [magnetic, setMagnetic] = useState(false);
  const [gallery, setGallery] = useState(false);

  const dotRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  /* Where the pointer actually is. Refs, so the frame loop reads them without re-rendering. */
  const target = useRef({ x: -100, y: -100 });
  /* Where the ring is settling toward. */
  const rest = useRef({ x: -100, y: -100, scale: 1 });
  /* The scale the ring wants to reach. */
  const reach = useRef(1);
  /* A magnetic control's centre, when one is under the pointer. */
  const magnet = useRef<{ x: number; y: number; scale: number } | null>(null);
  /* The last time the pointer moved — the cursor retires after a still moment, like a torch let go. */
  const alive = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const onMotion = () => {
      document.documentElement.classList.toggle('has-cursor', !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    };
    onMotion();
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', onMotion);

    const onMove = (event: PointerEvent) => {
      target.current.x = event.clientX;
      target.current.y = event.clientY;
      alive.current = performance.now();
      const dot = dotRef.current;
      if (dot) dot.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
    };

    /** What the element under the pointer wants the cursor to say and do. */
    const sense = (el: Element | null) => {
      let node: Element | null = el;
      let named: CursorMode | null = null;
      let interactive = false;
      let magneticPoint = false;
      for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
        if (!interactive && node.matches(INTERACTIVE)) interactive = true;
        if (!magneticPoint && node.matches(MAGNETIC)) magneticPoint = true;
        if (!named && node.hasAttribute('data-cursor')) {
          const value = node.getAttribute('data-cursor') as CursorMode;
          if (MODES.includes(value)) named = value;
        }
        if (named && interactive) break;
      }
      const rect = magneticPoint && el ? el.closest(MAGNETIC)?.getBoundingClientRect() : undefined;
      magnet.current = rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, scale: 2.6 }
        : null;
      return { named, interactive: interactive || magneticPoint, magnetic: magneticPoint };
    };

    const onOver = (event: PointerEvent) => {
      const { named, interactive, magnetic: pulls } = sense(event.target as Element | null);
      setMode(named);
      setHover(interactive);
      setMagnetic(pulls);
      reach.current = pulls ? 2.6 : named ? 2.1 : interactive ? 1.55 : 1;
    };

    const onOut = (event: PointerEvent) => {
      const to = event.relatedTarget as Node | null;
      // leaving into another interactive element is not leaving at all
      if (to instanceof Element && to.closest(INTERACTIVE)) return;
      setMode(null);
      setHover(false);
      setMagnetic(false);
      magnet.current = null;
      reach.current = 1;
    };

    const body = document.body;
    const styles = new MutationObserver(() => setGallery(body.classList.contains('is-gallery')));
    styles.observe(body, { attributes: true, attributeFilter: ['class'] });
    setGallery(body.classList.contains('is-gallery'));

    const stop = onFrame((now, _dt, elapsed) => {
      if (performance.now() - alive.current > 4000) return;
      const ease = 1 - Math.pow(0.0005, now / 1000);
      const r = rest.current;

      // a magnetic control pulls the ring's destination toward its own centre
      let tx = target.current.x;
      let ty = target.current.y;
      if (magnet.current) {
        const mx = magnet.current.x - tx;
        const my = magnet.current.y - ty;
        const pull = Math.min(1, Math.hypot(mx, my) / 180);
        tx += mx * pull * 0.32;
        ty += my * pull * 0.32;
      }

      r.x += (tx - r.x) * ease;
      r.y += (ty - r.y) * ease;
      r.scale += (reach.current - r.scale) * (1 - Math.pow(0.1, now / 1000));

      const ring = ringRef.current;
      if (ring) {
        ring.style.transform = `translate3d(${r.x}px, ${r.y}px, 0) translate(-50%, -50%) scale(${r.scale.toFixed(3)})`;
        ring.style.setProperty('--rot', `${elapsed * 24}deg`);
      }
      const labelEl = labelRef.current;
      if (labelEl) labelEl.style.transform = `translate3d(${target.current.x + 22}px, ${target.current.y - 22}px, 0)`;
    });

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onOver, { passive: true });
    document.addEventListener('pointerout', onOut, { passive: true });

    return () => {
      stop();
      styles.disconnect();
      mq.removeEventListener('change', onMotion);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.documentElement.classList.remove('has-cursor');
    };
  }, [enabled]);

  if (!enabled) return null;

  const labelText = mode ? (mode === 'prev' || mode === 'next' ? KEY[mode] : t(KEY[mode])) : null;

  return (
    <div
      className={`cursor${hover ? ' is-hover' : ''}${mode ? ' is-named' : ''}${magnetic ? ' is-magnetic' : ''}${gallery ? ' is-gallery' : ''}`}
      aria-hidden="true"
    >
      <span ref={dotRef} className="cursor-dot" />
      <span ref={ringRef} className="cursor-ring" />
      {labelText ? (
        <span ref={labelRef} className="cursor-label">
          {labelText}
        </span>
      ) : null}
    </div>
  );
}