import { useEffect, useRef, useState } from 'react';

type Props = {
  /** The artwork image URL to expand. */
  src: string;
  /** The starting rectangle of the clicked door's cover image (viewport coords). */
  from: DOMRect;
  /** Room name shown during the transition. */
  label: string;
  /** Called once the reveal animation finishes — navigate away here. */
  onDone: () => void;
};

/**
 * A gallery-door reveal: the clicked cover image expands from its current position to fill
 * the viewport, then the destination page loads behind it.  600 ms total — long enough to
 * read, short enough not to bore.
 */
export function DoorReveal({ src, from, label, onDone }: Props) {
  const [phase, setPhase] = useState<'hold' | 'open' | 'flash' | 'done'>('hold');
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Layout the image at the door's exact position first, then flip to fullscreen.
    const img = imgRef.current;
    if (!img) return;

    // Step 1: lock to source rect
    Object.assign(img.style, {
      position: 'fixed',
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
      borderRadius: '2px',
      objectFit: 'cover',
      transition: 'none',
    });

    // Force layout so the browser paints the start position.
    img.getBoundingClientRect();

    // Step 2: transition to fullscreen
    const raf = requestAnimationFrame(() => {
      setPhase('open');
      Object.assign(img.style, {
        left: '0px',
        top: '0px',
        width: '100vw',
        height: '100vh',
        borderRadius: '0px',
        transition: 'all 520ms cubic-bezier(0.4, 0, 0.15, 1)',
      });
    });

    // Step 3: flash white after the expand
    const flashTimer = setTimeout(() => setPhase('flash'), 540);

    // Step 4: done
    const doneTimer = setTimeout(() => {
      setPhase('done');
      onDone();
    }, 780);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(flashTimer);
      clearTimeout(doneTimer);
    };
  }, [from, onDone]);

  if (phase === 'done') return null;

  return (
    <div className="door-reveal" aria-live="polite">
      {/* dark backdrop fades in as the image expands */}
      <div
        className="door-reveal-backdrop"
        style={{
          opacity: phase === 'hold' ? 0 : 1,
          transition: 'opacity 420ms ease',
        }}
      />
      <img
        ref={imgRef}
        className="door-reveal-img"
        src={src}
        alt={label}
        draggable={false}
      />
      {/* white flash at peak */}
      <div
        className="door-reveal-flash"
        style={{
          opacity: phase === 'flash' ? 1 : 0,
          transition: 'opacity 180ms ease-out',
        }}
      />
      {/* room name fades in at peak */}
      <span
        className="door-reveal-label"
        style={{
          opacity: phase === 'flash' ? 1 : 0,
          transition: 'opacity 220ms ease',
        }}
      >
        {label}
      </span>
    </div>
  );
}
