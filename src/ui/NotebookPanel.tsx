import { useEffect, useState } from 'react';
import { collectedAsText, resolveCollected, shareCollected, useCollected } from '../lib/collected';
import { hrefFor, useDialogFocus } from '../lib/hooks';
import { useLang } from '../lib/lang';
import { Artwork } from './Artwork';

/**
 * The visitor's notebook, open.
 *
 * The works the visitor kept, in the order they kept them, each as a small hanging with its
 * room's name and its address — so the list outlives the visit: read it here, share it, or
 * clear it and begin again. It borrows the help panel's dialog chrome; nothing about the
 * house style changes for it.
 *
 * The share acknowledgement lives in the panel (`aria-live`), so a visitor who taps Share
 * hears as well as sees that something happened.
 */
export function NotebookPanel({ onClose }: { onClose: () => void }) {
  const { t, stations } = useLang();
  const { works, clear } = useCollected();
  const scroller = useDialogFocus<HTMLDivElement>('notebook');
  const [ack, setAck] = useState<null | 'copied'>(null);

  const entries = resolveCollected(works, stations);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onShare = async () => {
    const text = collectedAsText(entries, window.location.origin);
    const outcome = await shareCollected(text);
    if (outcome === 'copied') {
      setAck('copied');
      window.setTimeout(() => setAck(null), 2600);
    }
  };

  return (
    <>
      <div className="panel-scrim" onClick={onClose} role="presentation" />
      <section className="panel centered" role="dialog" aria-modal="true" aria-label={t('notebookTitle')}>
        <div className="panel-top">
          <div className="panel-title">
            <p className="panel-kicker">{t('notebook')}</p>
            <h2>{t('notebookTitle')}</h2>
            <p className="lede">{t('notebookLede')}</p>
          </div>
          <button type="button" className="icon-btn close-btn" onClick={onClose} aria-label={t('close')} title={t('close')}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3Z"
              />
            </svg>
          </button>
        </div>

        <div className="panel-body" ref={scroller} tabIndex={-1}>
          {entries.length === 0 ? (
            <p className="notebook-empty">{t('notebookEmpty')}</p>
          ) : (
            <ul className="notebook-list">
              {entries.map(({ station, exhibit, index }) => (
                <li key={`${station.id}/${exhibit.id}`}>
                  <a className="notebook-row" href={hrefFor({ kind: 'exhibit', stationId: station.id, index })} onClick={onClose}>
                    {exhibit.images[0] ? (
                      <span className="notebook-thumb">
                        <Artwork image={exhibit.images[0]} alt="" sizes="120px" />
                      </span>
                    ) : (
                      <span className="notebook-thumb is-plate" aria-hidden="true" />
                    )}
                    <span className="notebook-row-text">
                      <b>{exhibit.title}</b>
                      <small>{station.label}</small>
                    </span>
                    <i aria-hidden="true">→</i>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {entries.length > 0 ? (
          <div className="notebook-actions">
            <p className="notebook-ack" role="status" aria-live="polite">
              {ack ? t('notebookCopied') : ''}
            </p>
            <button type="button" className="btn" onClick={onShare}>
              {t('notebookShare')}
            </button>
            <button type="button" className="btn btn-dark" onClick={clear}>
              {t('notebookClear')}
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}
