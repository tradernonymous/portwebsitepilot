import { useCallback, useEffect, useRef, useState } from 'react';

/** What the readout needs to describe where the visitor is standing. */
export type GalleryPosition = {
  /** Zero-based; the readout adds one. */
  index: number;
  total: number;
  label: string;
  group: string;
  href: string;
};

export type GalleryStop = {
  index: number;
  /** The stop's own name — a room, or a chapter. */
  label: string;
  /** What the stop belongs to, for the readout's context line. */
  group: string;
  /** Where Enter goes. Empty for a stop that is only somewhere to stand. */
  href: string;
  el: HTMLElement;
};

/**
 * Anything that can be walked is marked `data-stop` in the markup.
 *
 * Reading the stops out of the document rather than passing a list down means the mode works
 * identically on the hall and inside a room, with no shared state and nothing to keep in
 * sync: mark it up and it is walkable.
 *
 *   data-stop          marks the element
 *   data-stop-label    its name, for the readout
 *   data-stop-group    what it belongs to, for the readout's context line
 *   data-stop-href     where Enter goes, when the stop is not already a link itself
 *
 * A stop that *is* a link needs no `data-stop-href` — its own href is the destination. That
 * keeps a works wall walkable by adding one attribute per work rather than repeating the URL.
 */
const SELECTOR = '[data-stop]';

function destination(el: HTMLElement): string {
  if (el.dataset.stopHref) return el.dataset.stopHref;
  return el instanceof HTMLAnchorElement ? el.getAttribute('href') ?? '' : '';
}

function readStops(): GalleryStop[] {
  return Array.from(document.querySelectorAll<HTMLElement>(SELECTOR)).map((el, index) => ({
    index,
    label: el.dataset.stopLabel ?? el.id,
    group: el.dataset.stopGroup ?? '',
    href: destination(el),
    el,
  }));
}

/** The stop the visitor is actually looking at: the last one whose top has crossed the reading line. */
function nearest(stops: GalleryStop[]): number {
  const line = window.innerHeight * 0.38;
  let at = 0;
  for (const stop of stops) {
    if (stop.el.getBoundingClientRect().top <= line) at = stop.index;
  }
  return at;
}

/**
 * Gallery mode: walk the gallery with the arrow keys, with a readout saying where you are.
 *
 * Arrow keys are only taken over while the mode is on, so ordinary scrolling still behaves
 * normally the rest of the time. A dialog wins — while a work is open the reader owns the
 * keys, and the mode stands down rather than fighting it.
 */
export function useGalleryWalk(options: {
  active: boolean;
  /**
   * Re-reads the stops whenever this changes. It must cover everything that changes what the
   * stops *are* or what they are *called* — the page, so the walk continues into a room, and
   * the language, so a stop renamed by the toggle is not still wearing its old name.
   */
  stopKey: string;
  reducedMotion: boolean;
  onExit: () => void;
}) {
  const { active, stopKey, reducedMotion, onExit } = options;
  const stopsRef = useRef<GalleryStop[]>([]);
  /**
   * The cursor lives in a ref as well as in state. State alone would not do: keydown handlers
   * are bound once and several presses can land inside a single React render, so every one of
   * them would read the same stale position and the walk would crawl. The ref is the truth;
   * the state only exists to re-render the readout.
   */
  const cursorRef = useRef(0);
  const [cursor, setCursor] = useState(0);
  const [total, setTotal] = useState(0);
  /** While a step is animating, scroll events are the animation talking, not the visitor. */
  const stepping = useRef(0);

  const place = useCallback((index: number) => {
    cursorRef.current = index;
    setCursor(index);
  }, []);

  const load = useCallback(() => {
    stopsRef.current = readStops();
    setTotal(stopsRef.current.length);
    place(stopsRef.current.length ? nearest(stopsRef.current) : 0);
  }, [place]);

  useEffect(() => {
    if (!active) {
      stopsRef.current = [];
      setTotal(0);
      place(0);
      return;
    }
    load();
  }, [active, stopKey, load, place]);

  const goTo = useCallback(
    (next: number) => {
      const stops = stopsRef.current;
      if (!stops.length) return;
      const target = stops[Math.max(0, Math.min(stops.length - 1, next))];
      place(target.index);
      stepping.current = performance.now() + 800;
      target.el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    },
    [place, reducedMotion],
  );

  /* A dialog owns the keyboard; the mode stands down until it is gone. */
  const blocked = () => Boolean(document.querySelector('[role="dialog"]'));

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      // never take a key the browser or the OS was going to use
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (blocked()) return;
      const stops = stopsRef.current;
      if (!stops.length) return;

      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault();
          goTo(cursorRef.current + 1);
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault();
          goTo(cursorRef.current - 1);
          break;
        case 'Home':
          event.preventDefault();
          goTo(0);
          break;
        case 'End':
          event.preventDefault();
          goTo(stops.length - 1);
          break;
        case 'Enter': {
          const stop = stops[cursorRef.current];
          if (!stop?.href) return;
          event.preventDefault();
          window.location.hash = stop.href;
          break;
        }
        case 'Escape':
          event.preventDefault();
          onExit();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, goTo, onExit]);

  /* Scrolling by hand still moves the position, once the mode's own scrolling has stopped. */
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (performance.now() < stepping.current) return;
        const stops = stopsRef.current;
        if (!stops.length) return;
        const at = nearest(stops);
        if (at !== cursorRef.current) place(at);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [active, place]);

  const stop = stopsRef.current[cursor];
  return {
    /** Null until the stops have been read, or when there are none. */
    position:
      stop && total
        ? ({ index: cursor, total, label: stop.label, group: stop.group, href: stop.href } satisfies GalleryPosition)
        : null,
    /** Walking continues after a room is opened, so the new page's stops need reading. */
    reload: load,
  };
}
