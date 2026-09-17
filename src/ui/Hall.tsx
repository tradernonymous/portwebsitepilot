import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { contact, contentMeta, deckCovers, type Station } from '../content';
import { localizeFeatured } from '../content/en';
import { featuredVideo, thumbUrl, videoCount } from '../content/videos';
import { hrefFor } from '../lib/hooks';
import { useLang } from '../lib/lang';
import { HERO_ROOM, pad, tourOrder } from '../lib/order';
import { Artwork, LightPlate } from './Artwork';
import { DoorReveal } from './DoorReveal';
import { Exhibition } from './Exhibition';
import { FilmBackdrop } from './FilmBackdrop';
import { Decipher } from './fx/Decipher';
import { LightPainting } from './fx/LightPainting';
import { RadiantLight } from './fx/RadiantLight';
import { PrismShards } from './fx/PrismShards';

type Props = {
  reducedMotion: boolean;
};

/**
 * The hall: the screening room as the hero, then the main corridor — every other room hung
 * along one continuous line of light that the visitor walks as they scroll.
 */
export function Hall({ reducedMotion }: Props) {
  const { stations } = useLang();
  const tour = tourOrder(stations);
  const hero = tour.find((s) => s.id === HERO_ROOM);
  const rooms = tour.filter((s) => s.id !== HERO_ROOM);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const p = maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
      setScrollProgress(p);
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

  return (
    <div className="hall">
      {hero ? <HallHero station={hero} reducedMotion={reducedMotion} scrollProgress={scrollProgress} /> : null}
      <Exhibition reducedMotion={reducedMotion} />
      <Pipeline rooms={rooms} reducedMotion={reducedMotion} />
      <HallStats stations={stations} reducedMotion={reducedMotion} scrollProgress={scrollProgress} />
      <HallVisit reducedMotion={reducedMotion} />
    </div>
  );
}

/* ================================================================== hero: the screening room */

function HallHero({ station, reducedMotion, scrollProgress }: { station: Station; reducedMotion: boolean; scrollProgress: number }) {
  const { t, lang } = useLang();
  const film = localizeFeatured(featuredVideo, lang);
  const shelves = station.videoShelves ?? [];

  return (
    <section className="hall-hero" data-hero aria-labelledby="hall-hero-title">
      <FilmBackdrop
        videoId={featuredVideo.id}
        title={film.title}
        poster={thumbUrl(featuredVideo.id, 'sd')}
        reducedMotion={reducedMotion}
        delay={150}
      />
      <div className="hall-hero-veil" aria-hidden="true" />
      <LightPainting tone="dark" painters={2} interactive reducedMotion={reducedMotion} speed={0.5} />
      <RadiantLight sources={3} interactive reducedMotion={reducedMotion} weight={1.0} speed={0.6} seed={7} scrollProgress={scrollProgress} />

      <div className="hall-hero-hud" aria-hidden="true">
        <span className="hud-tag">
          <i className="hud-dot is-rec" />
          REC · {film.duration}
        </span>
        <span className="hud-readout">R—{pad(1)} / {pad(8)}</span>
      </div>

      <div className="hall-hero-inner">
        <p className="kicker kicker-dark">
          <Decipher text={`${t('nowShowing')} · ${t('filmKicker')}`} reducedMotion={reducedMotion} />
        </p>
        <h1 id="hall-hero-title" className="hall-hero-title">
          <a href={hrefFor({ kind: 'station', stationId: station.id })}>{station.label}</a>
        </h1>
        <p className="hall-hero-lede">{station.tagline}</p>

        <a className="hall-hero-film" href={hrefFor({ kind: 'station', stationId: station.id })}>
          <span className="hall-hero-film-label">{film.title}</span>
          <span className="hall-hero-film-meta">{film.meta}</span>
        </a>

        {/* The programmes are titles, not tabs: each one opens its shelf in the room. */}
        <ul className="hall-hero-shelves">
          {shelves.map((shelf) => (
            <li key={shelf.id}>
              <a href={hrefFor({ kind: 'station', stationId: station.id, shelf: shelf.id })}>
                <b>{shelf.short}</b>
                <i>{pad(shelf.videos.length)}</i>
              </a>
            </li>
          ))}
        </ul>

        <a className="btn-glow" href={hrefFor({ kind: 'station', stationId: station.id })}>
          <span className="btn-glow-fill" aria-hidden="true" />
          <span className="btn-glow-label spectrum-text" data-text={t('openScreening')}>
            {t('openScreening')}
          </span>
          <i className="btn-glow-node" aria-hidden="true" />
        </a>
      </div>

      <div className="hall-hero-cue" aria-hidden="true">
        <span>{t('scrollHint')}</span>
        <i />
      </div>
    </section>
  );
}

/* ================================================================== the corridor pipeline */

type Sample = { len: number; x: number; y: number };

/**
 * The rooms, strung along a single line of light.
 *
 * On a wide screen the corridor is pinned while the page scrolls and the rooms slide past
 * sideways, the way you walk along a gallery wall. On a phone, or with reduced motion, the
 * rooms simply stack and the line runs down beside them. Either way the line is lit up to
 * where the visitor has walked, with a torch at its head — the light painter's hand — and
 * each room's node lights as it is reached.
 *
 * The scroll work touches only transforms, one dash offset and two SVG attributes, inside
 * one animation frame per scroll burst; React does not re-render while walking.
 */
type RevealState = {
  src: string;
  from: DOMRect;
  label: string;
  href: string;
};

function Pipeline({ rooms, reducedMotion }: { rooms: Station[]; reducedMotion: boolean }) {
  const { t, stations } = useLang();
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const uid = useId().replace(/:/g, '');
  const sectionRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const basePath = useRef<SVGPathElement>(null);
  const litPath = useRef<SVGPathElement>(null);
  const glowPath = useRef<SVGPathElement>(null);
  const torch = useRef<SVGGElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const counter = useRef<HTMLElement>(null);
  const bar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const svg = svgRef.current;
    if (!section || !viewport || !track || !svg) return;

    const wide = window.matchMedia('(min-width: 900px)');
    let horizontal = false;
    let overflow = 0;
    let total = 0;
    let samples: Sample[] = [];
    let nodes: { x: number; y: number }[] = [];
    let doors: HTMLElement[] = [];
    let raf = 0;
    let lastActive = -2;

    const layout = () => {
      horizontal = wide.matches && !reducedMotion;
      section.classList.toggle('is-horizontal', horizontal);
      track.style.transform = '';

      overflow = horizontal ? Math.max(0, track.offsetWidth - viewport.clientWidth) : 0;
      section.style.height = horizontal ? `${window.innerHeight + overflow}px` : '';

      const trackRect = track.getBoundingClientRect();
      doors = Array.from(track.querySelectorAll<HTMLElement>('[data-door]'));
      nodes = doors.map((door) => {
        const node = door.querySelector('.door-node')!.getBoundingClientRect();
        return { x: node.left + node.width / 2 - trackRect.left, y: node.top + node.height / 2 - trackRect.top };
      });
      const w = track.offsetWidth;
      const h = track.offsetHeight;
      svg.setAttribute('width', String(w));
      svg.setAttribute('height', String(h));
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      if (nodes.length < 2) return;

      // lead in from the corridor's mouth, weave through every node, and run on past the last
      const lead = horizontal ? { x: 0, y: nodes[0].y } : { x: nodes[0].x, y: 0 };
      const tail = horizontal
        ? { x: w, y: nodes[nodes.length - 1].y }
        : { x: nodes[nodes.length - 1].x, y: h };
      const points = [lead, ...nodes, tail];
      let d = `M${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i += 1) {
        const a = points[i - 1];
        const b = points[i];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const amp = Math.min(90, len * 0.22) * (i % 2 ? 1 : -1);
        d += `C${a.x + dx / 3 + nx * amp} ${a.y + dy / 3 + ny * amp} ${b.x - dx / 3 - nx * amp} ${b.y - dy / 3 - ny * amp} ${b.x} ${b.y}`;
      }
      for (const path of [basePath.current, litPath.current, glowPath.current]) path?.setAttribute('d', d);
      const lit = litPath.current!;
      total = lit.getTotalLength();
      samples = [];
      for (let len = 0; len <= total; len += 12) {
        const p = lit.getPointAtLength(len);
        samples.push({ len, x: p.x, y: p.y });
      }
      for (const path of [litPath.current, glowPath.current]) {
        path?.setAttribute('stroke-dasharray', `${total} ${total}`);
      }
      lastActive = -2;
      update();
    };

    const update = () => {
      raf = 0;
      if (!samples.length) return;
      const rect = section.getBoundingClientRect();
      let reach: number;
      if (horizontal) {
        const travel = Math.max(1, rect.height - window.innerHeight);
        const p = Math.min(1, Math.max(0, -rect.top / travel));
        const shift = p * overflow;
        track.style.transform = `translate3d(${-shift}px,0,0)`;
        reach = shift + viewport.clientWidth * 0.5;
        if (bar.current) bar.current.style.transform = `scaleX(${Math.max(0.015, p)})`;
      } else {
        const trackTop = track.getBoundingClientRect().top;
        reach = window.innerHeight * 0.62 - trackTop;
        const p = Math.min(1, Math.max(0, reach / Math.max(1, track.offsetHeight)));
        if (bar.current) bar.current.style.transform = `scaleX(${Math.max(0.015, p)})`;
      }

      // the lit length is where the line crosses the visitor's position along the corridor
      const axis = horizontal ? 'x' : 'y';
      let sample = samples[samples.length - 1];
      for (const s of samples) {
        if (s[axis] >= reach) {
          sample = s;
          break;
        }
      }
      if (reach <= 0) sample = samples[0];
      const offset = String(total - sample.len);
      litPath.current?.setAttribute('stroke-dashoffset', offset);
      glowPath.current?.setAttribute('stroke-dashoffset', offset);
      torch.current?.setAttribute('transform', `translate(${sample.x} ${sample.y})`);

      let active = -1;
      nodes.forEach((node, i) => {
        if (node[axis] <= reach + 2) active = i;
      });
      if (active !== lastActive) {
        lastActive = active;
        doors.forEach((door, i) => {
          door.classList.toggle('is-lit', i <= active);
          door.classList.toggle('is-active', i === active);
        });
        if (counter.current) counter.current.textContent = pad(Math.max(1, active + 1) + 1);
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    layout();
    // covers arrive after the first layout and change the track's size
    const ro = new ResizeObserver(() => layout());
    ro.observe(track);
    ro.observe(viewport);
    window.addEventListener('scroll', onScroll, { passive: true });
    wide.addEventListener('change', layout);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      wide.removeEventListener('change', layout);
      section.style.height = '';
    };
  }, [rooms.length, reducedMotion]);

  /** A little tilt towards the pointer, so a door leans in as you reach for it. */
  const tilt = (event: ReactPointerEvent<HTMLElement>) => {
    if (reducedMotion || event.pointerType === 'touch') return;
    const el = event.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (event.clientX - r.left) / r.width - 0.5;
    const y = (event.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--ry', `${x * 10}deg`);
    el.style.setProperty('--rx', `${-y * 8}deg`);
    el.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
    el.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
  };
  const untilt = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.style.removeProperty('--rx');
    event.currentTarget.style.removeProperty('--ry');
  };

  return (
    <section className="pipeline" ref={sectionRef} aria-labelledby="pipeline-title">
      <div className="pipeline-sticky">
        <header className="pipeline-head">
          <div>
            <p className="kicker">{t('corridorKicker')}</p>
            <h2 id="pipeline-title">{t('corridorTitle')}</h2>
            <p className="pipeline-lede">{t('corridorLede')}</p>
          </div>
          <div className="pipeline-meter" aria-hidden="true">
            <span className="pipeline-count">
              <b ref={counter}>{pad(2)}</b> / {pad(stations.length)}
            </span>
            <span className="pipeline-bar">
              <span ref={bar} />
            </span>
          </div>
        </header>

        <div className="pipeline-viewport" ref={viewportRef}>
          <div className="pipeline-track" ref={trackRef}>
            <svg className="pipeline-svg" ref={svgRef} aria-hidden="true">
              <defs>
                <linearGradient id={`pipe-${uid}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1600" y2="400" spreadMethod="reflect">
                  <stop offset="0" stopColor="#00b8d9" />
                  <stop offset="0.33" stopColor="#7c4dff" />
                  <stop offset="0.66" stopColor="#f0339f" />
                  <stop offset="1" stopColor="#ff9d1c" />
                </linearGradient>
                <radialGradient id={`torch-${uid}`}>
                  <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="0.25" stopColor="#8b5cff" stopOpacity="0.55" />
                  <stop offset="1" stopColor="#3de8ff" stopOpacity="0" />
                </radialGradient>
              </defs>
              <path ref={basePath} className="pipe-base" />
              <path ref={glowPath} className="pipe-glow" stroke={`url(#pipe-${uid})`} />
              <path ref={litPath} className="pipe-lit" stroke={`url(#pipe-${uid})`} />
              <g ref={torch} className="pipe-torch">
                <circle r="30" fill={`url(#torch-${uid})`} />
                <circle r="5" fill="#ffffff" stroke="#7c4dff" strokeWidth="2" />
              </g>
            </svg>

            {rooms.map((room, i) => {
              const cover = deckCovers.get(room.id);
              const number = i + 2;
              const href = hrefFor({ kind: 'station', stationId: room.id });
              const count =
                room.exhibits.length > 0 ? `${pad(room.exhibits.length)} ${t('works')}` : t('profile');
              return (
                <article
                  key={room.id}
                  className={`door${i % 2 ? ' is-low' : ''}`}
                  data-door
                  style={{ ['--door-accent' as string]: room.accent }}
                >
                  <a
                    className="door-frame"
                    href={href}
                    tabIndex={-1}
                    aria-hidden="true"
                    onPointerMove={tilt}
                    onPointerLeave={untilt}
                    onClick={(e) => {
                      if (reducedMotion || !cover) return;
                      e.preventDefault();
                      const img = (e.currentTarget as HTMLElement).querySelector('.artwork') as HTMLImageElement | null;
                      const rect = img
                        ? img.getBoundingClientRect()
                        : (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setReveal({ src: cover.small, from: rect, label: room.label, href });
                    }}
                  >
                    <span className="door-art">
                      {cover ? (
                        <Artwork image={cover} sizes="(max-width: 900px) 86vw, 380px" />
                      ) : (
                        <LightPlate id={room.id} title={room.label} />
                      )}
                    </span>
                    <span className="door-sheen" />
                    <span className="hud-corner is-tl" />
                    <span className="hud-corner is-tr" />
                    <span className="hud-corner is-bl" />
                    <span className="hud-corner is-br" />
                  </a>
                  <span className="door-node" aria-hidden="true" />
                  <div className="door-label">
                    <span className="door-index">
                      R—{pad(number)} <i>{count}</i>
                    </span>
                    <h3>
                      <a href={href}>{room.label}</a>
                    </h3>
                    <p>{room.tagline}</p>
                  </div>
                </article>
              );
            })}
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
            <div className="pipeline-end" aria-hidden="true">
              <PrismShards className="pipeline-end-prism" seed={31} reflection={false} />
              <b>Unity Thru Arts</b>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== figures */

function HallStats({ stations, reducedMotion, scrollProgress }: { stations: Station[]; reducedMotion: boolean; scrollProgress: number }) {
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

  return (
    <section className="hall-stats" aria-label={t('collection')}>
      <LightPainting tone="dark" painters={2} still seed={2011} weight={1.0} />
      <RadiantLight sources={4} reducedMotion weight={1.3} speed={0.4} seed={2011} scrollProgress={scrollProgress} />
      <div className="hall-stats-grid">
        {stats.map(([value, label]) => (
          <div key={label} className="stat">
            <b>
              <Decipher text={value} reducedMotion={reducedMotion} duration={1200} />
            </b>
            <span>{label}</span>
          </div>
        ))}
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

function HallVisit({ reducedMotion }: { reducedMotion: boolean }) {
  const { t, stations } = useLang();
  const contactRoom = stations.find((s) => s.id === 'hubungi');
  const mapsQuery = encodeURIComponent('PORT Ipoh, Jalan Sultan Azlan Shah, 31400 Ipoh, Perak');

  return (
    <>
      <section className="hall-visit" aria-labelledby="visit-title">
        {/* The last room of the gallery: light on a dark wall, and the address on glass. */}
        <LightPainting tone="dark" painters={2} still seed={77} weight={1.0} reducedMotion={reducedMotion} />
        <RadiantLight sources={3} weight={1.15} speed={0.45} seed={77} reducedMotion={reducedMotion} />
        <div className="hall-visit-veil" aria-hidden="true" />

        <div className="hall-visit-inner">
          <div className="hall-visit-lead">
            <p className="kicker kicker-dark">{t('visitKicker')}</p>
            <h2 id="visit-title">{t('visitTitle')}</h2>
            {contactRoom ? <p className="hall-visit-lede">{contactRoom.intro[1]}</p> : null}
            <p className="hall-visit-note">{t('visitNote')}</p>
          </div>

          <dl className="hall-visit-card">
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
            <div className="hall-visit-links">
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
          </dl>
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
