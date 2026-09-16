import { useEffect } from 'react';
import { useDialogFocus } from '../lib/hooks';
import { useLang } from '../lib/lang';

type Props = {
  onClose: () => void;
  reducedMotion: boolean;
  /** Kept for callers; the copy is written to work for a cursor and a finger alike. */
  coarsePointer?: boolean;
};

export function HelpPanel({ onClose, reducedMotion }: Props) {
  const scroller = useDialogFocus<HTMLDivElement>('help');
  const { t } = useLang();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items = [
    ['helpCorridorTitle', 'helpCorridorBody'],
    ['helpRoomTitle', 'helpRoomBody'],
    ['help3dTitle', 'help3dBody'],
    ['helpA11yTitle', 'helpA11yBody'],
  ] as const;

  return (
    <>
      <div className="panel-scrim" onClick={onClose} role="presentation" />
      <section className="panel centered" role="dialog" aria-modal="true" aria-label={t('helpTitle')}>
        <div className="panel-top">
          <div className="panel-title">
            <p className="panel-kicker">{t('help')}</p>
            <h2>{t('helpTitle')}</h2>
            <p className="lede">{t('helpLede')}</p>
          </div>
          <button
            type="button"
            className="icon-btn close-btn"
            onClick={onClose}
            aria-label={t('close')}
            title={t('close')}
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
          <div className="help-grid">
            {items.map(([title, body], i) => (
              <div key={title}>
                <h4>
                  <span className="help-index">{String(i + 1).padStart(2, '0')}</span> {t(title)}
                </h4>
                <p>{t(body)}</p>
              </div>
            ))}
          </div>
          {reducedMotion ? <p className="help-note">{t('reducedMotionOn')}</p> : null}
        </div>
      </section>
    </>
  );
}
