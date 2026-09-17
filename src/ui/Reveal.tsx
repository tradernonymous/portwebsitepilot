import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Stagger, in ms, for lists that should arrive one after another. */
  delay?: number;
  className?: string;
  /** For when the wrapper is itself a grid item and has to place itself. */
  style?: CSSProperties;
};

/**
 * Rise into place the first time a block is scrolled into view.
 *
 * One IntersectionObserver per block, disconnected the moment it fires, so nothing keeps
 * watching the page after the visitor has seen it. Under reduced motion the block is simply
 * shown — the observer is never created.
 */
export function Reveal({ children, delay = 0, className, style }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        io.disconnect();
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal${shown ? ' is-in' : ''}${className ? ` ${className}` : ''}`}
      style={{ ...style, ['--reveal-delay' as string]: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
