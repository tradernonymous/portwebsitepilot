import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Station } from '../content';
import { useLang } from '../lib/lang';

type Toggle = { active: boolean; onToggle: () => void };

/**
 * Everything the gallery's chrome can do, in one shape.
 *
 * The bar and the building map are two views of the same controls — one compact, one with room
 * to explain itself — so they take the same contract rather than each carrying its own copy of
 * six callbacks. `null` is meaningful: it is how a control says the mode has nothing to do on
 * this page, instead of the control having to ask which page it is on.
 */
export type ChromeActions = {
  flat: boolean;
  onToggleFlat: () => void;
  onHelp: () => void;
  /** The visitor's notebook — the count is the invitation; zero is still worth showing. */
  notebook: { count: number; onToggle: () => void };
  trail: Toggle | null;
  /** Present only where the page has stops to walk. */
  gallery: Toggle | null;
  /** Curator's Eye rides on gallery mode: its toggle turns the walk on too. */
  curator: Toggle | null;
};

type TopBarProps = ChromeActions & {
  /** The trail after "PORT" — room and work names, titles only. */
  crumb?: ReactNode;
  /** Opens the building map. */
  onMenu: () => void;
  /** Changes whenever the page underneath changes, so the bar re-reads what it sits on. */
  pageKey: string;
};

/**
 * The one bar that stays put. It sits transparent over a dark hero (the film, a room's
 * light) and turns to white glass once the page has scrolled onto the gallery wall, so its
 * words are always legible against whatever is behind them.
 */
export function TopBar({
  crumb,
  flat,
  onToggleFlat,
  onHelp,
  notebook,
  trail,
  gallery,
  curator,
  onMenu,
  pageKey,
}: TopBarProps) {
  const { t, lang, toggle } = useLang();
  const [onDark, setOnDark] = useState(true);
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const hero = document.querySelector('[data-hero]');
      const bottom = hero ? hero.getBoundingClientRect().bottom : 0;
      setOnDark(bottom > 60);
      // the hall is one long wall — the hairline shows how deep into it the visitor is
      const doc = document.documentElement;
      const span = doc.scrollHeight - window.innerHeight;
      const progress = span > 0 ? Math.min(1, Math.max(0, window.scrollY / span)) : 0;
      barRef.current?.style.setProperty('--progress', progress.toFixed(4));
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
    <header ref={barRef} className={`topbar${onDark ? ' is-on-dark' : ''}`}>
      <i className="topbar-progress" aria-hidden="true" />
      <a className="topbar-brand" href="#/" aria-label={`PORT — ${t('home')}`}>
        <b>PORT</b>
        <span>unity thru arts</span>
      </a>
      {crumb ? <nav className="topbar-crumb">{crumb}</nav> : <span className="topbar-spacer" />}
      <div className="topbar-tools">
        <button
          type="button"
          className="icon-btn is-menu"
          onClick={onMenu}
          title={t('menuOpen')}
          aria-label={t('menuOpen')}
          data-cursor="open"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M3 4h18v2H3Zm0 7h18v2H3Zm0 7h18v2H3Z" />
            <circle cx="20.5" cy="5" r="2.2" fill="currentColor" />
          </svg>
        </button>
        {trail ? (
          <button
            type="button"
            className="icon-btn is-trails"
            aria-pressed={trail.active}
            onClick={trail.onToggle}
            title={t('trailMode')}
            aria-label={t('trailMode')}
            data-cursor="walk"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M12 2a5 5 0 0 0-3 9v2.2A5.5 5.5 0 0 0 5.5 18.5 3.5 3.5 0 0 0 9 22h6a3.5 3.5 0 0 0 3.5-3.5A5.5 5.5 0 0 0 15 13.2V11a5 5 0 0 0-3-9Zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm-1 9.1v1.8a3.5 3.5 0 0 0-3.5 3.5A1.5 1.5 0 0 0 9 20h6a1.5 1.5 0 0 0 1.5-1.5A3.5 3.5 0 0 0 13 14.9v-1.8a5 5 0 0 1-2 0Z" />
            </svg>
          </button>
        ) : null}
        {gallery ? (
          <button
            type="button"
            className="icon-btn is-gallery"
            aria-pressed={gallery.active}
            onClick={gallery.onToggle}
            title={t('galleryMode')}
            aria-label={t('galleryMode')}
            data-cursor="walk"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v10h16V7H4Z"
              />
              <path
                fill="currentColor"
                d="M5 8h2v2H5V8Zm3 0h2v2H8V8Zm3 0h2v2h-2V8Zm3 0h2v2h-2V8Zm3 0h2v2h-2V8ZM5 11h2v2H5v-2Zm3 0h2v2H8v-2Zm3 0h2v2h-2v-2Zm3 0h2v2h-2v-2Zm3 0h2v2h-2v-2ZM5 14h2v2H5v-2Zm5 0h4v2h-4v-2Zm5 0h4v2h-4v-2Z"
              />
            </svg>
          </button>
        ) : null}
        {curator && gallery ? (
          <button
            type="button"
            className="icon-btn is-curator"
            aria-pressed={curator.active}
            onClick={curator.onToggle}
            title={t('curatorMode')}
            aria-label={t('curatorMode')}
            data-cursor="walk"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 5c-4.5 0-8.2 2.9-9.5 7 1.3 4.1 5 7 9.5 7s8.2-2.9 9.5-7c-1.3-4.1-5-7-9.5-7Zm0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9Zm0-2.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
              />
            </svg>
          </button>
        ) : null}
        <button
          type="button"
          className={`icon-btn is-notebook${notebook.count > 0 ? ' has-works' : ''}`}
          onClick={notebook.onToggle}
          aria-label={`${t('notebookToggle')}${notebook.count > 0 ? ` · ${notebook.count}` : ''}`}
          title={t('notebookToggle')}
          data-cursor="open"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M6 2h13a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm0 2v16h12V4H6Zm2 3h8v2H8V7Zm0 4h8v2H8v-2Zm0 4h5v2H8v-2Z"
            />
          </svg>
          {notebook.count > 0 ? <b className="notebook-count" aria-hidden="true">{notebook.count}</b> : null}
        </button>
        <button type="button" className="chip" onClick={toggle} aria-label={t('switchLang')} title={t('switchLang')}>
          <span className={lang === 'ms' ? 'is-on' : ''}>BM</span>
          <i aria-hidden="true">/</i>
          <span className={lang === 'en' ? 'is-on' : ''}>EN</span>
        </button>
        <button
          type="button"
          className="icon-btn is-flat"
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
    <aside className="rail lit" aria-label={`${t('worksIn')} ${station.label}`}>
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
            className={`rail-item lit${i === activeIndex ? ' is-active' : ''}`}
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
        <button type="button" className="btn" onClick={() => onWalk(-6)} data-cursor="walk">
          {t('walkBack')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onOpen(activeIndex >= 0 ? activeIndex : 0)}
          data-cursor="open"
        >
          {t('openWork')}
        </button>
        <button type="button" className="btn" onClick={() => onWalk(6)} data-cursor="walk">
          {t('walkFwd')}
        </button>
      </div>
      <button type="button" className="rail-exit" onClick={onExit} data-cursor="close">
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
