/**
 * The page's own long exposure.
 *
 * Renders one fixed layer; everything it does is in `fx.css`, where the colours read the
 * engine's `--vigour` signal. It exists as a component only so the idea has a name and one
 * home, and so it can be turned off in one place if a future surface wants a clean frame.
 *
 * It never takes the pointer, never re-renders, and carries no state — the frame loop writes
 * the number, the compositor moves the light.
 */
export function Exposure() {
  return <div className="exposure" aria-hidden="true" />;
}
