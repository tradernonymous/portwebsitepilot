import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { contact, contentMeta, deckCovers, type Station } from '../content';
import { localizeFeatured } from '../content/en';
import { motifFor } from '../content/motifs';
import { featuredVideo, thumbUrl, videoCount } from '../content/videos';
import { hrefFor } from '../lib/hooks';
import { useLang } from '../lib/lang';
import { HERO_ROOM, pad, tourOrder } from '../lib/order';
import { scrollToY, useDepth } from '../lib/scroll';
import { Artwork, LightPlate } from './Artwork';
import { ChapterRail, type Chapter } from './ChapterRail';
import { DoorReveal } from './DoorReveal';
import { Exhibition } from './Exhibition';
import { FilmBackdrop } from './FilmBackdrop';
import { Reveal } from './Reveal';
import { Decipher } from './fx/Decipher';
import { LightPainting } from './fx/LightPainting';
import { Motif } from './fx/Motif';
import { RadiantLight } from './fx/RadiantLight';
import { SplitText } from './fx/SplitText';

type Props = {
  reducedMotion: boolean;
};

/**
 * The hall: a walk with chapters.
 *
 * The visitor arrives at a threshold, is shown what is on view, then walks past every room
 * in the building — one room to a panel, in order, the way you would actually go through
 * PORT — before the figures and the way out. A rail on the side is the map: where you are,
 * what is next, and one tap to any of it.
 *
 * Lightpainting is the thread that runs the whole way through. Each panel also wears the motif
 * its room's content calls for — the visual languages of contemporary art, rebuilt in CSS — so
 * the walk reads as a conversation between PORT's own light and the wider tradition it belongs
 * to, and each room's borrowed language says something true about what is inside it.
 *
 * Scroll work touches one state value and one CSS variable: no React re-render per frame.
 */
export function Hall({ reducedMotion }: Props) {
  const { t, stations } = useLang();
  const tour = tourOrder(stations);
  const hero = tour.find((s) => s.id === HERO_ROOM);
  const rooms = tour.filter((s) => s.id !== HERO_ROOM);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [reducedMotion]);

  const chapters: Chapter[] = [
    { id: 'ch-threshold', label: t('chapterWelcome') },
    { id: 'ch-onview', label: t('chapterOnView') },
    { id: 'ch-rooms', label: t('chapterRooms') },
    { id: 'ch-figures', label: t('chapterFigures') },
    { id: 'ch-visit', label: t('chapterVisit') },
  ];

  return (
    <div className="hall">
      <ChapterRail chapters={chapters} />
      {hero ? (
        <Threshold station={hero} total={tour.length} reducedMotion={reducedMotion} />
      ) : null}
      <Exhibition id="ch-onview" reducedMotion={reducedMotion} />
      <RoomWalk rooms={rooms} reducedMotion={reducedMotion} />
      <Figures stations={stations} reducedMotion={reducedMotion} scrollProgress={scrollProgress} />
      <Visit reducedMotion={reducedMotion} />
    </div>
  );
}

/* ================================================================ chapter one: the threshold */

function Threshold({
  station,
  total,
  reducedMotion,
}: {
  station: Station;
  total: number;
  reducedMotion: boolean;
}) {
  const { t, lang } = useLang();
  const film = localizeFeatured(featuredVideo, lang);
  const shelves = station.videoShelves ?? [];
  const surface = useRef<HTMLElement>(null);
  /* The room's light drifts against the page as the hero passes, so the hall starts deep. */
  useDepth(surface, 0.1, reducedMotion);

  /** The light the pointer carries across the room. */
  const light = (event: ReactPointerEvent<HTMLElement>) => {
    if (reducedMotion || event.pointerType === 'touch') return;
    const el = surface.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${((event.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty('--my', `${((event.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <section
      id="ch-threshold"
      data-chapter
      data-stop
      data-stop-label={t('chapterWelcome')}
      data-hero
      ref={surface}
      className="threshold"
      aria-labelledby="threshold-title"
      onPointerMove={light}
    >
      <FilmBackdrop
        videoId={featuredVideo.id}
        title={film.title}
        poster={thumbUrl(featuredVideo.id, 'sd')}
        reducedMotion={reducedMotion}
        delay={150}
      />
      <div className="threshold-veil" aria-hidden="true" />
      {/* one light over the film — the lightpainting alone, as on the gate */}
      <LightPainting
        tone="dark"
        painters={2}
        interactive
        reducedMotion={reducedMotion}
        speed={0.5}
        className="depth-layer"
      />
      <span className="spot" aria-hidden="true" />

      <div className="threshold-hud" aria-hidden="true">
        <span className="hud-tag">
          <i className="hud-dot is-rec" />
          REC · {film.duration}
        </span>
        <span className="hud-readout">
          R—{pad(1)} / {pad(total)}
        </span>
      </div>

      <div className="threshold-inner">
        <p className="kicker kicker-dark">
          <Decipher text={`${t('nowShowing')} · ${t('filmKicker')}`} reducedMotion={reducedMotion} />
        </p>
        <h1 id="threshold-title" className="threshold-title">
          <SplitText text={t('hallTitleA')} reducedMotion={reducedMotion} delay={140} />{' '}
          {/*
           * The glowing line keeps its whole-word treatment — a gradient clipped to text cannot
           * be per-letter without each letter restarting the spectrum — so it rises as one beat
           * in a wrapper of its own, once the plain words have finished arriving.
           */}
          <span className={reducedMotion ? undefined : 'em-rise'}>
            <em className="spectrum-text" data-text={t('hallTitleB')}>
              {t('hallTitleB')}
            </em>
          </span>
        </h1>
        <p className="threshold-lede serif-lede">{station.tagline}</p>

        <a className="threshold-film" href={hrefFor({ kind: 'station', stationId: station.id })}>
          <span className="threshold-film-label">{film.title}</span>
          <span className="threshold-film-meta">{film.meta}</span>
        </a>

        {/* The programmes are titles, not tabs: each one opens its shelf in the room. */}
        <ul className="threshold-shelves">
          {shelves.map((shelf) => (
            <li key={shelf.id}>
              <a href={hrefFor({ kind: 'station', stationId: station.id, shelf: shelf.id })}>
                <b>{shelf.short}</b>
                <i>{pad(shelf.videos.length)}</i>
              </a>
            </li>
          ))}
        </ul>

        <div className="threshold-actions">
          <a className="btn-glow" href={hrefFor({ kind: 'station', stationId: station.id })} data-cursor="open">
            <span className="btn-glow-fill" aria-hidden="true" />
            <span className="btn-glow-label spectrum-text" data-text={t('openScreening')}>
              {t('openScreening')}
            </span>
            <i className="btn-glow-node" aria-hidden="true" />
          </a>
          <a
            className="btn btn-dark"
            href="#ch-rooms"
            data-cursor="walk"
            onClick={(event) => {
              const target = document.getElementById('ch-rooms');
              if (!target) return;
              event.preventDefault();
              /* through the engine, so this is the same glide as the wheel and the arrow keys */
              scrollToY(window.scrollY + target.getBoundingClientRect().top, !reducedMotion);
            }}
          >
            {t('beginTour')}
          </a>
        </div>
      </div>

      <div className="threshold-cue" aria-hidden="true">
        <span>{t('scrollHint')}</span>
        <i />
      </div>
    </section>
  );
}

/* ================================================================ chapter three: the rooms */

type RevealState = { src: string; from: DOMRect; label: string; href: string };

function RoomWalk({ rooms, reducedMotion }: { rooms: Station[]; reducedMotion: boolean }) {
  const { t } = useLang();
  const [reveal, setReveal] = useState<RevealState | null>(null);

  return (
    <section id="ch-rooms" data-chapter className="rooms" aria-labelledby="rooms-title">
      <header className="rooms-head section">
        <Reveal>
          <p className="kicker">{t('corridorKicker')}</p>
          <h2 id="rooms-title">{t('corridorTitle')}</h2>
          <p className="serif-lede measure">{t('corridorLede')}</p>
        </Reveal>
      </header>

      {rooms.map((room, i) => (
        <RoomPanel
          key={room.id}
          room={room}
          index={i}
          reducedMotion={reducedMotion}
          onEnter={setReveal}
        />
      ))}

      {reveal ? (
        <DoorReveal
          src={reveal.src}
          from={reveal.from}
          label={reveal.label}
          onDone={() => {
            window.location.hash = reveal.href;
            setReveal(null);
          }}
        />
      ) : null}
    </section>
  );
}

function RoomPanel({
  room,
  index,
  reducedMotion,
  onEnter,
}: {
  room: Station;
  index: number;
  reducedMotion: boolean;
  onEnter: (state: RevealState) => void;
}) {
  const { t } = useLang();
  const cover = deckCovers.get(room.id);
  const href = hrefFor({ kind: 'station', stationId: room.id });
  const motif = motifFor(room);
  const number = index + 2;
  /* A room's air moves a little slower than the room, which is what reads as depth. */
  const panel = useRef<HTMLElement>(null);
  useDepth(panel, 0.08, reducedMotion);
  const count =
    room.exhibits.length > 0 ? `${pad(room.exhibits.length)} ${t('works')}` : t('profile');

  /** Opening a room is a door, not a page load: the cover grows to fill the screen first. */
  const enter = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (reducedMotion || !cover) return;
    event.preventDefault();
    const panel = (event.currentTarget as HTMLElement).closest('.room-panel');
    const art = panel?.querySelector<HTMLImageElement>('.room-panel-art .artwork');
    const rect = art
      ? art.getBoundingClientRect()
      : (event.currentTarget as HTMLElement).getBoundingClientRect();
    onEnter({ src: cover.small, from: rect, label: room.label, href });
  };

  return (
    <article
      ref={panel}
      className={`room-panel${index % 2 ? ' is-flipped' : ''}`}
      data-stop
      data-stop-label={room.label}
      data-stop-group={t('chapterRooms')}
      data-stop-href={href}
      style={{ ['--panel-accent' as string]: room.accent }}
    >
      <Motif kind={motif} className="depth-layer" />
      <LightPainting
        tone="dark"
        still
        painters={3}
        seed={number * 977}
        weight={0.85}
        className="depth-layer"
      />

      <div className="room-panel-inner">
        <Reveal className="room-panel-copy">
          <span className="room-panel-no">R—{pad(number)}</span>
          <h3 className="room-panel-title">{room.label}</h3>
          <p className="room-panel-lede serif-lede">{room.tagline}</p>
          <span className="room-panel-meta">{count}</span>
          <a className="room-panel-enter lit" href={href} onClick={enter} data-cursor="open">
            <span>{t('enterRoom')}</span>
            <i aria-hidden="true">→</i>
          </a>
        </Reveal>

        <Reveal className="room-panel-art" delay={140}>
          <a className="room-panel-frame" href={href} onClick={enter} tabIndex={-1} aria-hidden="true">
            {cover ? (
              <Artwork image={cover} sizes="(max-width: 900px) 88vw, 44vw" />
            ) : (
              <LightPlate id={room.id} title={room.label} />
            )}
            <span className="hud-corner is-tl" />
            <span className="hud-corner is-br" />
          </a>
        </Reveal>
      </div>
    </article>
  );
}

/* ================================================================ chapter four: the figures */

function Figures({
  stations,
  reducedMotion,
  scrollProgress,
}: {
  stations: Station[];
  reducedMotion: boolean;
  scrollProgress: number;
}) {
  const { t } = useLang();
  const works = stations.reduce((sum, s) => sum + s.exhibits.length, 0);
  const years = new Date().getFullYear() - 2011;
  const stats: [string, string][] = [
    [`${years}`, t('statYears')],
    [pad(stations.length), t('statRooms')],
    [pad(works), t('statWorks')],
    [pad(videoCount()), t('statFilms')],
  ];
  const titles = Array.from(new Set(stations.flatMap((s) => s.exhibits.map((e) => e.title))));
  const section = useRef<HTMLElement>(null);
  useDepth(section, 0.09, reducedMotion);

  return (
    <section
      id="ch-figures"
      data-chapter
      data-stop
      data-stop-label={t('statWorks')}
      data-stop-group={t('chapterFigures')}
      className="figures"
      aria-label={t('collection')}
      ref={section}
    >
      <Motif kind="tubes" className="depth-layer" />
      <RadiantLight
        sources={4}
        reducedMotion={reducedMotion}
        weight={1.3}
        speed={0.4}
        seed={2011}
        scrollProgress={scrollProgress}
        className="depth-layer"
      />

      <div className="figures-inner">
        <Reveal className="figures-head">
          <p className="kicker kicker-dark">{t('collection')}</p>
          <h2>{t('statWorks')}</h2>
        </Reveal>

        <div className="figures-grid">
          {stats.map(([value, label], i) => (
            <Reveal key={label} className="figure" delay={i * 90}>
              <b>
                <Decipher text={value} reducedMotion={reducedMotion} duration={1200} />
              </b>
              <span>{label}</span>
            </Reveal>
          ))}
        </div>
      </div>

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <span key={copy}>
              {titles.map((title) => (
                <em key={title}>{title}</em>
              ))}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================ chapter five: the way out */

function Visit({ reducedMotion }: { reducedMotion: boolean }) {
  const { t, stations } = useLang();
  const contactRoom = stations.find((s) => s.id === 'hubungi');
  const mapsQuery = encodeURIComponent('PORT Ipoh, Jalan Sultan Azlan Shah, 31400 Ipoh, Perak');
  const section = useRef<HTMLElement>(null);
  useDepth(section, 0.09, reducedMotion);

  return (
    <>
      <section
        id="ch-visit"
        data-chapter
        data-stop
        data-stop-label={t('visitTitle')}
        data-stop-group={t('chapterVisit')}
        className="visit"
        aria-labelledby="visit-title"
        ref={section}
      >
        <Motif kind="aperture" className="depth-layer" />
        <RadiantLight
          sources={3}
          weight={1.05}
          speed={0.45}
          seed={77}
          reducedMotion={reducedMotion}
          className="depth-layer"
        />
        <LightPainting
          tone="dark"
          painters={2}
          still
          seed={77}
          weight={0.95}
          reducedMotion={reducedMotion}
          className="depth-layer"
        />
        <div className="visit-veil" aria-hidden="true" />

        <div className="visit-inner">
          <Reveal className="visit-lead">
            <p className="kicker kicker-dark">{t('visitKicker')}</p>
            <h2 id="visit-title">{t('visitTitle')}</h2>
            {contactRoom ? <p className="visit-lede serif-lede">{contactRoom.intro[1]}</p> : null}
            <p className="visit-note">{t('visitNote')}</p>
          </Reveal>

          <Reveal className="visit-card glass-dark lit" delay={140}>
            <dl>
              <div>
                <dt>{t('address')}</dt>
                <dd>
                  {contact.name}
                  <br />
                  {contact.addressLines.join(', ')}
                </dd>
              </div>
              <div>
                <dt>{t('phone')}</dt>
                <dd>
                  <a href={contact.phoneHref}>{contact.phone}</a>
                </dd>
              </div>
              <div>
                <dt>{t('email')}</dt>
                <dd>
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                </dd>
              </div>
            </dl>
            <div className="visit-links">
              <a className="btn btn-dark" href={hrefFor({ kind: 'station', stationId: 'hubungi' })}>
                {t('contact')}
              </a>
              <a
                className="btn btn-dark"
                href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                {t('directions')}
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="site-footer">
        <div className="site-footer-brand">
          <b>PORT</b>
          <span>unity thru arts</span>
        </div>
        <p>
          {t('footerSource')}{' '}
          <a href={contentMeta.source} target="_blank" rel="noreferrer noopener">
            portipoh.com
          </a>{' '}
          · People Of Remarkable Talents · Ipoh, Perak
        </p>
      </footer>
    </>
  );
}
