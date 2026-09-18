import { useEffect, useState } from 'react';
import type { Station } from '../content';
import { channel, embedUrl, thumbUrl, watchUrl, type PortVideo } from '../content/videos';
import { useLang } from '../lib/lang';
import { pad } from '../lib/order';
import { Glyph } from './Glyph';

type Props = {
  station: Station;
  /** Open on this programme's shelf rather than the first. */
  initialShelf?: string;
  /** Show the room's own introduction above the screen. */
  showIntro?: boolean;
};

/**
 * The screening room: PORT's films on shelves.
 *
 * The channel is a flat wall of uploads in reverse date order, which is no way to meet an
 * institution's work. Here each film belongs to the programme it came from — the stage, the
 * symposium, the interview series, the festival — so a visitor picks a programme first and
 * a recording second.
 */
export function VideoRoom({ station, initialShelf, showIntro = false }: Props) {
  const { t } = useLang();
  const shelves = station.videoShelves ?? [];
  const startShelf = shelves.find((s) => s.id === initialShelf) ?? shelves[0];
  const [openShelf, setOpenShelf] = useState(startShelf?.id ?? '');
  const [playing, setPlaying] = useState(startShelf?.videos[0]?.id ?? '');
  const [playerState, setPlayerState] = useState<'loading' | 'ready' | 'fallback'>('loading');
  /**
   * The screening room's own full screen. Not the browser's: the point is to take the shelf,
   * the labels and the rest of the page away and leave one lit rectangle in a dark house, and
   * the browser's own fullscreen would only take the chrome.
   */
  const [cinema, setCinema] = useState(false);

  useEffect(() => {
    if (!cinema) return;
    document.body.classList.add('is-cinema');
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCinema(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('is-cinema');
      window.removeEventListener('keydown', onKey);
    };
  }, [cinema]);

  /* Leaving the room leaves the screening. */
  useEffect(() => {
    setCinema(false);
  }, [station.id]);

  // A link to a different shelf (from the hall) while the room is already open.
  useEffect(() => {
    const target = shelves.find((s) => s.id === initialShelf);
    if (!target) return;
    setOpenShelf(target.id);
    setPlaying(target.videos[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialShelf]);

  const shelf = shelves.find((s) => s.id === openShelf) ?? shelves[0];
  const current: PortVideo | undefined = shelf?.videos.find((v) => v.id === playing) ?? shelf?.videos[0];

  // The player is always shown once it has loaded — a visitor presses play inside it, and
  // YouTube sends no "playing" report before that, so waiting for one hid a working film.
  // The branded fallback replaces it only when YouTube explicitly refuses (onError).
  useEffect(() => {
    setPlayerState('loading');
    if (!current) return;
    const onMessage = (event: MessageEvent) => {
      if (typeof event.origin !== 'string' || !/youtube\.com$/.test(event.origin)) return;
      let payload: unknown = event.data;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }
      if (!payload || typeof payload !== 'object') return;
      if ((payload as { event?: unknown }).event === 'onError') {
        setPlayerState('fallback');
        return;
      }
      setPlayerState((prev) => (prev === 'fallback' ? prev : 'ready'));
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, [current?.id]);

  const openShelfById = (id: string) => {
    setOpenShelf(id);
    const first = shelves.find((s) => s.id === id)?.videos[0];
    if (first) setPlaying(first.id);
  };

  if (!shelf || !current) {
    return (
      <section className="video-room">
        <p className="video-empty">
          {t('videoEmptyA')}{' '}
          <a href={channel.videosUrl} target="_blank" rel="noreferrer noopener">
            {t('videoEmptyLink')}
          </a>
          .
        </p>
      </section>
    );
  }

  return (
    <section className="video-room" aria-label={station.label}>
      {showIntro ? (
        <div className="video-intro serif-body">
          {station.intro.map((para) => (
            <p key={para}>{para}</p>
          ))}
        </div>
      ) : null}

      <div className="video-body">
        <div className="video-player">
          <div className={`video-stage is-${playerState}${cinema ? ' is-cinema' : ''}`}>
            {/* Keyed on the id so switching films mounts a fresh player rather than leaving
                the previous one's audio running underneath. */}
            <iframe
              key={current.id}
              src={embedUrl(current.id, { controls: true, api: true })}
              title={current.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              onLoad={(event) => {
                event.currentTarget.contentWindow?.postMessage('{"event":"listening"}', '*');
                setPlayerState((prev) => (prev === 'fallback' ? prev : 'ready'));
              }}
            />
            {playerState !== 'ready' ? (
              <div className="video-fallback">
                <img src={thumbUrl(current.id, 'hq')} alt="" />
                <div className="video-fallback-shade" />
                <div className="video-fallback-copy">
                  <Glyph glyph="video" size={18} />
                  <p>{playerState === 'loading' ? t('connecting') : t('opensOnYoutube')}</p>
                  <a href={watchUrl(current.id)} target="_blank" rel="noreferrer noopener">
                    {t('watchOnYoutube')}
                  </a>
                </div>
              </div>
            ) : null}
            {cinema ? (
              <button
                type="button"
                className="video-cinema-exit"
                onClick={() => setCinema(false)}
                data-cursor="close"
              >
                {t('cinemaExit')}
                <i aria-hidden="true">Esc</i>
              </button>
            ) : null}
            <span className="hud-corner is-tl" aria-hidden="true" />
            <span className="hud-corner is-tr" aria-hidden="true" />
            <span className="hud-corner is-bl" aria-hidden="true" />
            <span className="hud-corner is-br" aria-hidden="true" />
          </div>
          <div className="video-under">
            <div>
              <p className="kicker">{shelf.label}</p>
              <h3>{current.title}</h3>
              <p className="video-note">{current.note ?? current.meta}</p>
            </div>
            <div className="video-under-actions">
              <button
                type="button"
                className="btn is-cinema-btn"
                onClick={() => setCinema(true)}
                data-cursor="view"
              >
                {t('cinemaEnter')}
              </button>
              <a className="btn" href={watchUrl(current.id)} target="_blank" rel="noreferrer noopener">
                {t('openOnYoutube')}
              </a>
            </div>
          </div>
        </div>

        {/* the shelf stays where it is; while the film is up it simply is not there to reach */}
        <div className="video-shelf" inert={cinema}>
          {/* Programme titles, not tabs */}
          <div className="video-programmes" role="tablist" aria-label={t('videoProgrammes')}>
            {shelves.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.id === shelf.id}
                className={`video-programme${s.id === shelf.id ? ' is-active' : ''}`}
                onClick={() => openShelfById(s.id)}
              >
                {s.short}
                <i>{pad(s.videos.length)}</i>
              </button>
            ))}
          </div>
          <p className="video-tagline">{shelf.tagline}</p>

          <div className="video-list">
            {shelf.videos.map((video, i) => {
              const nowPlaying = video.id === current.id;
              return (
                <button
                  key={video.id}
                  type="button"
                  className={`video-card lit${nowPlaying ? ' is-playing' : ''}`}
                  aria-current={nowPlaying ? 'true' : undefined}
                  data-cursor="play"
                  onClick={() => setPlaying(video.id)}
                >
                  <span className="video-thumb">
                    <img src={thumbUrl(video.id, 'mq')} alt="" loading="lazy" />
                    <span className="video-time">{video.duration}</span>
                  </span>
                  <span className="video-meta">
                    <i>
                      {pad(i + 1)} · {nowPlaying ? t('nowPlaying') : video.meta}
                    </i>
                    <b>{video.title}</b>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="video-source">
        {t('allRecordingsFrom')}{' '}
        <a href={channel.videosUrl} target="_blank" rel="noreferrer noopener">
          {channel.handle}
        </a>{' '}
        {t('onYoutube')}
      </p>
    </section>
  );
}
