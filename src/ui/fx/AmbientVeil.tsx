import { useEffect, useState } from 'react';

/**
 * Ambient transition — the lights reset as you move between rooms.
 *
 * Rendered with `key={pageKey}`, so React remounts it on every route change and the animation
 * replays. Three things happen in order: an opaque wash covers the swap itself, a spectrum
 * line sweeps down the viewport, and a soft bloom of light rises and fades.
 *
 * The wash is the part that matters. React swaps the page in the same commit that mounts this,
 * so without a wash the visitor sees a blink of the wrong room before any of the light
 * arrives. `dark` picks a wash in the page's own key — the gallery's rooms are dark, the
 * plain-list document is white — so it reads as the room's lights going down rather than as a
 * black frame.
 *
 * It never takes the pointer and removes itself once spent, so nothing is left compositing
 * behind the page.
 */
export function AmbientVeil({ dark = true }: { dark?: boolean }) {
  const [spent, setSpent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSpent(true), 900);
    return () => clearTimeout(timer);
  }, []);

  if (spent) return null;

  return (
    <div className="route-veil" data-wash={dark ? 'dark' : 'light'} aria-hidden="true">
      <span className="route-veil-wash" />
      <span className="route-veil-bloom" />
      <span className="route-veil-line" />
    </div>
  );
}
