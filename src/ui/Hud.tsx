import { useEffect, useState, type ReactNode } from 'react';
import type { Station } from '../content';
import { useLang } from '../lib/lang';

type TopBarProps = {
  /** The trail after "PORT" — room and work names, titles only. */
  crumb?: ReactNode;
  flat: boolean;
  onToggleFlat: () => void;
  onHelp: () => void;
  /** Changes whenever the page underneath changes, so the bar re-reads what it sits on. */
  pageKey: string;
};

/**
 * The one bar that stays put. It sits transparent over a dark hero (the film, a room's
 * light) and turns to white glass once the page has scrolled onto the gallery wall, so its
 * words are always legible against whatever is behind them.
 */
export function TopBar({ crumb, flat, onToggleFlat, onHelp, pageKey }: TopBarProps) {
  const { t, lang, toggle } = useLang();
  const [onDark, setOnDark] = useState(true);

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const hero = document.querySelector('[data-hero]');
      const bottom = hero ? hero.getBoundingClientRect().bottom : 0;
      setOnDark(bottom > 60);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [pageKey]);

  return (
    <header className={`topbar${onDark ? ' is-on-dark' : ''}`}>
      <a className="topbar-brand" href="#/" aria-label={`PORT — ${t('home')}`}>
        <b>PORT</b>
        <span>unity thru arts</span>
      </a>
      {crumb ? <nav className="topbar-crumb">{crumb}</nav> : <span className="topbar-spacer" />}
      <div className="topbar-tools">
        <button type="button" className="chip" onClick={toggle} aria-label={t('switchLang')} title={t('switchLang')}>
          <span className={lang === 'ms' ? 'is-on' : ''}>BM</span>
          <i aria-hidden="true">/</i>
          <span className={lang === 'en' ? 'is-on' : ''}>EN</span>
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-pressed={flat}
          onClick={onToggleFlat}
          title={flat ? t('toGallery') : t('toList')}
          aria-label={flat ? t('toGallery') : t('toList')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            {flat ? (
              <path fill="currentColor" d="M3 3h8v8H3Zm2 2v4h4V5Zm8-2h8v8h-8Zm2 2v4h4V5ZM3 13h8v8H3Zm2 2v4h4v-4Zm8-2h8v8h-8Zm2 2v4h4v-4Z" />
            ) : (
              <path fill="currentColor" d="M3 5h18v2H3Zm0 6h18v2H3Zm0 6h12v2H3Z" />
            )}
          </svg>
        </button>
        <button type="button" className="icon-btn" onClick={onHelp} title={t('helpTitle')} aria-label={t('helpTitle')}>
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

type RailProps = {
  station: Station;
  activeIndex: number;
  progress: number;
  onSelect: (index: number) => void;
  onWalk: (delta: number) => void;
  onExit: () => void;
  onOpen: (index: number) => void;
};

/** The 3D wing's index rail: where you are, and every work in the wing. */
export function CorridorRail({ station, activeIndex, progress, onSelect, onWalk, onExit, onOpen }: RailProps) {
  const { t } = useLang();
  return (
    <aside className="rail" aria-label={`${t('worksIn')} ${station.label}`}>
      <div className="rail-head">
        <span className="rail-kicker">
          {t('walkKicker')} / {String(station.exhibits.length).padStart(2, '0')} {t('works')}
        </span>
        <h2>{station.label}</h2>
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
        <button type="button" className="btn" onClick={() => onWalk(-6)}>
          {t('walkBack')}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => onOpen(activeIndex >= 0 ? activeIndex : 0)}>
          {t('openWork')}
        </button>
        <button type="button" className="btn" onClick={() => onWalk(6)}>
          {t('walkFwd')}
        </button>
      </div>
      <button type="button" className="rail-exit" onClick={onExit}>
        {t('backToRoom')}
      </button>
    </aside>
  );
}

/** A one-line gesture lesson that retires itself once the visitor has acted on it. */
export function Hint({ children, retiring }: { children: ReactNode; retiring?: boolean }) {
  return (
    <p className={`hint${retiring ? ' is-done' : ''}`} aria-hidden={retiring ? true : undefined}>
      {children}
    </p>
  );
}
