import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Station } from '../content';
import { Glyph } from './Glyph';

type TopBarProps = {
  crumb?: ReactNode;
  flat: boolean;
  onToggleFlat: () => void;
  onHelp: () => void;
};

export function TopBar({ crumb, flat, onToggleFlat, onHelp }: TopBarProps) {
  return (
    <header className="hud-top">
      <div className="brand">
        <strong>PORT</strong>
        <span>People Of Remarkable Talents · Perak</span>
      </div>
      <div className="hud-spacer" />
      {crumb ? <div className="crumb">{crumb}</div> : null}
      <div className="hud-tools">
        <button
          type="button"
          className="icon-btn"
          aria-pressed={flat}
          onClick={onToggleFlat}
          title={flat ? 'Kembali ke ruang 3D' : 'Lihat sebagai senarai biasa'}
          aria-label={flat ? 'Kembali ke ruang 3D' : 'Lihat sebagai senarai biasa'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            {flat ? (
              <path
                fill="currentColor"
                d="M12 2.6 1.8 9.1l10.2 6.5 10.2-6.5ZM4.6 12.4 12 17l7.4-4.6v3.9L12 21l-7.4-4.7Zm0 4.9L12 22l7.4-4.7v2.4L12 24l-7.4-4.3Z"
              />
            ) : (
              <path
                fill="currentColor"
                d="M3 5h18v2.2H3Zm0 5.9h18v2.2H3Zm0 5.9h18V19H3Z"
              />
            )}
          </svg>
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onHelp}
          title="Cara menerokai ruang ini"
          aria-label="Cara menerokai ruang ini"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18.2A8.2 8.2 0 1 1 20.2 12 8.21 8.21 0 0 1 12 20.2Zm0-13.4a3.2 3.2 0 0 0-3.2 3.2h1.9a1.3 1.3 0 1 1 2.2.92c-.86.72-1.9 1.3-1.9 2.78h1.9c0-.9 1.6-1.36 2.4-2.4a3.2 3.2 0 0 0-3.3-4.5Zm-.95 11.2h1.9v1.9h-1.9Z"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}

type DockProps = {
  stations: Station[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  label: string;
};

/**
 * The station dock — the DOM twin of the monolith ring, for pointer, keyboard and touch.
 *
 * It is one row that always keeps scrolling: touch pans it natively, a mouse can drag it,
 * a wheel over it scrolls it sideways, and the active station is always brought back into
 * view. There is deliberately no visible scrollbar — a soft fade, shown only on the side
 * that still has stations beyond it, is what signals there is more to see. Reach an end and
 * that edge goes crisp again, so the strip never looks accidentally clipped.
 */
export function Dock({ stations, activeId, onSelect, label }: DockProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: 0 });
  const [edges, setEdges] = useState({ left: false, right: false });

  // Fades are measured from real overflow, so a strip that fits is never touched at all.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const max = list.scrollWidth - list.clientWidth;
      const left = max > 2 && list.scrollLeft > 2;
      const right = max > 2 && list.scrollLeft < max - 2;
      setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    for (const item of Array.from(list.children)) observer.observe(item);
    list.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      list.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [stations.length, activeId]);

  // Keep the current station in sight — matters most on a phone, where only three fit.
  useEffect(() => {
    if (!activeId) return;
    const item = listRef.current?.querySelector<HTMLElement>(`[data-station="${activeId}"]`);
    item?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeId]);

  // A wheel over the strip scrolls it sideways: the gesture you would expect, and the only
  // way to reach the far stations with a mouse if dragging is not discovered.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const onWheel = (event: WheelEvent) => {
      if (list.scrollWidth <= list.clientWidth + 2) return;
      const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (!delta) return;
      list.scrollLeft += delta;
      event.preventDefault();
    };
    list.addEventListener('wheel', onWheel, { passive: false });
    return () => list.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return; // the browser already pans it natively
    const list = listRef.current;
    if (!list || list.scrollWidth <= list.clientWidth + 2) return;
    drag.current = { active: true, startX: event.clientX, startLeft: list.scrollLeft, moved: 0 };
    list.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const list = listRef.current;
    if (!list || !drag.current.active) return;
    const dx = event.clientX - drag.current.startX;
    drag.current.moved = Math.max(drag.current.moved, Math.abs(dx));
    list.scrollLeft = drag.current.startLeft - dx;
  }, []);

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    drag.current.active = false;
    listRef.current?.releasePointerCapture?.(event.pointerId);
  }, []);

  return (
    <nav className="dock" aria-label="Stesen dalam ruang PORT">
      <p className="dock-head">{label}</p>
      <div
        className={`dock-list${edges.left ? ' can-left' : ''}${edges.right ? ' can-right' : ''}`}
        ref={listRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {stations.map((station) => {
          const style = { '--item-accent': station.accent } as CSSProperties;
          return (
            <button
              key={station.id}
              type="button"
              data-station={station.id}
              className={`dock-item${activeId === station.id ? ' is-active' : ''}`}
              style={style}
              onClick={() => {
                // a drag should never be read as a tap
                if (drag.current.moved > 8) {
                  drag.current.moved = 0;
                  return;
                }
                onSelect(station.id);
              }}
              title={station.tagline}
            >
              <Glyph glyph={station.glyph} size={16} />
              {/* both forms ship, and the stylesheet picks one: the full name where there
                  is room, the short one on a phone, where every tab costs a swipe */}
              <span className="dock-label">
                <span className="dock-label-full">{station.label}</span>
                <span className="dock-label-short">{station.short}</span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

type RailProps = {
  station: Station;
  activeIndex: number;
  progress: number;
  onSelect: (index: number) => void;
  onWalk: (delta: number) => void;
  onExit: () => void;
  onOpen: (index: number) => void;
};

/** The corridor's index rail: shows where you are and lets you jump between works. */
export function CorridorRail({
  station,
  activeIndex,
  progress,
  onSelect,
  onWalk,
  onExit,
  onOpen,
}: RailProps) {
  return (
    <aside className="rail" aria-label={`Karya dalam ${station.label}`}>
      <div className="rail-head">
        <h2>{station.label}</h2>
        <p>{station.tagline}</p>
      </div>
      <div className="rail-progress" role="presentation">
        <span style={{ transform: `scaleX(${Math.max(0.02, progress)})` }} />
      </div>
      <div className="rail-list">
        {station.exhibits.map((ex, i) => (
          <button
            key={ex.id}
            type="button"
            className={`rail-item${i === activeIndex ? ' is-active' : ''}`}
            onClick={() => onSelect(i)}
          >
            <i>{String(i + 1).padStart(2, '0')}</i>
            <span>
              <span>{ex.title}</span>
              <small>{ex.meta}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="rail-foot">
        <button type="button" className="btn btn-ghost" onClick={() => onWalk(-6)}>
          ← Undur
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onOpen(activeIndex >= 0 ? activeIndex : 0)}
        >
          Buka karya
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => onWalk(6)}>
          Maju →
        </button>
      </div>
      <div className="rail-foot">
        <button type="button" className="btn btn-ghost" onClick={onExit}>
          ← Kembali ke dek
        </button>
      </div>
    </aside>
  );
}

/**
 * The one-line gesture hint above the dock. It carries the whole first-run lesson, so it
 * stays visible on every screen size, and it fades out once the visitor has acted on it.
 */
export function Hint({ children, retiring }: { children: ReactNode; retiring?: boolean }) {
  return (
    <p className={`hint${retiring ? ' is-done' : ''}`} aria-hidden={retiring ? true : undefined}>
      {children}
    </p>
  );
}
