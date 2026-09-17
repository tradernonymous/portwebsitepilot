import type { CuratedTrail, TrailStop } from '../content/trails';
import { stopCopy, trailCopy } from '../content/trails';
import type { Lang } from '../content/i18n';
import { useDialogFocus } from '../lib/hooks';
import { useLang } from '../lib/lang';

function TrailCard({ trail, lang, onStart }: { trail: CuratedTrail; lang: Lang; onStart: () => void }) {
  const copy = trailCopy(trail, lang);
  return (
    <button type="button" className="trail-card" onClick={onStart}>
      <span className="trail-card-top">
        <b>{copy.title}</b>
        <i>{trail.minutes} min</i>
      </span>
      <span>{copy.lede}</span>
      <small>{trail.stops.length} {lang === 'ms' ? 'hentian' : 'stops'} · {lang === 'ms' ? 'Mulakan' : 'Begin'} →</small>
    </button>
  );
}

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
  const pickerRef = useDialogFocus<HTMLDivElement>(activeTrail ? 'active-trail' : open ? 'trail-picker' : 'closed');
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
            {trails.map((trail) => (
              <TrailCard key={trail.id} trail={trail} lang={lang} onStart={() => onStart(trail)} />
            ))}
          </div>
        </section>
      </>
    );
  }

  const stop: TrailStop = activeTrail.stops[Math.max(0, Math.min(activeTrail.stops.length - 1, activeIndex))];
  const copy = trailCopy(activeTrail, lang);
  const stopText = stopCopy(stop, lang);
  const done = activeIndex >= activeTrail.stops.length - 1;

  return (
    <aside className={`trail-hud${done ? ' is-done' : ''}`} aria-label={t('trailTitle')}>
      <div className="trail-hud-head">
        <span className="panel-kicker">{t('trailKicker')}</span>
        <b>{copy.title}</b>
        <span className="trail-count">{String(Math.min(activeIndex + 1, activeTrail.stops.length)).padStart(2, '0')} / {String(activeTrail.stops.length).padStart(2, '0')}</span>
      </div>
      <div className="trail-hud-body">
        <strong>{stopText.title}</strong>
        <p>{stopText.lede}</p>
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
