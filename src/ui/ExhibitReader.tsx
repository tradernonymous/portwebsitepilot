import { useEffect, useState } from 'react';
import type { Station } from '../content';
import { bodyIsOriginal } from '../content/en';
import { useDialogFocus } from '../lib/hooks';
import { useLang } from '../lib/lang';
import { pad } from '../lib/order';
import { Artwork, LightPlate } from './Artwork';
import { Motif } from './fx/Motif';

type Props = {
  station: Station;
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

/**
 * One work, up close: its images on the left, shown whole and never enlarged past their own
 * size, and its label and story on the right — the way a gallery puts the wall text beside
 * the piece rather than under a heap of thumbnails.
 */
export function ExhibitReader({ station, index, onClose, onPrev, onNext }: Props) {
  const exhibit = station.exhibits[index];
  const scroller = useDialogFocus<HTMLDivElement>(exhibit?.id ?? '');
  const { t, lang } = useLang();
  const [shown, setShown] = useState(0);

  useEffect(() => setShown(0), [exhibit?.id]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!exhibit) return null;

  const images = exhibit.images.slice(0, 12);
  const image = images[shown];
  const count = station.exhibits.length;
  const prevWork = index > 0 ? station.exhibits[index - 1] : undefined;
  const nextWork = index < count - 1 ? station.exhibits[index + 1] : undefined;

  return (
    <div className="reader" role="dialog" aria-modal="true" aria-label={exhibit.title}>
      <div className="reader-scrim" onClick={onClose} role="presentation" />
      <section className="reader-sheet">
        <div className="reader-media">
          {/* atmosphere behind the piece, so the work hangs in a room rather than on a panel */}
          <Motif kind="fog" />
          <div className="reader-stage">
            {image ? (
              <Artwork
                key={image.small}
                image={image}
                alt={image.caption || exhibit.title}
                fit="contain"
                sizes="(max-width: 960px) 94vw, 60vw"
                eager
              />
            ) : (
              <LightPlate id={exhibit.id} title={exhibit.title} label={station.label} />
            )}
          </div>
          {images.length > 1 ? (
            <div className="reader-thumbs" role="tablist" aria-label={t('gallery')}>
              {images.map((img, i) => (
                <button
                  key={img.small}
                  type="button"
                  role="tab"
                  aria-selected={i === shown}
                  aria-label={`${t('imageOf')} ${i + 1}`}
                  className={`reader-thumb${i === shown ? ' is-active' : ''}`}
                  onClick={() => setShown(i)}
                >
                  <img src={img.small} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="reader-text" ref={scroller} tabIndex={-1}>
          <div className="reader-top">
            <p className="kicker">
              {station.label} · {pad(index + 1)} / {pad(count)}
            </p>
            <button type="button" className="icon-btn" onClick={onClose} aria-label={t('close')} title={t('close')}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3Z"
                />
              </svg>
            </button>
          </div>
          <h2 className="reader-title">{exhibit.title}</h2>
          <p className="reader-lede">{exhibit.tagline}</p>

          <dl className="reader-facts">
            <div>
              <dt>{t('category')}</dt>
              <dd>{station.short}</dd>
            </div>
            <div>
              <dt>{t('period')}</dt>
              <dd>{exhibit.meta}</dd>
            </div>
          </dl>

          {exhibit.body.length ? (
            <>
              {bodyIsOriginal(exhibit.id, lang) ? <p className="original-language">{t('originalLanguage')}</p> : null}
              <div className="prose serif-body">
                {exhibit.body.map((para) => (
                  <p key={para}>{para}</p>
                ))}
              </div>
            </>
          ) : null}

          {exhibit.bullets?.length ? (
            <div className="reader-details">
              <h3>{t('details')}</h3>
              <ul className="bullets">
                {exhibit.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
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

          <nav className="reader-pager" aria-label={t('collection')}>
            <button type="button" className="pager-link" onClick={onPrev} disabled={!prevWork}>
              <span>{t('previous')}</span>
              <b>{prevWork?.title ?? '—'}</b>
            </button>
            <button type="button" className="pager-link is-next" onClick={onNext} disabled={!nextWork}>
              <span>{t('next')}</span>
              <b>{nextWork?.title ?? '—'}</b>
            </button>
          </nav>
        </div>
      </section>
    </div>
  );
}
