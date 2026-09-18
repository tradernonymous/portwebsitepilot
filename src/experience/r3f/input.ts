/**
 * Free-walk input.
 *
 * Deliberately not React state: nothing re-renders while a body moves. The joystick writes
 * `moveInput` from its pointer events, the camera reads it once a frame, and the keyboard's
 * held keys land here so the camera can ask what is pressed without a listener of its own per
 * frame. `heldKeys` is lowercase `event.key`.
 */
export const moveInput = { x: 0, y: 0 };

export const heldKeys = new Set<string>();

/** The keys that move a free-walking body. */
export const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'] as const;

export function clearInput() {
  moveInput.x = 0;
  moveInput.y = 0;
  heldKeys.clear();
  wheelImpulse = 0;
}

/*
 * The wheel keeps working with a body: it nudges the body along the wing instead of sliding
 * the line under it. The wheel handler writes an impulse in world units, the camera consumes
 * it on the next frame and clears it.
 */
export let wheelImpulse = 0;
export function addWheelImpulse(units: number) {
  wheelImpulse += units;
}
export function takeWheelImpulse(): number {
  const value = wheelImpulse;
  wheelImpulse = 0;
  return value;
}

/*
 * The camera owns the free-walking body, and the rail's transport buttons live two components
 * away. Rather than thread a callback through three render trees, the camera parks its carry
 * commands here on mount and the rail calls them. Both are null whenever no wing is open, and
 * every caller guards on that. `carryBy` steps one work from wherever the body stands;
 * `carryTo` walks the body to a named work's viewing spot.
 */
export const freeWalkBus: {
  carryBy: ((dir: number) => void) | null;
  carryTo: ((index: number) => void) | null;
} = { carryBy: null, carryTo: null };
