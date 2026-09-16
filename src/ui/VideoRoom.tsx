import { useState } from 'react';
import type { Station } from '../content';
import { channel, embedUrl, thumbUrl, watchUrl, type PortVideo } from '../content/videos';
import { useDialogFocus } from '../lib/hooks';
import { Glyph } from './Glyph';

type Props = {
  station: Station;
  /**
   * Present when the room is a panel standing over the space, absent when it is a section
   * inside the plain list. The same component serves both, so a film can never exist in
   * one view of PORT and be missing from the other.
   */
  onClose?: () => void;
};

/**
 * The screening room: PORT's films, on shelves.
 *
 * The channel is a flat wall of a hundred uploads in reverse date order, which is no way
 * to meet an institution's work. Here each film belongs to the programme it came from —
 * the interview series, the symposium, the stage — so a visitor picks a programme first
 * and a recording second, and every card is the same size and shape whatever the footage
 * behind it happens to be.
 */
export function VideoRoom({ station, onClose }: Props) {
  const shelves = station.videoShelves ?? [];
  const [openShelf, setOpenShelf] = useState(shelves[0]?.id ?? '');
  const [playing, setPlaying] = useState(shelves[0]?.videos[0]?.id ?? '');
  const modal = Boolean(onClose);
  // Only the panel variant takes focus; the inline one must leave the page where it is.
  const scroller = useDialogFocus<HTMLDivElement>(`${station.id}:${modal ? 'panel' : 'inline'}`);

  const shelf = shelves.find((s) => s.id === openShelf) ?? shelves[0];
  const current: PortVideo | undefined =
    shelf?.videos.find((v) => v.id === playing) ?? shelf?.videos[0];

  const openShelfById = (id: string) => {
    setOpenShelf(id);
    // Opening a programme lands you on its first film — the recording that leads it.
    const first = shelves.find((s) => s.id === id)?.videos[0];
    if (first) setPlaying(first.id);
  };

  if (!shelf || !current) {
    return (
      <section className="video-room">
        <p className="video-empty">
          Rakaman sedang disusun. Sementara itu, seluruh arkib video PORT boleh ditonton di{' '}
          <a href={channel.videosUrl} target="_blank" rel="noreferrer noopener">
            saluran YouTube kami
          </a>
          .
        </p>
      </section>
    );
  }

  const body = (
    <div className="video-body">
      <div className="video-player">
        <div className="video-stage">
          {/* Keyed on the id so switching films mounts a fresh player rather than
              leaving the previous one's audio running underneath. */}
          <iframe
            key={current.id}
            src={embedUrl(current.id, { controls: true })}
            title={current.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
        <div className="video-under">
          <div>
            <p className="video-kicker" style={{ color: station.accent }}>
              {shelf.label}
            </p>
            <h3>{current.title}</h3>
            <p className="video-note">{current.note ?? current.meta}</p>
          </div>
          <a
            className="btn btn-ghost"
            href={watchUrl(current.id)}
            target="_blank"
            rel="noreferrer noopener"
          >
            Buka di YouTube →
          </a>
        </div>
      </div>

      <div className="video-shelf">
        <div className="video-tabs" role="tablist" aria-label="Program video">
          {shelves.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === shelf.id}
              className={`video-tab${s.id === shelf.id ? ' is-active' : ''}`}
              onClick={() => openShelfById(s.id)}
            >
              {s.short}
              <i>{s.videos.length}</i>
            </button>
          ))}
        </div>
        <p className="video-tagline">{shelf.tagline}</p>

        <div className="video-list">
          {shelf.videos.map((video) => {
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
                  <img src={thumbUrl(video.id, 'hq')} alt="" loading="lazy" />
                  <span className="video-time">{video.duration}</span>
                  <span className="video-badge" aria-hidden="true">
                    {nowPlaying ? 'Sedang dimainkan' : 'Main'}
                  </span>
                </span>
                <span className="video-meta">
                  <b>{video.title}</b>
                  <i>{video.meta}</i>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (!modal) {
    return (
      <section className="video-room is-inline" aria-label={station.label}>
        <ShelvesIntro station={station} />
        {body}
        <p className="video-source">
          Semua rakaman dimuatkan dari{' '}
          <a href={channel.videosUrl} target="_blank" rel="noreferrer noopener">
            {channel.handle}
          </a>{' '}
          di YouTube.
        </p>
      </section>
    );
  }

  return (
    <>
      <div className="panel-scrim" onClick={onClose} role="presentation" />
      <section
        className="panel video-panel"
        role="dialog"
        aria-modal="true"
        aria-label={station.label}
        style={{ borderLeftColor: station.accent }}
      >
        <div className="panel-top">
          <div className="panel-title">
            <p className="panel-kicker" style={{ color: station.accent }}>
              Stesen
            </p>
            <h2>
              <Glyph glyph={station.glyph} size={20} /> {station.label}
            </h2>
            <p className="lede">{station.tagline}</p>
          </div>
          <button
            type="button"
            className="icon-btn close-btn"
            onClick={onClose}
            aria-label="Tutup"
            title="Tutup"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3Z"
              />
            </svg>
          </button>
        </div>
        <div className="panel-body" ref={scroller} tabIndex={-1}>
          {body}
          <p className="video-source">
            Semua rakaman dimuatkan dari{' '}
            <a href={channel.videosUrl} target="_blank" rel="noreferrer noopener">
              {channel.handle}
            </a>{' '}
            di YouTube.
          </p>
        </div>
      </section>
    </>
  );
}

/** The station's own words, shown where the room is a page rather than a panel. */
function ShelvesIntro({ station }: { station: Station }) {
  return (
    <>
      {station.intro.map((para) => (
        <p key={para} className="video-lede">
          {para}
        </p>
      ))}
    </>
  );
}
