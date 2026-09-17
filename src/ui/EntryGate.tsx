import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { entranceImage } from '../content';
import { localizeFeatured } from '../content/en';
import { channel, featuredVideo, watchUrl } from '../content/videos';
import { useLang } from '../lib/lang';
import { FilmBackdrop } from './FilmBackdrop';
import { Decipher } from './fx/Decipher';
import { LightPainting } from './fx/LightPainting';
import { RadiantLight } from './fx/RadiantLight';
import { PrismShards } from './fx/PrismShards';
import { Glyph } from './Glyph';

type Props = {
  reducedMotion: boolean;
  onEnter: () => void;
  onFlat: () => void;
};

/**
 * The threshold: a dark room with PORT's festival film running on the wall, figures of light
 * being painted in the air, and one glowing way in.
 */
export function EntryGate({ reducedMotion, onEnter, onFlat }: Props) {
  const { t, lang, toggle } = useLang();
  const film = localizeFeatured(featuredVideo, lang);
  const enterRef = useRef<HTMLButtonElement>(null);
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    enterRef.current?.focus({ preventScroll: true });
  }, []);

  /** The light the pointer drags across the room before you have chosen anything. */
  const light = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (reducedMotion || event.pointerType === 'touch') return;
    const el = surface.current;
    if (!el) return;
    el.style.setProperty('--mx', `${(event.clientX / window.innerWidth) * 100}%`);
    el.style.setProperty('--my', `${(event.clientY / window.innerHeight) * 100}%`);
  };

  return (
    <div
      className="gate"
      role="dialog"
      aria-modal="true"
      aria-label={t('gateLabel')}
      ref={surface}
      onPointerMove={light}
    >
      <FilmBackdrop
        videoId={featuredVideo.id}
        title={film.title}
        poster={entranceImage?.large}
        reducedMotion={reducedMotion}
      />
      <div className="gate-veil" aria-hidden="true" />
      <div className="aurora" aria-hidden="true" />
      <LightPainting tone="dark" painters={3} interactive reducedMotion={reducedMotion} weight={0.8} speed={0.6} />
      <RadiantLight sources={5} interactive reducedMotion={reducedMotion} weight={1.2} speed={0.7} seed={13} />
      <PrismShards className="gate-prism" seed={7} />
      <div className="gate-grid" aria-hidden="true" />
      <span className="spot" aria-hidden="true" />

      <div className="gate-hud" aria-hidden="true">
        <span className="hud-corner is-tl" />
        <span className="hud-corner is-tr" />
        <span className="hud-corner is-bl" />
        <span className="hud-corner is-br" />
      </div>

      <div className="gate-top">
        <span className="hud-tag">
          <i className="hud-dot" />
          <Decipher text="PORT // GALERI.CAHAYA" reducedMotion={reducedMotion} duration={900} />
        </span>
        <button type="button" className="chip chip-dark" onClick={toggle} aria-label={t('switchLang')} title={t('switchLang')}>
          <span className={lang === 'ms' ? 'is-on' : ''}>BM</span>
          <i aria-hidden="true">/</i>
          <span className={lang === 'en' ? 'is-on' : ''}>EN</span>
        </button>
      </div>

      <div className="gate-inner">
        <p className="gate-kicker">
          <Decipher text={t('est')} reducedMotion={reducedMotion} delay={200} />
        </p>
        {/* Set in the logo's own lettering: PORT over "unity thru arts" */}
        <h1 className="gate-mark wordmark" aria-label="PORT — unity thru arts">
          <span className="wordmark-port" data-text="PORT" aria-hidden="true">
            PORT
          </span>
          <span className="wordmark-tag" aria-hidden="true">
            unity thru arts
          </span>
        </h1>
        <p className="gate-sub">{t('subtitle')}</p>

        <p className="gate-welcome">
          {t('welcomeBefore')}{' '}
          <em className="spectrum-text" data-text={t('welcomeArt')}>
            {t('welcomeArt')}
          </em>
          {t('welcomeAfter')}
        </p>
        <p className="gate-line">{t('line')}</p>

        <div className="gate-actions">
          <button type="button" className="btn-glow" onClick={onEnter} ref={enterRef} data-cursor="enter">
            <span className="btn-glow-fill" aria-hidden="true" />
            <span className="btn-glow-label spectrum-text" data-text={t('enter')}>
              {t('enter')}
            </span>
            <i className="btn-glow-node" aria-hidden="true" />
          </button>
          <button type="button" className="btn btn-dark" onClick={onFlat} data-cursor="read">
            {t('listView')}
          </button>
        </div>
      </div>

      <div className="gate-bottom">
        <span className="hud-readout" aria-hidden="true">
          4.5975° N · 101.0901° E
        </span>
        {/* The film is mute and unclickable, so the credit is how anyone can reach it. */}
        <a
          className="gate-credit"
          href={watchUrl(featuredVideo.id)}
          target="_blank"
          rel="noreferrer noopener"
          title={`${film.title} — ${channel.name}`}
        >
          <Glyph glyph="video" size={14} />
          <span className="gate-credit-text">
            <small>{t('nowShowing')}</small>
            <b>{film.title}</b>
          </span>
          <span className="gate-credit-sound">
            {channel.handle} · {t('watchWithSound')}
          </span>
        </a>
      </div>
    </div>
  );
}
