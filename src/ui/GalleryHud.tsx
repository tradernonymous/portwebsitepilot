import type { GalleryPosition } from '../lib/gallery';
import { useLang } from '../lib/lang';

/**
 * The gallery mode readout: where you are, what it is called, and how to keep going.
 *
 * `role="status"` with a polite live region, so a screen reader hears each new position as
 * the visitor walks rather than having to hunt for it.
 */
export function GalleryHud({
  position,
  inRoom,
  onExit,
}: {
  position: GalleryPosition;
  /** Rooms walk works rather than chapters, so the key lesson changes. */
  inRoom: boolean;
  onExit: () => void;
}) {
  const { t } = useLang();
  const kind = inRoom ? t('galleryWork') : t('galleryStop');

  return (
    <div className="gallery-hud" role="status" aria-live="polite">
      <span className="gallery-hud-pos">
        <b>{String(position.index + 1).padStart(2, '0')}</b>
        <i aria-hidden="true">/</i>
        <span>{String(position.total).padStart(2, '0')}</span>
      </span>
      <span className="gallery-hud-text">
        <small>
          {kind}
          {position.group ? ` · ${position.group}` : ''}
        </small>
        <b>{position.label}</b>
      </span>
      {/* Only promise Enter where Enter goes somewhere; a room's own door has no destination. */}
      <span className="gallery-hud-keys" aria-hidden="true">
        {position.href ? (inRoom ? t('galleryKeysRoom') : t('galleryKeys')) : t('galleryKeysPlain')}
      </span>
      <button type="button" className="gallery-hud-exit" onClick={onExit}>
        {t('galleryExit')}
        <i aria-hidden="true">Esc</i>
      </button>
    </div>
  );
}
