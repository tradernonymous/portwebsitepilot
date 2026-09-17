import { hrefFor } from '../lib/hooks';
import { useLang } from '../lib/lang';
import { pad, tourOrder } from '../lib/order';
import { Artwork } from './Artwork';

type Props = {
  reducedMotion: boolean;
  /** The chapter anchor the rail watches. */
  id?: string;
};

/**
 * Pameran Semasa — the works on view right now.
 *
 * The corridor below lists every room; this is the one place the hall stops and shows a few
 * pieces properly, the way a gallery hangs its current show at the front door. One work from
 * each of the first three rooms that has any, so the spotlight never repeats a room and never
 * hangs the same picture twice.
 *
 * It stays inside the existing content model: a work is whatever `station.exhibits` already
 * holds, and it links straight into the reader the corridor uses.
 */
export function Exhibition({ reducedMotion, id }: Props) {
  const { t, stations } = useLang();
  void reducedMotion;

  const featured = tourOrder(stations)
    .map((station) => {
      const index = station.exhibits.findIndex((work) => work.images.length > 0);
      return index >= 0 ? { station, index, work: station.exhibits[index] } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .slice(0, 3);

  if (!featured.length) return null;

  return (
    <section id={id} data-chapter className="exhibition" aria-labelledby="exhibition-title">
      <header className="exhibition-head">
        <p className="kicker">{t('exhibitionKicker')}</p>
        <h2 id="exhibition-title">{t('exhibitionTitle')}</h2>
        <p className="exhibition-lede">{t('exhibitionLede')}</p>
      </header>

      <div className="exhibition-grid">
        {featured.map(({ station, work, index }, i) => (
          <a
            key={work.id}
            className="onview-card"
            href={hrefFor({ kind: 'exhibit', stationId: station.id, index })}
          >
            <span className={`onview-card-frame${i === 0 ? ' lit lit-run' : ''}`}>
              <Artwork image={work.images[0]} alt={work.title} sizes="(max-width: 900px) 92vw, 30vw" />
              <span className="onview-card-no">{pad(i + 1)}</span>
              <span className="hud-corner is-tl" />
              <span className="hud-corner is-br" />
            </span>
            <span className="onview-card-body">
              <span className="onview-card-room">{station.label}</span>
              <b>{work.title}</b>
              <span className="onview-card-meta">{work.meta}</span>
              <span className="onview-card-text">{work.body[0] ?? work.tagline}</span>
              <span className="onview-card-cta">
                {t('openWork')}
                <i aria-hidden="true">→</i>
              </span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
