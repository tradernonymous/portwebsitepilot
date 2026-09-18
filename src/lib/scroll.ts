import { useEffect, type RefObject } from 'react';
import { onFrame } from './frame';

/**
 * The scroll engine.
 *
 * The sites this gallery is measured against glide rather than jump — the page carries
 * momentum and settles. That is what makes the scroll-linked light read as one continuous
 * movement instead of a series of positions, so the gliding and the light are one system:
 * the same frame that moves the page is the frame that tells the light how fast it is going.
 *
 * What it will not do is take over scrolling it should not own. Native scrolling is kept for
 * touch (where the platform's own momentum is better than anything here), for a visitor who
 * has asked for reduced motion, and for any pane that scrolls itself — the reader, above all.
 * Keyboard, anchors and programmatic jumps are not intercepted at all; they are adopted.
 */

export type ScrollState = {
  /** Position on screen, after the glide. */
  y: number;
  /** Furthest the document can scroll. */
  max: number;
  /** Pixels per second, signed. */
  velocity: number;
  /** 0-1 through the document. */
  progress: number;
  /** 0-1 how hard the visitor is moving, for anything that reacts to speed. */
  speed: number;
};

const state: ScrollState = { y: 0, max: 0, velocity: 0, progress: 0, speed: 0 };

/**
 * The live scroll state. Read it, do not keep it: the object is mutated in place every frame
 * so that nothing allocates.
 */
export function getScrollState(): ScrollState {
  return state;
}

type Engine = {
  to: (y: number, smooth: boolean) => void;
  settling: () => boolean;
};

let engine: Engine | null = null;
let dispose: (() => void) | null = null;

/** How far a full-speed scroll is assumed to travel, for turning velocity into 0-1. */
const SPEED_REFERENCE = 2200;
/** The fraction of the remaining distance the glide closes each frame at 60fps. */
const GLIDE = 0.9;

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

/**
 * A pane that scrolls itself keeps its own wheel — walking the reader with the wheel must
 * scroll the text, not the hall underneath it.
 */
function ownerOfWheel(target: EventTarget | null): Element | null {
  let el = target instanceof Element ? target : null;
  for (let depth = 0; el && depth < 10; depth += 1, el = el.parentElement) {
    if (el.getAttribute('role') === 'dialog') return el;
    const overflowY = getComputedStyle(el).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
      return el;
    }
  }
  return null;
}

/** Move the page. Goes through the engine's glide when there is one, so nothing fights it. */
export function scrollToY(y: number, smooth = true): void {
  const top = Math.max(0, y);
  if (!engine) {
    window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
    return;
  }
  engine.to(top, smooth);
}

/** True while a glide is still being carried out — a scroll event now is the engine's own. */
export function scrollSettling(): boolean {
  return engine ? engine.settling() : false;
}

export function startScrollEngine(reducedMotion: boolean): () => void {
  dispose?.();

  const glides =
    !reducedMotion &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

  let target = window.scrollY;
  let current = target;
  /** The last value we wrote, so our own scroll events can be told from everyone else's.
   *  It must always hold a real position: NaN would make every comparison against it
   *  false, and the engine would never write a scroll again. */
  let written = window.scrollY;
  /**
   * When the frame loop last ran.
   *
   * Every path that would take the page over checks this first. If frames have stalled — a
   * throttled tab, a webview that never pumps, a page the browser has frozen — the engine steps
   * aside and lets the platform scroll normally. Without the check, holding the page open while
   * cancelling the browser's own scrolling would leave a page that cannot be scrolled at all,
   * which is a far worse failure than losing a glide.
   */
  let lastTick = 0;
  const alive = () => performance.now() - lastTick < 250;

  state.y = current;
  state.max = maxScroll();

  /**
   * Keyboard, anchors, browser scroll restoration and deep links all move the page without
   * asking. The engine follows them instead of dragging the page back.
   */
  const adopt = (y: number) => {
    target = y;
    current = y;
    written = y;
  };

  const onScroll = () => {
    if (Math.abs(window.scrollY - written) < 2) return;
    adopt(window.scrollY);
  };

  const onResize = () => {
    state.max = maxScroll();
    if (target > state.max) target = state.max;
  };

  const onWheel = (event: WheelEvent) => {
    if (!glides || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (ownerOfWheel(event.target)) return;
    /* Only take the wheel over if there is a loop running to carry it out. */
    if (!alive()) return;
    event.preventDefault();
    // deltaMode: 0 pixels, 1 lines, 2 pages. Firefox still reports lines.
    const delta =
      event.deltaMode === 1
        ? event.deltaY * 16
        : event.deltaMode === 2
          ? event.deltaY * window.innerHeight * 0.9
          : event.deltaY;
    const max = maxScroll();
    target = clamp(target + delta, 0, max);
  };

  const stopFrames = onFrame((_now, dt) => {
    lastTick = performance.now();
    const max = maxScroll();
    target = clamp(target, 0, max);

    const before = current;
    if (glides) {
      const gap = target - current;
      if (Math.abs(gap) < 0.4) current = target;
      else current += gap * (1 - Math.pow(GLIDE, dt * 60));
      if (Math.abs(current - written) > 0.01) {
        written = current;
        window.scrollTo(0, current);
      }
    } else {
      current = window.scrollY;
    }

    const measured = dt > 0 ? (current - before) / dt : 0;
    state.velocity += (measured - state.velocity) * 0.2;
    if (Math.abs(state.velocity) < 2) state.velocity = 0;
    state.y = current;
    state.max = max;
    state.progress = max > 0 ? clamp(current / max, 0, 1) : 0;
    state.speed = clamp(Math.abs(state.velocity) / SPEED_REFERENCE, 0, 1);
  });

  const instance: Engine = {
    to(y, smooth) {
      const top = clamp(y, 0, maxScroll());
      if (!glides || !smooth || !alive()) {
        /*
         * Every reason to take this branch is a reason not to ask for a smooth scroll: with no
         * frame loop running, an animated scroll never progresses and the page simply does not
         * move. Arriving instantly is a worse experience than gliding there, but it is the
         * correct one — the visitor asked to go somewhere, and this goes there.
         */
        target = top;
        current = top;
        written = top;
        window.scrollTo({ top, behavior: 'auto' });
        return;
      }
      target = top;
    },
    /*
     * Nothing is settling when there is no glide — or when nothing is alive to carry one out.
     * `current` only converges inside the frame loop, so with frames stalled the distance would
     * never close and anything waiting on the settle would wait forever. A stalled engine is
     * not settling; it has stepped aside, and the page is wherever the platform put it.
     */
    settling: () => glides && alive() && Math.abs(target - current) > 0.5,
  };

  engine = instance;
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('wheel', onWheel, { passive: false });

  const teardown = () => {
    stopFrames();
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('wheel', onWheel);
    if (engine === instance) engine = null;
  };
  dispose = teardown;
  return teardown;
}

/**
 * One watch on the page's layout, shared by every depth layer.
 *
 * Each layer needs to know where it sits in the document, and that only changes when the page
 * reflows — so a hall with a depth layer per room would have had eleven observers on the same
 * element and eleven resize listeners all doing the same job. They register a callback here
 * instead, and the watch itself exists only while something is listening.
 */
const remeasure = new Set<() => void>();
let layoutObserver: ResizeObserver | null = null;

function onLayoutChange(recheck: () => void): () => void {
  remeasure.add(recheck);
  if (!layoutObserver && typeof ResizeObserver !== 'undefined') {
    layoutObserver = new ResizeObserver(() => {
      for (const recheck of remeasure) recheck();
    });
    layoutObserver.observe(document.documentElement);
    window.addEventListener('resize', relayout);
  }
  return () => {
    remeasure.delete(recheck);
    if (!remeasure.size && layoutObserver) {
      layoutObserver.disconnect();
      layoutObserver = null;
      window.removeEventListener('resize', relayout);
    }
  };
}

function relayout() {
  for (const recheck of remeasure) recheck();
}

/**
 * Depth: how far a layer drifts against the page as it passes.
 *
 * Writes one custom property, `--depth`, in pixels, onto the element the ref points at. It
 * measures that element and not the layers themselves, so the measurement can never be
 * disturbed by the offset it just applied. The measurement is refreshed on resize and
 * whenever the document's height changes; the per-frame work is arithmetic and one style
 * write, with no layout read at all.
 *
 * Layers move *less* than the page around them, which is what reads as distance. Pair it
 * with `.depth-layer` in the stylesheet, which gives the layer the room to drift into.
 */
export function useDepth(
  ref: RefObject<HTMLElement | null>,
  speed: number,
  reducedMotion: boolean,
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion || speed === 0) return;

    let centre = 0;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      centre = rect.top + window.scrollY + rect.height / 2;
    };
    measure();
    const unwatch = onLayoutChange(measure);

    const stop = onFrame(() => {
      const viewport = window.innerHeight || 1;
      const drift = clamp((getScrollState().y + viewport / 2 - centre) / viewport, -1, 1);
      el.style.setProperty('--depth', `${(drift * speed * viewport).toFixed(2)}px`);
    });

    return () => {
      stop();
      unwatch();
      el.style.removeProperty('--depth');
    };
  }, [ref, speed, reducedMotion]);
}
