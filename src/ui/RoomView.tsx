import { useRef } from 'react';
import { deckCovers, type Station } from '../content';
import { motifFor } from '../content/motifs';
import { hrefFor } from '../lib/hooks';
import { useCollected } from '../lib/collected';
import { useLang } from '../lib/lang';
import { pad, roomNumber, tourOrder } from '../lib/order';
import { useDepth } from '../lib/scroll';
import { Artwork, LightPlate } from './Artwork';
import { Reveal } from './Reveal';
import { LightPainting } from './fx/LightPainting';
import { Motif } from './fx/Motif';
import { RadiantLight } from './fx/RadiantLight';
import { SplitText } from './fx/SplitText';
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
 *
 * Each room wears the motif its own content calls for — the room of stages gets venue lighting,
 * the residency gets the painter's surface, the screening room gets a lit rectangle in a dark
 * wall. It sits under the lightpainting, so PORT's own thread is always the topmost layer of
 * light in the room.
 */
export function RoomView({ station, shelf, reducedMotion, webgl }: Props) {
  const { t, stations } = useLang();
  const { works: collected } = useCollected();
  const keptIds = new Set(collected.filter((w) => w.stationId === station.id).map((w) => w.exhibitId));
  const tour = tourOrder(stations);
  const number = roomNumber(stations, station.id);
  const index = number - 1;
  const prev = tour[(index - 1 + tour.length) % tour.length];
  const next = tour[(index + 1) % tour.length];
  const cover = deckCovers.get(station.id);
  const canWalk = webgl && station.kind === 'corridor' && station.exhibits.length > 0;
  const motif = motifFor(station);
  const hero = useRef<HTMLElement>(null);
  /* The room's light and its cover plate drift apart from each other as the door is passed. */
  useDepth(hero, 0.1, reducedMotion);

  return (
    <article className="room" style={{ ['--room-accent' as string]: station.accent }}>
      <header
        ref={hero}
        className="room-hero"
        data-hero
        data-stop
        data-stop-label={station.label}
        data-stop-group={`${t('room')} ${pad(number)}`}
        data-stop-note={station.tagline}
      >
        {cover ? (
          <div
            className="room-hero-bg"
            style={{ backgroundImage: `url("${cover.small}")` }}
            aria-hidden="true"
          />
        ) : null}
        <div className="room-hero-veil" aria-hidden="true" />
        {/* motif first, painting over it: the room's borrowed language, then PORT's own light */}
        <Motif kind={motif} />
        <LightPainting
          tone="dark"
          still
          painters={3}
          seed={number * 977}
          weight={0.9}
          className="depth-layer"
        />
        <RadiantLight
          sources={3}
          reducedMotion={reducedMotion}
          weight={1.0}
          speed={0.5}
          seed={number * 113}
          className="depth-layer"
        />
        <div className="room-hero-scrim" aria-hidden="true" />

        <div className="room-hero-inner">
          <p className="kicker kicker-dark">
            <a href="#/">PORT</a> <span aria-hidden="true">/</span> {t('room')} {pad(number)}{' '}
            {t('roomOf')} {pad(tour.length)}
          </p>
          <h1 className="room-title">
            <SplitText text={station.label} reducedMotion={reducedMotion} stagger={36} delay={90} />
          </h1>
          <p className="room-tagline serif-lede">{station.tagline}</p>
          {station.kind !== 'video' ? (
            <div className="room-intro serif-body">
              {station.intro.map((para) => (
                <p key={para}>{para}</p>
              ))}
            </div>
          ) : null}
          {canWalk ? (
            <a className="btn-glow is-compact" href={hrefFor({ kind: 'walk', stationId: station.id })} data-cursor="walk">
              <span className="btn-glow-fill" aria-hidden="true" />
              <span className="btn-glow-label spectrum-text" data-text={t('walk3d')}>
                {t('walk3d')}
              </span>
              <i className="btn-glow-node" aria-hidden="true" />
            </a>
          ) : null}
        </div>

        {cover && station.kind !== 'video' ? (
          <figure className="room-hero-cover lit" aria-hidden="true">
            <Artwork image={cover} fit="cover" sizes="(max-width: 900px) 0px, 360px" eager />
          </figure>
        ) : null}
      </header>

      <div className="room-body">
        {station.kind === 'video' ? <VideoRoom station={station} initialShelf={shelf} showIntro /> : null}

        {station.sections?.length ? (
          <div className="room-sections">
            {station.sections.map((section, i) => (
              <Reveal key={section.heading} className="room-section lit" delay={i * 80}>
                <span className="room-section-index">{pad(i + 1)}</span>
                <h2>{section.heading}</h2>
                <div className="serif-body">
                  {section.paragraphs.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
                {section.bullets?.length ? (
                  <ul className="bullets">
                    {section.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </Reveal>
            ))}
          </div>
        ) : null}

        {station.kind === 'contact' ? <ContactContent /> : null}

        {station.exhibits.length > 0 ? (
          <section className="works" aria-labelledby="works-title">
            <Reveal className="works-head">
              <p className="kicker">{station.kind === 'list' ? t('list') : t('collection')}</p>
              <h2 id="works-title">
                {pad(station.exhibits.length)} {t('works')}
              </h2>
            </Reveal>
            <div className="works-wall">
              {station.exhibits.map((work, i) => (
                <Reveal key={work.id} delay={(i % 3) * 90}>
                  <a
                    className={`work${keptIds.has(work.id) ? ' is-kept' : ''}`}
                    href={hrefFor({ kind: 'exhibit', stationId: station.id, index: i })}
                    data-stop
                    data-stop-label={work.title}
                    data-stop-group={station.label}
                    data-stop-note={work.tagline}
                  >
                    <span className="work-frame">
                      {work.images[0] ? (
                        <Artwork image={work.images[0]} alt={work.title} sizes="(max-width: 700px) 92vw, 420px" />
                      ) : (
                        <LightPlate id={work.id} title={work.title} label={pad(i + 1)} />
                      )}
                      <span className="hud-corner is-tl" />
                      <span className="hud-corner is-br" />
                      {/* the kept mark: a bookmark hanging on the frame's corner, not a button —
                          the whole wall card is one link into the reader, where keeping happens */}
                      <span className={`work-kept${keptIds.has(work.id) ? ' is-on' : ''}`} aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M5 3h14a2 2 0 0 1 2 2v16l-9-4.6L3 21V5a2 2 0 0 1 2-2Z" />
                        </svg>
                      </span>
                    </span>
                    <span className="work-plaque">
                      <span className="work-meta">
                        <b>{pad(i + 1)}</b> {work.meta}
                      </span>
                      <span className="work-title">{work.title}</span>
                      <span className="work-tagline">{work.tagline}</span>
                    </span>
                  </a>
                </Reveal>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {/* The corridor carries on: the rooms either side, joined by the same line of light. */}
      <nav className="room-onward" aria-label={t('rooms')}>
        <a className="onward is-prev" href={hrefFor({ kind: 'station', stationId: prev.id })} data-cursor="prev">
          <span>{t('prevRoom')}</span>
          <b>{prev.label}</b>
        </a>
        <span className="onward-line" aria-hidden="true">
          <i />
        </span>
        <a className="onward is-next" href={hrefFor({ kind: 'station', stationId: next.id })} data-cursor="next">
          <span>{t('nextRoom')}</span>
          <b>{next.label}</b>
        </a>
      </nav>
      <a className="room-back" href="#/" data-cursor="walk">
        {t('backToHall')}
      </a>
    </article>
  );
}
