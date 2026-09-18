import { useEffect, useState } from 'react';
import { useLang } from '../lib/lang';
import type { I18nKey } from '../content/i18n';

/** Remembered so the guide is a first visit and not a fixture. */
export const FIRST_RUN_KEY = 'port.tour';

type Props = {
  onDone: () => void;
};

const STEPS: { title: I18nKey; body: I18nKey }[] = [
  { title: 'firstRunA', body: 'firstRunABody' },
  { title: 'firstRunB', body: 'firstRunBBody' },
  { title: 'firstRunC', body: 'firstRunCBody' },
];

/**
 * The first visit, explained once.
 *
 * The hall is deliberately not a website: there is no menu of pages at the top, no obvious
 * "start here". A returning visitor knows to scroll and to open a door; someone who has never
 * seen it is standing in a dark room with a lit word in front of them and no instruction.
 *
 * So it is said once, plainly, for three beats, and then never again. A few decisions keep it
 * from becoming a second gate:
 *
 *  - It is not a dialog. No scrim, no focus trap, nothing behind it made unreachable — a note
 *    left on the table rather than a door held shut.
 *  - It retires on its own the moment the visitor scrolls. The advice has been taken; standing
 *    there repeating it would be the one thing that makes it feel like an obstacle.
 *  - It appears after the gate, never before it. Two full-screen introductions in a row is one
 *    too many.
 *  - Escape and Skip both leave, from any step.
 */
export function FirstRun({ onDone }: Props) {
  const { t } = useLang();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  /*
   * The visitor starting to walk is the guide succeeding. Only a real distance counts — the
   * page settles a little on its own as the hall lays out, and retiring on that would mean the
   * note flashed up and vanished before it could be read.
   */
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 160) onDone();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [onDone]);

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <aside className="firstrun" aria-label={t('firstRunKicker')}>
      <p className="firstrun-kicker">
        <span>{t('firstRunKicker')}</span>
        <i aria-hidden="true">
          {String(step + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
        </i>
      </p>
      <h2 className="firstrun-title">{t(current.title)}</h2>
      <p className="firstrun-body">{t(current.body)}</p>

      <div className="firstrun-foot">
        <ol className="firstrun-dots" aria-hidden="true">
          {STEPS.map((entry, i) => (
            <li key={entry.title} className={i === step ? 'is-on' : undefined} />
          ))}
        </ol>
        <div className="firstrun-actions">
          <button type="button" className="firstrun-skip" onClick={onDone} data-cursor="close">
            {t('firstRunSkip')}
          </button>
          <button
            type="button"
            className="btn-glow is-compact firstrun-next"
            onClick={() => (last ? onDone() : setStep((s) => s + 1))}
            data-cursor="open"
          >
            <span className="btn-glow-fill" aria-hidden="true" />
            <span className="btn-glow-label">{last ? t('firstRunGo') : t('firstRunNext')}</span>
            <i className="btn-glow-node" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
