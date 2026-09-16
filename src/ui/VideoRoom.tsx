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

  // Keep YouTube's own error card out of PORT: a working player reports a usable state, a
  // refused embed reports onError, and a silent player gets a branded fallback.
  useEffect(() => {
    setPlayerState('loading');
    if (!current) return;
    const fallbackTimer = window.setTimeout(() => setPlayerState('fallback'), 4500);
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
      const state = (payload as { info?: { playerState?: unknown } }).info?.playerState;
      if (state === 1 || state === 2 || state === 3 || state === 5) setPlayerState('ready');
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.clearTimeout(fallbackTimer);
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
        <div className="video-intro">
          {station.intro.map((para) => (
            <p key={para}>{para}</p>
          ))}
        </div>
      ) : null}

      <div className="video-body">
        <div className="video-player">
          <div className={`video-stage is-${playerState}`}>
            {/* Keyed on the id so switching films mounts a fresh player rather than leaving
                the previous one's audio running underneath. */}
            <iframe
              key={current.id}
              src={embedUrl(current.id, { controls: true, api: true })}
              title={current.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              onLoad={(event) => event.currentTarget.contentWindow?.postMessage('{"event":"listening"}', '*')}
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
            <a className="btn" href={watchUrl(current.id)} target="_blank" rel="noreferrer noopener">
              {t('openOnYoutube')}
            </a>
          </div>
        </div>

        <div className="video-shelf">
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
                  className={`video-card${nowPlaying ? ' is-playing' : ''}`}
                  aria-current={nowPlaying ? 'true' : undefined}
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
