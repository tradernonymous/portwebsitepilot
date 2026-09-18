import { useEffect, useRef, useState } from 'react';
import { contentMeta, type Station } from '../content';
import { useLang } from '../lib/lang';
import { videoCount } from '../content/videos';
import { Glyph } from './Glyph';
import { StationContent } from './StationPanel';

/**
 * The whole space as a plain document. This is what search engines, screen readers,
 * very old devices and anyone who simply prefers reading get — same content, no 3D.
 *
 * It is also the archive, and an archive of eight rooms read end to end is a wall of text.
 * The filter is the same division the building itself makes — the halls you walk, the lists
 * and archives you read, the films you watch, the pages that are simply information — so it
 * is a way of moving around the house rather than a taxonomy invented for a menu.
 */

type Group = 'all' | 'rooms' | 'archive' | 'films' | 'info';

/** Which part of the building a room belongs to. */
function groupOf(station: Station): Exclude<Group, 'all'> {
  switch (station.kind) {
    case 'corridor':
      return 'rooms';
    case 'list':
      return 'archive';
    case 'video':
      return 'films';
    default:
      return 'info';
  }
}

export function FlatView() {
  const { t, stations } = useLang();
  const [group, setGroup] = useState<Group>('all');
  const list = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  const filters: { id: Group; label: string }[] = [
    { id: 'all', label: t('filterAll') },
    { id: 'rooms', label: t('filterRooms') },
    { id: 'archive', label: t('filterArchive') },
    { id: 'films', label: t('filterFilms') },
    { id: 'info', label: t('filterInfo') },
  ];

  const shown = group === 'all' ? stations : stations.filter((station) => groupOf(station) === group);

  /*
   * A new filter is a new arrangement of the room, so the list comes back to the top of
   * itself. The very first render is left alone — moving a page the visitor has just arrived
   * on is the same as landing halfway down it.
   */
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    list.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [group]);

  return (
    <main className="flat">
      <header className="flat-hero">
        <h1>PORT</h1>
        <p className="flat-sub">{t('subtitle')}</p>
        <p className="serif-lede">{t('flatIntro')}</p>
      </header>

      <div className="flat-filter" role="group" aria-label={t('filterLabel')}>
        {filters.map((entry) => {
          const count =
            entry.id === 'all'
              ? stations.length
              : stations.filter((station) => groupOf(station) === entry.id).length;
          return (
            <button
              key={entry.id}
              type="button"
              className="flat-filter-btn"
              aria-pressed={group === entry.id}
              disabled={count === 0}
              onClick={() => setGroup(entry.id)}
              data-cursor="open"
            >
              {entry.label}
              <i aria-hidden="true">{String(count).padStart(2, '0')}</i>
            </button>
          );
        })}
      </div>

      <div className="flat-list" ref={list}>
        <nav className="flat-nav" aria-label={t('stationsNav')}>
          {shown.map((s) => (
            <a key={s.id} href={`#${s.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
              <Glyph glyph={s.glyph} size={14} />
              {s.label}
            </a>
          ))}
        </nav>

        {shown.length === 0 ? (
          <p className="flat-empty">{t('filterEmpty')}</p>
        ) : (
          shown.map((station) => (
            <section
              /* keyed on the filter as well, so a section that arrives back on screen replays
                 its own arrival instead of being silently un-hidden */
              key={`${group}:${station.id}`}
              className="flat-station"
              id={station.id}
              style={{ ['--station-accent' as string]: station.accent }}
            >
              <header>
                <Glyph glyph={station.glyph} size={22} />
                <h2>{station.label}</h2>
                <span>
                  {station.kind === 'video'
                    ? `${videoCount()} ${t('films_count')}`
                    : station.exhibits.length > 0
                      ? `${station.exhibits.length} ${t('works')}`
                      : t('profile')}
                </span>
              </header>
              <StationContent station={station} />
            </section>
          ))
        )}
      </div>

      <footer className="flat-footer">
        <p>
          {contentMeta.counts.pages} {t('flatFooterPages')} {contentMeta.counts.images}{' '}
          {t('flatFooterImages')}{' '}
          <a href={contentMeta.source} target="_blank" rel="noreferrer noopener">
            portipoh.com
          </a>
          . PORT (People Of Remarkable Talents), Ipoh, Perak.
        </p>
      </footer>
    </main>
  );
}
