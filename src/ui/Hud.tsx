import type { CSSProperties, ReactNode } from 'react';
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

/** The station dock — the DOM twin of the monolith ring, for pointer, keyboard and touch. */
export function Dock({ stations, activeId, onSelect, label }: DockProps) {
  return (
    <nav
      className="dock"
      aria-label="Stesen dalam ruang PORT"
      onMouseEnter={() => undefined}
    >
      <p className="dock-head">{label}</p>
      <div className="dock-list">
        {stations.map((station) => {
          const style = { '--item-accent': station.accent } as CSSProperties;
          return (
            <button
              key={station.id}
              type="button"
              className={`dock-item${activeId === station.id ? ' is-active' : ''}`}
              style={style}
              onClick={() => onSelect(station.id)}
              title={station.tagline}
            >
              <Glyph glyph={station.glyph} size={16} />
              {station.label}
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

export function Hint({ children }: { children: ReactNode }) {
  return <p className="hint">{children}</p>;
}
