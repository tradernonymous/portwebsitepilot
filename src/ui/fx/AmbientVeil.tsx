import { useEffect, useState } from 'react';

/**
 * Ambient transition — the lights reset as you move between rooms.
 *
 * Rendered with `key={pageKey}`, so React remounts it on every route change and the
 * animation replays. A spectrum line sweeps the viewport and a soft bloom of light rises
 * and fades on the dark surfaces. It never takes the pointer and removes itself when the
 * animation is spent, so nothing is left compositing behind the page.
 */
export function AmbientVeil() {
  const [spent, setSpent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSpent(true), 900);
    return () => clearTimeout(timer);
  }, []);

  if (spent) return null;

  return (
    <div className="route-veil" aria-hidden="true">
      <span className="route-veil-bloom" />
      <span className="route-veil-line" />
    </div>
  );
}
