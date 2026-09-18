/**
 * The air of the page.
 *
 * Two layers, both purely CSS, both fed by a number the app already publishes — no state, no
 * re-render, nothing to keep in sync:
 *
 *   .mood       the colour of the room the reading line is inside, from `--mood-r/g/b`.
 *   .exposure   the page's own long exposure: spectrum that only exists while the visitor is
 *               actually moving, from the engine's `--vigour`.
 *
 * They are siblings rather than one wrapper because both blend with `screen`, and a shared
 * parent — even a plain positioned one — is exactly the kind of element a browser may decide
 * is their backdrop root, which would leave them blending with nothing.
 *
 * They live outside `App` so they survive every route change: the rooms come and go, the air
 * stays. On the gallery's black they add light; on the white wall `screen` cannot darken
 * anything, so the plain list needs no special case.
 */
export function Ambient() {
  return (
    <>
      <div className="mood" aria-hidden="true" />
      <div className="exposure" aria-hidden="true" />
    </>
  );
}
