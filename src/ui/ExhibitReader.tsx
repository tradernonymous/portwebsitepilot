import { useEffect, useRef, useState } from 'react';
import type { Station } from '../content';
import { bodyIsOriginal } from '../content/en';
import { useCollected } from '../lib/collected';
import { useDialogFocus } from '../lib/hooks';
import { useLang } from '../lib/lang';
import { usePointerLight } from '../lib/light';
import { pad } from '../lib/order';
import { Artwork, LightPlate } from './Artwork';
import { Motif } from './fx/Motif';
import { SplitText } from './fx/SplitText';

type Props = {
  station: Station;
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  /** Another modal is above this reader; remove it from the active accessibility tree. */
  suspended?: boolean;
};

/**
 * One work, up close: its images on the left, shown whole and never enlarged past their own
 * size, and its label and story on the right — the way a gallery puts the wall text beside
 * the piece rather than under a heap of thumbnails.
 */
export function ExhibitReader({ station, index, onClose, onPrev, onNext, suspended = false }: Props) {
  const exhibit = station.exhibits[index];
  const scroller = useDialogFocus<HTMLDivElement>(exhibit?.id ?? '');
  const mediaRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { t, lang } = useLang();
  const [shown, setShown] = useState(0);
  const { has, toggle } = useCollected();
  const kept = has({ exhibitId: exhibit?.id ?? '', stationId: station.id });

  useEffect(() => setShown(0), [exhibit?.id]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  /* the reader's side is a room: the pointer carries a soft torch over the wall */
  usePointerLight(mediaRef);

  /*
   * The piece leans toward the hand that points at it. A flat file is read; a held painting
   * is handled — tilt follows the pointer across the stage and a sheen rides the surface,
   * the way varnish catches the room's light. Fine pointers only; reduced motion holds still.
   */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof window.matchMedia !== 'function') return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const piece = stage.querySelector<HTMLElement>('.reader-piece');
    if (!piece) return;
    const move = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      piece.style.setProperty('--ry', `${(nx * 7).toFixed(2)}deg`);
      piece.style.setProperty('--rx', `${(-ny * 6).toFixed(2)}deg`);
      piece.style.setProperty('--gx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
      piece.style.setProperty('--gy', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
    };
    const leave = () => {
      piece.style.setProperty('--rx', '0deg');
      piece.style.setProperty('--ry', '0deg');
    };
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerleave', leave);
    return () => {
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerleave', leave);
    };
  }, []);

  if (!exhibit) return null;

  const images = exhibit.images.slice(0, 12);
  const image = images[shown];
  const count = station.exhibits.length;
  const prevWork = index > 0 ? station.exhibits[index - 1] : undefined;
  const nextWork = index < count - 1 ? station.exhibits[index + 1] : undefined;

  return (
    <div
      className="reader"
      role="dialog"
      aria-modal={suspended ? undefined : true}
      aria-hidden={suspended ? true : undefined}
      inert={suspended ? true : undefined}
      aria-label={exhibit.title}
    >
      <div className="reader-scrim" onClick={onClose} role="presentation" />
      <section className="reader-sheet">
        <div className="reader-media" ref={mediaRef}>
          {/* atmosphere behind the piece, so the work hangs in a room rather than on a panel */}
          <Motif kind="fog" />
          <div className="reader-stage" ref={stageRef}>
            <figure className="reader-piece">
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
              {/* a museum label beside the piece, saying only what the wall text says aloud */}
              <figcaption className="reader-plaque" aria-hidden="true">
                <span className="reader-plaque-mark">PORT</span>
                <span>{station.label}</span>
                <i>
                  {pad(index + 1)} / {pad(count)}
                </i>
              </figcaption>
            </figure>
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
                  data-cursor="view"
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
            <div className="reader-tools">
              <button
                type="button"
                className={`icon-btn keep-btn${kept ? ' is-kept' : ''}`}
                onClick={() => toggle({ exhibitId: exhibit.id, stationId: station.id })}
                aria-pressed={kept}
                aria-label={t(kept ? 'kept' : 'keep')}
                title={t(kept ? 'kept' : 'keep')}
                data-cursor="view"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d={kept
                      ? 'M5 3h14a2 2 0 0 1 2 2v16l-9-4.6L3 21V5a2 2 0 0 1 2-2Z'
                      : 'M6 2h12a2 2 0 0 1 2 2v17l-8-4.1L4 21V4a2 2 0 0 1 2-2Zm0 2v13.6l6-3.1 6 3.1V4H6Z'}
                  />
                </svg>
              </button>
              <button type="button" className="icon-btn" onClick={onClose} aria-label={t('close')} title={t('close')} data-cursor="close">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3Z"
                  />
                </svg>
              </button>
            </div>
          </div>
          {/* keyed on the work, so stepping to the next one sets its title again */}
          <h2 className="reader-title">
            <SplitText key={exhibit.id} text={exhibit.title} stagger={22} />
          </h2>
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
            <button type="button" className="pager-link" onClick={onPrev} disabled={!prevWork} data-cursor="prev">
              <span>{t('previous')}</span>
              <b>{prevWork?.title ?? '—'}</b>
            </button>
            <button type="button" className="pager-link is-next" onClick={onNext} disabled={!nextWork} data-cursor="next">
              <span>{t('next')}</span>
              <b>{nextWork?.title ?? '—'}</b>
            </button>
          </nav>
        </div>
      </section>
    </div>
  );
}
