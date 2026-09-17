import { deckCovers, type Station } from '../content';
import { hrefFor } from '../lib/hooks';
import { useLang } from '../lib/lang';
import { pad, roomNumber, tourOrder } from '../lib/order';
import { Artwork, LightPlate } from './Artwork';
import { Decipher } from './fx/Decipher';
import { LightPainting } from './fx/LightPainting';
import { ContactContent } from './StationPanel';
import { VideoRoom } from './VideoRoom';

type Props = {
  station: Station;
  shelf?: string;
  reducedMotion: boolean;
  webgl: boolean;
};

/**
 * One room of the gallery, as a page: its light and its name at the door, then the works on
 * the wall, then the line of light running on to the rooms either side.
 */
export function RoomView({ station, shelf, reducedMotion, webgl }: Props) {
  const { t, stations } = useLang();
  const tour = tourOrder(stations);
  const number = roomNumber(stations, station.id);
  const index = number - 1;
  const prev = tour[(index - 1 + tour.length) % tour.length];
  const next = tour[(index + 1) % tour.length];
  const cover = deckCovers.get(station.id);
  const canWalk = webgl && station.kind === 'corridor' && station.exhibits.length > 0;

  return (
    <article className="room" style={{ ['--room-accent' as string]: station.accent }}>
      <header className="room-hero" data-hero>
        {cover ? (
          <div className="room-hero-bg" style={{ backgroundImage: `url("${cover.small}")` }} aria-hidden="true" />
        ) : null}
        <div className="room-hero-veil" aria-hidden="true" />
        <LightPainting tone="dark" still painters={4} seed={number * 977} weight={1.2} />

        <div className="room-hero-inner">
          <p className="kicker kicker-dark">
            <a href="#/">PORT</a> <span aria-hidden="true">/</span> {t('room')} {pad(number)} {t('roomOf')}{' '}
            {pad(tour.length)}
          </p>
          <h1 className="room-title">
            <Decipher text={station.label} reducedMotion={reducedMotion} duration={650} />
          </h1>
          <p className="room-tagline">{station.tagline}</p>
          {station.kind !== 'video' ? (
            <div className="room-intro">
              {station.intro.map((para) => (
                <p key={para}>{para}</p>
              ))}
            </div>
          ) : null}
          {canWalk ? (
            <a className="btn-glow is-compact" href={hrefFor({ kind: 'walk', stationId: station.id })}>
              <span className="btn-glow-fill" aria-hidden="true" />
              <span className="btn-glow-label spectrum-text" data-text={t('walk3d')}>
                {t('walk3d')}
              </span>
              <i className="btn-glow-node" aria-hidden="true" />
            </a>
          ) : null}
        </div>
        {cover && station.kind !== 'video' ? (
          <figure className="room-hero-cover" aria-hidden="true">
            <Artwork image={cover} fit="cover" sizes="(max-width: 900px) 0px, 360px" eager />
          </figure>
        ) : null}
      </header>

      <div className="room-body">
        {station.kind === 'video' ? (
          <VideoRoom station={station} initialShelf={shelf} showIntro />
        ) : null}

        {station.sections?.length ? (
          <div className="room-sections">
            {station.sections.map((section, i) => (
              <section className="room-section" key={section.heading}>
                <span className="room-section-index">{pad(i + 1)}</span>
                <h2>{section.heading}</h2>
                {section.paragraphs.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                {section.bullets?.length ? (
                  <ul className="bullets">
                    {section.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        ) : null}

        {station.kind === 'contact' ? <ContactContent /> : null}

        {station.exhibits.length > 0 ? (
          <section className="works" aria-labelledby="works-title">
            <header className="works-head">
              <p className="kicker">{station.kind === 'list' ? t('list') : t('collection')}</p>
              <h2 id="works-title">
                {pad(station.exhibits.length)} {t('works')}
              </h2>
            </header>
            <div className="works-wall">
              {station.exhibits.map((work, i) => (
                <a key={work.id} className="work" href={hrefFor({ kind: 'exhibit', stationId: station.id, index: i })}>
                  <span className="work-frame">
                    {work.images[0] ? (
                      <Artwork image={work.images[0]} alt={work.title} sizes="(max-width: 700px) 92vw, 420px" />
                    ) : (
                      <LightPlate id={work.id} title={work.title} label={pad(i + 1)} />
                    )}
                    <span className="hud-corner is-tl" />
                    <span className="hud-corner is-br" />
                  </span>
                  <span className="work-plaque">
                    <span className="work-meta">
                      <b>{pad(i + 1)}</b> {work.meta}
                    </span>
                    <span className="work-title">{work.title}</span>
                    <span className="work-tagline">{work.tagline}</span>
                  </span>
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {/* The corridor carries on: the rooms either side, joined by the same line of light. */}
      <nav className="room-onward" aria-label={t('rooms')}>
        <a className="onward is-prev" href={hrefFor({ kind: 'station', stationId: prev.id })}>
          <span>{t('prevRoom')}</span>
          <b>{prev.label}</b>
        </a>
        <span className="onward-line" aria-hidden="true">
          <i />
        </span>
        <a className="onward is-next" href={hrefFor({ kind: 'station', stationId: next.id })}>
          <span>{t('nextRoom')}</span>
          <b>{next.label}</b>
        </a>
      </nav>
      <a className="room-back" href="#/">
        {t('backToHall')}
      </a>
    </article>
  );
}
