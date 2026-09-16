import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { embedUrl } from '../content/videos';

/**
 * How long the player is given to report a refusal before the film is shown anyway. Long
 * enough for an embed that YouTube will not serve to say so, short enough that nobody
 * watches a still photograph wondering where the film went.
 */
const REFUSAL_GRACE_MS = 900;

/**
 * A muted, looping film that fills its box, over a poster that is always there first.
 *
 * The film is shown by default and hidden only on evidence that it cannot play: a player
 * that refuses (embedding switched off, a blocked request, no network) reports `onError`
 * over postMessage, which is the one report that arrives reliably. On a data-saving or 2G
 * connection, and with reduced motion, the poster is all that loads.
 */
export function FilmBackdrop({
  videoId,
  title,
  poster,
  delay = 500,
  reducedMotion = false,
  className,
}: {
  videoId: string;
  title: string;
  poster?: string;
  delay?: number;
  reducedMotion?: boolean;
  className?: string;
}) {
  const [filmUp, setFilmUp] = useState(false);
  const [filmLive, setFilmLive] = useState(false);
  const refused = useRef(false);
  const revealTimer = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion) return;
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? '')) return;
    const id = window.setTimeout(() => setFilmUp(true), delay);
    return () => window.clearTimeout(id);
  }, [delay, reducedMotion]);

  useEffect(
    () => () => {
      if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!filmUp) return;
    const onMessage = (event: MessageEvent) => {
      if (typeof event.origin !== 'string' || !/youtube(-nocookie)?\.com$/.test(event.origin)) return;
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
    <div className={`film-backdrop${className ? ` ${className}` : ''}`} aria-hidden="true">
      {poster ? (
        <div
          className={`film-poster${filmLive ? ' is-behind-film' : ''}`}
          style={{ backgroundImage: `url("${poster}")` }}
        />
      ) : null}
      {filmUp ? (
        <div className={`film-frame${filmLive ? ' is-live' : ''}`}>
          <iframe
            src={embedUrl(videoId, { autoplay: true, loop: true, controls: false, api: true })}
            title={title}
            tabIndex={-1}
            allow="autoplay; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={onFilmLoad}
          />
        </div>
      ) : null}
    </div>
  );
}
