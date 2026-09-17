import { useEffect, useState } from 'react';
import { useReducedMotion } from '../lib/hooks';
import { scrollToY } from '../lib/scroll';

export type Chapter = { id: string; label: string };

/**
 * The map of the walk.
 *
 * A gallery this size needs a wayfinding panel: which chapter you are in, what the others
 * are called, and one tap to any of them. The active chapter is read by watching a narrow
 * band across the middle of the viewport, so a chapter counts as "current" only while it is
 * actually what you are looking at — not merely present on screen.
 */
export function ChapterRail({ chapters }: { chapters: Chapter[] }) {
  const [active, setActive] = useState(0);
  const calm = useReducedMotion();

  useEffect(() => {
    const els = chapters
      .map((chapter) => document.getElementById(chapter.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (els.length < 2) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = els.indexOf(entry.target as HTMLElement);
          if (index >= 0) setActive(index);
        }
      },
      // only the band across the middle of the screen counts as "here"
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [chapters]);

  return (
    <nav className="chapter-rail" aria-label="Galeri">
      <ol>
        {chapters.map((chapter, i) => (
          <li key={chapter.id}>
            <a
              href={`#${chapter.id}`}
              className={i === active ? 'is-here' : undefined}
              aria-current={i === active ? 'true' : undefined}
              onClick={(event) => {
                // move to the chapter without writing a route hash the router would read
                const target = document.getElementById(chapter.id);
                if (!target) return;
                event.preventDefault();
                /* through the engine, so the rail, the wheel and the arrow keys share one glide */
                scrollToY(window.scrollY + target.getBoundingClientRect().top, !calm);
              }}
            >
              <i aria-hidden="true" />
              <span>{chapter.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
