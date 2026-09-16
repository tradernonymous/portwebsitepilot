import { useEffect, useState } from 'react';
import { entranceImage } from '../content';
import { channel, embedUrl, featuredVideo, watchUrl } from '../content/videos';
import { Glyph } from './Glyph';

type Props = {
  /** The 3D space has finished building and is waiting. */
  ready: boolean;
  reducedMotion: boolean;
  onEnter: () => void;
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
export function EntryGate({ ready, reducedMotion, onEnter, onSkipToDeck, onFlat }: Props) {
  const [filmUp, setFilmUp] = useState(false);
  const [filmLive, setFilmLive] = useState(false);

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

  /*
   * The film is only brought forward once the player says it is actually running.
   *
   * Fading it in on `iframe.onload` looked right and was wrong: a player that refuses the
   * video — embedding switched off by the owner, a blocked request, a hotel network — also
   * fires `load`, having rendered YouTube's own "This video is unavailable" card. The gate
   * then greeted every visitor with a black screen and an error message. Now the poster
   * photograph stays until the player reports a playing (or buffering) state, and stays for
   * good if it never does, which is the same screen a visitor with data saving on sees.
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
      // An embed the owner has switched off reports itself as an error, and that card is
      // exactly what must never be the welcome screen.
      if ((payload as { event?: unknown }).event === 'onError') return;
      const info = (payload as { info?: { playerState?: unknown } }).info;
      const state = typeof info?.playerState === 'number' ? info.playerState : null;
      // 1 playing, 2 paused, 3 buffering, 5 cued.
      //
      // Cued and paused count. A phone that will not autoplay parks the player on 5 with
      // the film's own frame and a play button, and that is a film the visitor can start
      // with one tap — refusing to show it until it plays by itself is what made the
      // entry screen look like a still photograph on a phone.
      if (state === 1 || state === 2 || state === 3 || state === 5) setFilmLive(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [filmUp]);

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
          />
        </div>
      ) : null}

      {/* Keeps the wordmark legible over a film that changes colour shot to shot. */}
      <div className="gate-veil" aria-hidden="true" />

      <div className="gate-inner">
        <p className="gate-kicker">Est. 2011 · Ipoh, Perak</p>
        <h1 className="gate-mark">PORT</h1>
        <p className="gate-sub">People Of Remarkable Talents</p>

        <p className="gate-welcome">
          Sedia nak terokai dunia <em>SENI</em>?
        </p>
        <p className="gate-line">Jemput masuk, pintu kami sentiasa terbuka...</p>

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
                ? 'Masuk ke dek'
                : 'Masuk ke PORT'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onSkipToDeck}
            disabled={!ready}
          >
            Langkau animasi
          </button>
          <button type="button" className="btn btn-ghost" onClick={onFlat}>
            Senarai biasa
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
        <span>
          {featuredVideo.title}
          <i>
            {channel.handle} · tonton dengan bunyi
          </i>
        </span>
      </a>
    </div>
  );
}
