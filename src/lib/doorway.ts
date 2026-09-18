/**
 * The one way for a page to change.
 *
 * The gallery's transitions live in components, but the *decision* to move — a click on a
 * link, an arrow key in the reader — happens all over the app. Rather than every caller
 * importing a transition component, they ask this module to take them somewhere, and the
 * surface that owns the doorway decides how.
 *
 * It is also where the journey is *announced*. Crossing between rooms is the one moment the
 * whole page agrees something is happening, so the surfaces that want to move with it — the
 * light that streams through the door — listen here rather than re-deriving it from a class
 * on an element they do not own.
 *
 * The fallback is the important part: before the doorway is bound, or on a device that should
 * not have one, `throughDoorway` simply runs the action. A missing transition can never mean a
 * dead link.
 */

export type DoorwayPhase = 'idle' | 'closing' | 'opening';

type Journey = (action: () => void) => void;
type Watcher = (phase: DoorwayPhase) => void;

/** Runs the action immediately, until a doorway binds itself. */
let journey: Journey = (action) => action();

const watchers = new Set<Watcher>();

/** Called by the doorway surface on mount. Passing `null` restores the direct route. */
export function bindDoorway(next: Journey | null): void {
  journey = next ?? ((action) => action());
}

/** Travel to wherever `action` goes, through the doorway if there is one. */
export function throughDoorway(action: () => void): void {
  journey(action);
}

/** Watch the doors. Returns the unsubscribe. */
export function onDoorway(watch: Watcher): () => void {
  watchers.add(watch);
  return () => {
    watchers.delete(watch);
  };
}

/** Called by the doorway surface as it moves. */
export function announceDoorway(phase: DoorwayPhase): void {
  for (const watch of watchers) watch(phase);
}
