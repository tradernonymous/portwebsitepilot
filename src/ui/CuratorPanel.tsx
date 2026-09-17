import type { GalleryPosition } from '../lib/gallery';
import { useLang } from '../lib/lang';

/**
 * The Curator's Eye: the readout wearing the curator's voice.
 *
 * The walk is the gallery mode's own — same stops, same keys, same glide. What the tour adds
 * is a note at every stop and the willingness to move on its own: a line about what you are
 * standing in front of, where you are, and one button that stops the walking.
 *
 * `role="status"` keeps it a polite live region, so the tour is heard as well as read.
 */
export function CuratorPanel({
  position,
  paused,
  onPause,
  onExit,
}: {
  position: GalleryPosition;
  /** True while the visitor has stopped the auto-advance; the frame cools to say so. */
  paused: boolean;
  onPause: () => void;
  onExit: () => void;
}) {
  const { t } = useLang();
  /* Paused on the last stop is not a rest — it is the tour being over. */
  const done = paused && position.index === position.total - 1;

  return (
    <div className={`gallery-hud curator${paused ? ' is-paused' : ''}`} role="status" aria-live="polite">
      <span className="gallery-hud-pos">
        <b>{String(position.index + 1).padStart(2, '0')}</b>
        <i aria-hidden="true">/</i>
        <span>{String(position.total).padStart(2, '0')}</span>
      </span>
      <span className="gallery-hud-text">
        <small>
          {t('curatorNote')}
          {position.group ? ` · ${position.group}` : ''}
        </small>
        <b>{position.label}</b>
        {/* The note itself: the stop's own line — or the closing line, at the end of the walk. */}
        <em className="curator-note">{done ? t('curatorDone') : position.note ?? t('curatorWorkNote')}</em>
      </span>
      {!done ? (
        <button type="button" className="gallery-hud-exit" onClick={onPause} data-cursor="esc">
          {t(paused ? 'curatorResume' : 'curatorPause')}
        </button>
      ) : null}
      <button type="button" className="gallery-hud-exit" onClick={onExit} data-cursor="esc">
        {t('galleryExit')}
        <i aria-hidden="true">Esc</i>
      </button>
    </div>
  );
}
