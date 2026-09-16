import { useDialogFocus } from '../lib/hooks';
import type { Station } from '../content';
import { bodyIsOriginal } from '../content/en';
import { useLang } from '../lib/lang';

type Props = {
  station: Station;
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

/** Full read of one work / programme, with its photographs. */
export function ExhibitReader({ station, index, onClose, onPrev, onNext }: Props) {
  const exhibit = station.exhibits[index];
  const scroller = useDialogFocus<HTMLDivElement>(exhibit?.id ?? '');
  const { t, lang } = useLang();

  if (!exhibit) return null;

  const hero = exhibit.images[0];
  const rest = exhibit.images.slice(1, 10);

  return (
    <>
      <div className="panel-scrim" onClick={onClose} role="presentation" />
      <section
        className="panel centered"
        role="dialog"
        aria-modal="true"
        aria-label={exhibit.title}
      >
        <div className="panel-top">
          <div className="panel-title">
            <p className="panel-kicker" style={{ color: station.accent }}>
              {station.label} · {String(index + 1).padStart(2, '0')} /{' '}
              {String(station.exhibits.length).padStart(2, '0')}
            </p>
            <h2>{exhibit.title}</h2>
            <p className="lede">{exhibit.tagline}</p>
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
          {hero ? (
            <figure className="reader-hero">
              <img src={hero.large} alt={hero.caption || exhibit.title} loading="lazy" />
            </figure>
          ) : null}

          <div className="reader-meta">
            <span>
              <b>{t('category')}</b> {station.short}
            </span>
            <span>
              <b>{t('period')}</b> {exhibit.meta}
            </span>
          </div>

          {bodyIsOriginal(exhibit.id, lang) ? (
            <p className="original-language">{t('originalLanguage')}</p>
          ) : null}
          <div className="prose">
            {exhibit.body.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          {exhibit.bullets?.length ? (
            <div className="section">
              <h3>{t('details')}</h3>
              <ul className="bullets">
                {exhibit.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {rest.length ? (
            <div className="section">
              <h3>{t('gallery')}</h3>
              <div className="grid">
                {rest.map((img) => (
                  <figure key={img.small} className="thumb is-static">
                    <img src={img.small} alt={img.caption || exhibit.title} loading="lazy" />
                    <figcaption>{img.caption}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ) : null}

          {exhibit.source ? (
            <p className="source-note">
              {t('originalSource')}:{' '}
              <a href={exhibit.source} target="_blank" rel="noreferrer noopener">
                portipoh.com
              </a>
            </p>
          ) : null}
        </div>

        <div className="pager">
          <button type="button" className="btn btn-ghost" onClick={onPrev} disabled={index <= 0}>
            ← {t('previous')}
          </button>
          <span className="spacer" />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onNext}
            disabled={index >= station.exhibits.length - 1}
          >
            {t('next')} →
          </button>
        </div>
      </section>
    </>
  );
}
