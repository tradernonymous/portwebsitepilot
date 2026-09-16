import { useCallback, useEffect, useRef } from 'react';
import type { Station } from '../content';
import { deckCovers } from '../content';
import { t, type Lang } from '../content/i18n';
import { Glyph } from './Glyph';
import { thumbUrl } from '../content/videos';

type Props = {
  stations: Station[];
  activeIndex: number;
  language: Lang;
  onStationChange: (id: string) => void;
  onEnter: () => void;
};

/**
 * A full-page scroll gallery foyer.
 * Each page fills the viewport and shows one deck: artwork, tagline, and enter action.
 * Scroll / wheel / swipe changes the page. This replaces the 360 view entirely.
 */
export function GalleryFoyer({ stations, activeIndex, language, onStationChange, onEnter }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollLock = useRef(false);

  const goTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(stations.length - 1, index));
    if (clamped === activeIndex) return;
    onStationChange(stations[clamped].id);
    const section = containerRef.current?.children[clamped] as HTMLElement | undefined;
    section?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeIndex, stations, onStationChange]);

  // Wheel → page change with debounce
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (scrollLock.current) return;
      const delta = Math.abs(e.deltaY) > 40;
      if (!delta) return;
      scrollLock.current = true;
      setTimeout(() => { scrollLock.current = false; }, 680);
      if (e.deltaY > 0) goTo(activeIndex + 1);
      else goTo(activeIndex - 1);
    };
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => el.removeEventListener('wheel', onWheel);
  }, [activeIndex, goTo]);

  // Touch swipe → page change
  const touchStart = useRef(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => { touchStart.current = e.touches[0].clientY; };
    const onEnd = (e: TouchEvent) => {
      const dy = touchStart.current - e.changedTouches[0].clientY;
      if (Math.abs(dy) > 50) {
        if (dy > 0) goTo(activeIndex + 1);
        else goTo(activeIndex - 1);
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
    };
  }, [activeIndex, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { goTo(activeIndex + 1); e.preventDefault(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { goTo(activeIndex - 1); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, goTo]);

  return (
    <div className="page-foyer" ref={containerRef} aria-label={t(language, 'selectedRoom')}>
      {stations.map((s, i) => {
        const isActive = i === activeIndex;
        const coverImg = deckCovers.get(s.id) ?? s.heroImage;
        const isVideoStation = s.id === 'video';
        return (
          <section
            key={s.id}
            className={`page-foyer-section${isActive ? ' is-active' : ''}`}
            aria-label={s.label}
          >
            {/* Background artwork */}
            <div className="page-foyer-bg">
              {isVideoStation ? (
                <div className="page-foyer-video">
                  <img src={thumbUrl('XcU9A6YpuyI', 'hq')} alt="" />
                  <div className="page-foyer-video-overlay" />
                </div>
              ) : coverImg ? (
                <img src={coverImg.large} alt="" />
              ) : (
                <div className="page-foyer-empty" />
              )}
            </div>

            {/* Gradient overlays for text legibility */}
            <div className="page-foyer-gradient" aria-hidden="true" />
            <div className="page-foyer-vignette" aria-hidden="true" />

            {/* Content */}
            <div className="page-foyer-content">
              <div className="page-foyer-top">
                <span className="page-foyer-index">
                  {String(i + 1).padStart(2, '0')} / {String(stations.length).padStart(2, '0')}
                </span>
                <span className="page-foyer-label">
                  <Glyph glyph={s.glyph} size={14} />
                  {s.label}
                </span>
              </div>

              <div className="page-foyer-bottom">
                <p className="page-foyer-tagline">{s.tagline}</p>
                <div className="page-foyer-actions">
                  <button type="button" className="btn btn-primary" onClick={onEnter}>
                    {t(language, 'enterRoom')} <span aria-hidden="true">↗</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Page indicator dots */}
            <div className="page-foyer-dots" aria-hidden="true">
              {stations.map((_, dotIdx) => (
                <span
                  key={dotIdx}
                  className={`page-foyer-dot${dotIdx === activeIndex ? ' is-active' : ''}`}
                  onClick={() => goTo(dotIdx)}
                  role="button"
                  tabIndex={-1}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
