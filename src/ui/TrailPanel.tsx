import type { CuratedTrail } from '../content/trails';
import { useDialogFocus } from '../lib/hooks';
import { useLang } from '../lib/lang';

export function TrailPanel({
  trails,
  activeTrail,
  activeIndex,
  open,
  onStart,
  onNavigate,
  onExit,
  onClose,
  onChange,
}: {
  trails: CuratedTrail[];
  activeTrail: CuratedTrail | null;
  activeIndex: number;
  open: boolean;
  onStart: (trail: CuratedTrail) => void;
  onNavigate: (index: number) => void;
  onExit: () => void;
  onClose: () => void;
  onChange: () => void;
}) {
  const { t, lang } = useLang();
  const pickerRef = useDialogFocus<HTMLDivElement>(open && !activeTrail ? 'trail-picker' : 'closed');
  if (!open) return null;

  if (!activeTrail) {
    return (
      <>
        <div className="panel-scrim trail-scrim" onClick={onClose} role="presentation" />
        <section
          ref={pickerRef}
          className="panel trail-picker"
          role="dialog"
          aria-modal="true"
          aria-label={t('trailTitle')}
          tabIndex={-1}
        >
          <div className="panel-top">
            <div className="panel-title">
              <p className="panel-kicker">{t('trailKicker')}</p>
              <h2>{t('trailTitle')}</h2>
              <p className="lede">{t('trailLede')}</p>
            </div>
            <button type="button" className="icon-btn close-btn" onClick={onClose} aria-label={t('close')} title={t('close')}>
              ×
            </button>
          </div>
          <div className="trail-list">
            {trails.map((trail) => {
              const copy = trail.copy[lang];
              return (
                <button key={trail.id} type="button" className="trail-card" onClick={() => onStart(trail)}>
                  <span className="trail-card-top">
                    <b>{copy.title}</b>
                    <i>{trail.minutes} min</i>
                  </span>
                  <span>{copy.lede}</span>
                  <small>{trail.stops.length} {lang === 'ms' ? 'hentian' : 'stops'} · {lang === 'ms' ? 'Mulakan' : 'Begin'} →</small>
                </button>
              );
            })}
          </div>
        </section>
      </>
    );
  }

  const stop = activeTrail.stops[activeIndex];
  const copy = activeTrail.copy[lang];
  const done = activeIndex === activeTrail.stops.length - 1;

  return (
    <aside className={`trail-hud${done ? ' is-done' : ''}`} aria-label={t('trailTitle')}>
      <div className="trail-hud-head">
        <span className="panel-kicker">{t('trailKicker')}</span>
        <b>{copy.title}</b>
        <span className="trail-count">{String(activeIndex + 1).padStart(2, '0')} / {String(activeTrail.stops.length).padStart(2, '0')}</span>
      </div>
      <div className="trail-hud-body">
        <strong>{stop.label[lang]}</strong>
        <p>{stop.note[lang]}</p>
      </div>
      {done ? <p className="trail-done">{t('trailDone')}</p> : null}
      <div className="trail-hud-actions">
        <button type="button" className="trail-action" onClick={onChange}>{t('trailChange')}</button>
        <button type="button" className="trail-action" onClick={() => onNavigate(activeIndex - 1)} disabled={activeIndex <= 0}>{t('trailPrevious')}</button>
        {!done ? <button type="button" className="trail-action is-next" onClick={() => onNavigate(activeIndex + 1)}>{t('trailNext')} →</button> : null}
        <button type="button" className="trail-action" onClick={onExit}>{t('trailExit')}</button>
      </div>
    </aside>
  );
}
