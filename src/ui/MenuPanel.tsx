import { useEffect, useRef } from 'react';
import { hrefFor } from '../lib/hooks';
import { useLang } from '../lib/lang';
import { pad, tourOrder } from '../lib/order';
import { Glyph } from './Glyph';
import { LightPainting } from './fx/LightPainting';
import { Motif } from './fx/Motif';
import type { ChromeActions } from './Hud';

type Props = ChromeActions & {
  open: boolean;
  onClose: () => void;
  /** The room the visitor is standing in, marked on the plan. `null` is the hall itself. */
  here: string | null;
  reducedMotion: boolean;
};

/**
 * The building map.
 *
 * The bar is a strip of icons, which is fine when you already know the house: you press the
 * one you want. It is no help at all when you do not, and on a phone there is only room for
 * about four of them anyway. So the whole plan lives here, behind one control, with the room
 * names written out and the visitor's own position marked on it.
 *
 * It is the same set of actions the bar offers rather than a second set — one contract, two
 * views — so nothing can be reachable from one and missing from the other. Rooms come first
 * because that is what a visitor to a gallery actually came for; the tools sit underneath.
 */
export function MenuPanel({ open, onClose, here, reducedMotion, ...actions }: Props) {
  const { t, stations } = useLang();
  const scroller = useRef<HTMLDivElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  const tour = tourOrder(stations);

  /* Opening the plan is a deliberate act: put the cursor in it, and start at the top. */
  useEffect(() => {
    if (!open) return;
    scroller.current?.scrollTo({ top: 0, behavior: 'auto' });
    closer.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const tools = [
    actions.trail ? { key: 'trail', label: t('trailMode'), active: actions.trail.active, run: actions.trail.onToggle } : null,
    actions.gallery
      ? { key: 'gallery', label: t('galleryMode'), active: actions.gallery.active, run: actions.gallery.onToggle }
      : null,
    actions.curator
      ? { key: 'curator', label: t('curatorMode'), active: actions.curator.active, run: actions.curator.onToggle }
      : null,
    {
      key: 'notebook',
      label: `${t('notebookToggle')}${actions.notebook.count > 0 ? ` · ${actions.notebook.count}` : ''}`,
      active: false,
      run: actions.notebook.onToggle,
    },
    { key: 'tour', label: t('tourReplay'), active: false, run: actions.onTour },
    { key: 'flat', label: actions.flat ? t('toGallery') : t('toList'), active: actions.flat, run: actions.onToggleFlat },
    { key: 'help', label: t('helpTitle'), active: false, run: actions.onHelp },
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return (
    <>
      <div className="menu-scrim" role="presentation" onClick={onClose} />
      <section className="menu" role="dialog" aria-modal="true" aria-label={t('menuOpen')}>
        <Motif kind="aperture" />
        <LightPainting tone="dark" painters={3} interactive reducedMotion={reducedMotion} speed={0.45} weight={0.7} seed={404} />

        <header className="menu-top">
          <div>
            <p className="kicker kicker-dark">{t('menuKicker')}</p>
            <h2>{t('menuTitle')}</h2>
            <p className="menu-lede serif-lede">{t('menuLede')}</p>
          </div>
          <button
            ref={closer}
            type="button"
            className="icon-btn close-btn"
            onClick={onClose}
            aria-label={t('close')}
            title={t('close')}
            data-cursor="close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3Z"
              />
            </svg>
          </button>
        </header>

        <div className="menu-body" ref={scroller} tabIndex={-1}>
          <div className="menu-block">
            <h3 className="menu-heading">
              <span>{t('menuRooms')}</span>
              <i>{pad(tour.length)}</i>
            </h3>
            <ol className="menu-rooms">
              <li>
                <a
                  className={`menu-room${here === null ? ' is-here' : ''}`}
                  href={hrefFor({ kind: 'hub' })}
                  data-cursor="walk"
                  style={{ ['--room-accent' as string]: 'var(--lp-cyan)' }}
                >
                  <span className="menu-room-no">00</span>
                  <span className="menu-room-body">
                    <b>{t('home')}</b>
                    <small>{t('corridorTitle')}</small>
                  </span>
                  {here === null ? <span className="menu-here">{t('youAreHere')}</span> : null}
                </a>
              </li>
              {tour.map((station, i) => {
                const current = here === station.id;
                const count =
                  station.exhibits.length > 0
                    ? `${pad(station.exhibits.length)} ${t('works')}`
                    : t('profile');
                return (
                  <li key={station.id}>
                    <a
                      className={`menu-room${current ? ' is-here' : ''}`}
                      href={hrefFor({ kind: 'station', stationId: station.id })}
                      data-cursor="open"
                      style={{ ['--room-accent' as string]: station.accent }}
                    >
                      <span className="menu-room-no">{pad(i + 1)}</span>
                      <span className="menu-room-glyph">
                        <Glyph glyph={station.glyph} size={16} />
                      </span>
                      <span className="menu-room-body">
                        <b>{station.label}</b>
                        <small>{station.tagline}</small>
                      </span>
                      <span className="menu-room-meta">{count}</span>
                      {current ? <span className="menu-here">{t('youAreHere')}</span> : null}
                    </a>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="menu-block">
            <h3 className="menu-heading">
              <span>{t('menuTools')}</span>
            </h3>
            <div className="menu-tools">
              {tools.map((tool) => (
                <button
                  key={tool.key}
                  type="button"
                  className={`menu-tool${tool.active ? ' is-on' : ''}`}
                  aria-pressed={tool.active}
                  onClick={() => {
                    onClose();
                    tool.run();
                  }}
                  data-cursor="open"
                >
                  {tool.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
