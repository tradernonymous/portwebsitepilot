/**
 * The one way for a page to change.
 *
 * The gallery's transitions live in components, but the *decision* to move — a click on a
 * link, an arrow key in the reader — happens all over the app. Rather than every caller
 * importing a transition component, they ask this module to take them somewhere, and the
 * surface that owns the doorway decides how.
 *
 * The fallback is the important part: before the doorway is bound, or on a device that should
 * not have one, `throughDoorway` simply runs the action. A missing transition can never mean a
 * dead link.
 */

type Journey = (action: () => void) => void;

/** Runs the action immediately, until a doorway binds itself. */
let journey: Journey = (action) => action();

/** Called by the doorway surface on mount. Passing `null` restores the direct route. */
export function bindDoorway(next: Journey | null): void {
  journey = next ?? ((action) => action());
}

/** Travel to wherever `action` goes, through the doorway if there is one. */
export function throughDoorway(action: () => void): void {
  journey(action);
}
