import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { entranceImage } from '../content';
import { localizeFeatured } from '../content/en';
import { channel, embedUrl, featuredVideo, watchUrl } from '../content/videos';
import { useLang } from '../lib/lang';
import { Decipher } from './fx/Decipher';
import { LightPainting } from './fx/LightPainting';
import { Orb } from './fx/Orb';
import { Glyph } from './Glyph';

type Props = {
  reducedMotion: boolean;
  onEnter: () => void;
  onFlat: () => void;
};

/**
 * How long the player is given to report a refusal before the film is shown anyway. Long
 * enough for an embed that YouTube will not serve to say so, short enough that nobody
 * watches a still photograph wondering where the film went.
 */
const REFUSAL_GRACE_MS = 900;

/**
 * The threshold: a dark room with PORT's festival film running on the wall, light being
 * painted across it, and one glowing way in.
 *
 * The film is shown by default and hidden only on evidence that it cannot play — a player
 * that refuses reports `onError` over postMessage, which is the one report that arrives
 * reliably. The photograph underneath is the poster, so the screen is never blank while the
 * film loads, and on a slow or data-saving connection the poster is all that loads.
 */
export function EntryGate({ reducedMotion, onEnter, onFlat }: Props) {
  const { t, lang, toggle } = useLang();
  const film = localizeFeatured(featuredVideo, lang);
  const [filmUp, setFilmUp] = useState(false);
  const [filmLive, setFilmLive] = useState(false);
  const refused = useRef(false);
  const revealTimer = useRef<number | null>(null);
  const enterRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    enterRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? '')) return;
    // A beat after the gate is on screen: the welcome never waits on an embed.
    const id = window.setTimeout(() => setFilmUp(true), 500);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(
    () => () => {
      if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!filmUp) return;
    const onMessage = (event: MessageEvent) => {
      if (typeof event.origin !== 'string' || !/youtube(-nocookie)?\.com$/.test(event.origin)) {
        return;
      }
      let payload: unknown = event.data;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }
      if (!payload || typeof payload !== 'object') return;
      if ((payload as { event?: unknown }).event !== 'onError') return;
      refused.current = true;
      if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
      setFilmLive(false);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [filmUp]);

  const onFilmLoad = (event: SyntheticEvent<HTMLIFrameElement>) => {
    event.currentTarget.contentWindow?.postMessage('{"event":"listening"}', '*');
    revealTimer.current = window.setTimeout(() => {
      if (!refused.current) setFilmLive(true);
    }, REFUSAL_GRACE_MS);
  };

  return (
    <div className="gate" role="dialog" aria-modal="true" aria-label={t('gateLabel')}>
      {entranceImage ? (
        <div
          className={`gate-photo${filmLive ? ' is-behind-film' : ''}`}
          style={{ backgroundImage: `url("${entranceImage.large}")` }}
          aria-hidden="true"
        />
      ) : null}

      {filmUp ? (
        <div className={`gate-film${filmLive ? ' is-live' : ''}`} aria-hidden="true">
          <iframe
            src={embedUrl(featuredVideo.id, { autoplay: true, loop: true, controls: false, api: true })}
            title={film.title}
            tabIndex={-1}
            allow="autoplay; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={onFilmLoad}
          />
        </div>
      ) : null}

      <div className="gate-veil" aria-hidden="true" />
      <LightPainting tone="dark" painters={4} interactive reducedMotion={reducedMotion} weight={1.1} speed={0.8} />
      <div className="gate-grid" aria-hidden="true" />

      {/* HUD corners — the room's instrument panel */}
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
        <button
          type="button"
          className="chip chip-dark"
          onClick={toggle}
          aria-label={t('switchLang')}
          title={t('switchLang')}
        >
          <span className={lang === 'ms' ? 'is-on' : ''}>BM</span>
          <i aria-hidden="true">/</i>
          <span className={lang === 'en' ? 'is-on' : ''}>EN</span>
        </button>
      </div>

      <div className="gate-inner">
        <Orb className="gate-orb" rings={10} period={36} />
        <p className="gate-kicker">
          <Decipher text={t('est')} reducedMotion={reducedMotion} delay={200} />
        </p>
        <h1 className="gate-mark" data-text="PORT">
          PORT
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
          <button type="button" className="btn-glow" onClick={onEnter} ref={enterRef}>
            <span className="btn-glow-fill" aria-hidden="true" />
            <span className="btn-glow-label spectrum-text" data-text={t('enter')}>
              {t('enter')}
            </span>
            <svg className="btn-glow-arrow" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M13.2 5.3 20 12l-6.8 6.7-1.4-1.4 4.3-4.3H4v-2h12.1l-4.3-4.3Z" />
            </svg>
          </button>
          <button type="button" className="btn btn-dark" onClick={onFlat}>
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
            {channel.handle} · {t('watchWithSound')} ↗
          </span>
        </a>
      </div>
    </div>
  );
}
