import { useEffect, useRef, useState } from 'react';
import { DUR, EASE } from '../lib/motion';

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
 * the viewport, then the destination page loads behind it. The expand runs on the shared
 * motion scale — the same curve and the same step the route veil uses — so opening a room and
 * arriving in one are two halves of one movement rather than two animations in a row.
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
        transition: `all ${DUR.slow}ms ${EASE.out}`,
      });
    });

    // Step 3: flash white once the expand has almost landed
    const flashTimer = setTimeout(() => setPhase('flash'), DUR.slow - 20);

    // Step 4: done — a beat after the flash, so the label is read rather than glimpsed
    const doneTimer = setTimeout(() => {
      setPhase('done');
      onDone();
    }, DUR.slow + 240);

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
