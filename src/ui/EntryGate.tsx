import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { entranceImage } from '../content';
import { channel, embedUrl, featuredVideo, watchUrl } from '../content/videos';
import { Glyph } from './Glyph';

type Props = {
  /** The 3D space has finished building and is waiting. */
  ready: boolean;
  reducedMotion: boolean;
  language?: 'ms' | 'en';
  onEnter: () => void;
  onToggleLanguage?: () => void;
  onSkipToDeck: () => void;
  onFlat: () => void;
};

/**
 * The threshold. Held on screen until the visitor chooses to walk in, so the
 * flythrough is always something they asked for rather than something that
 * happened to them.
 *
 * Behind it, PORT's own festival film plays: the first thing anyone meets here is the
 * work, not a photograph of the building. The photograph stays underneath as the poster,
 * so the screen is never blank while the film loads and is never empty at all if YouTube
 * cannot be reached — and on a phone with a slow connection, or with data saving on, the
 * poster alone is what loads.
 */
/**
 * How long the player is given to report a refusal before the film is shown anyway. Long
 * enough for an embed that YouTube will not serve to say so, short enough that nobody
 * watches a still photograph wondering where the film went.
 */
const REFUSAL_GRACE_MS = 900;

export function EntryGate({ ready, reducedMotion, language = 'ms', onEnter, onToggleLanguage, onSkipToDeck, onFlat }: Props) {
  const english = language === 'en';
  const [filmUp, setFilmUp] = useState(false);
  const [filmLive, setFilmLive] = useState(false);
  /** Set once the player has told us it cannot play this video at all. */
  const refused = useRef(false);
  const revealTimer = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion) return;
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? '')) return;
    // A beat after the gate is on screen: the welcome never waits on an embed.
    const id = window.setTimeout(() => setFilmUp(true), 700);
    return () => window.clearTimeout(id);
  }, [reducedMotion]);

  useEffect(
    () => () => {
      if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
    },
    [],
  );

  /*
   * The film is shown by default, and hidden only on evidence that it cannot play.
   *
   * The reverse — waiting for the player to report a playing state before showing anything —
   * was tried, and it is the wrong way round: those reports only arrive when the player is
   * willing to talk, and where they do not the gate greeted everyone with a still photograph
   * and no film at all, on exactly the devices this was supposed to help. What the player
   * does report reliably, to a page that enables its API, is a refusal: an embed the owner
   * has switched off, a blocked request, a network that will not serve YouTube. So the film
   * comes forward once it has loaded, and steps back again if a refusal arrives first.
   */
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

  /**
   * The player has loaded something. Ask it to report itself — a refusal then arrives inside
   * the grace period — and bring the film forward unless it has already refused.
   */
  const onFilmLoad = (event: SyntheticEvent<HTMLIFrameElement>) => {
    event.currentTarget.contentWindow?.postMessage('{"event":"listening"}', '*');
    revealTimer.current = window.setTimeout(() => {
      if (!refused.current) setFilmLive(true);
    }, REFUSAL_GRACE_MS);
  };

  return (
    <div className="gate" role="dialog" aria-modal="true" aria-label="Masuk ke ruang PORT">
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
            src={embedUrl(featuredVideo.id, {
              autoplay: true,
              loop: true,
              controls: false,
              api: true,
            })}
            title={featuredVideo.title}
            loading="lazy"
            tabIndex={-1}
            allow="autoplay; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={onFilmLoad}
          />
        </div>
      ) : null}

      {/* Keeps the wordmark legible over a film that changes colour shot to shot. */}
      <div className="gate-veil" aria-hidden="true" />
      <button
        type="button"
        className="gate-language"
        onClick={onToggleLanguage}
        aria-label={english ? 'Tukar ke Bahasa Melayu' : 'Switch to English'}
      >
        {english ? 'BM' : 'EN'}
      </button>

      <div className="gate-inner">
        <p className="gate-kicker">Est. 2011 · Ipoh, Perak</p>
        <h1 className="gate-mark">PORT</h1>
        <p className="gate-sub">People Of Remarkable Talents</p>

        <p className="gate-welcome">
          {english ? <>Ready to explore the world of <em>ART</em>?</> : <>Sedia nak terokai dunia <em>SENI</em>?</>}
        </p>
        <p className="gate-line">
          {english ? 'Come in, our doors are always open...' : 'Jemput masuk, pintu kami sentiasa terbuka...'}
        </p>

        <div className="gate-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onEnter}
            disabled={!ready}
          >
            {!ready
              ? 'Menyediakan ruang…'
              : reducedMotion
                ? english ? 'Enter the deck' : 'Masuk ke dek'
                : english ? 'Enter PORT' : 'Masuk ke PORT'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onSkipToDeck}
            disabled={!ready}
          >
            {english ? 'Skip animation' : 'Langkau animasi'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onFlat}>
            {english ? 'List view' : 'Senarai biasa'}
          </button>
        </div>
      </div>

      {/* The film is mute and unclickable, so the credit is how anyone can reach it. */}
      <a
        className="gate-credit"
        href={watchUrl(featuredVideo.id)}
        target="_blank"
        rel="noreferrer noopener"
        title={`${featuredVideo.title} — ${channel.name}`}
      >
        <Glyph glyph="video" size={13} />
        <span>            {featuredVideo.title}
          <i>
            {channel.handle} · {english ? 'watch with sound' : 'tonton dengan bunyi'}
          </i>
        </span>
      </a>
    </div>
  );
}
