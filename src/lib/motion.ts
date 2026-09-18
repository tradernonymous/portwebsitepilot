/**
 * The motion scale, in code.
 *
 * `tokens.css` already declares one tempo for the whole interface — `--dur-1` through
 * `--dur-4` and the three easings — so the stylesheet cannot drift. The animations that are
 * driven from JavaScript cannot read those custom properties as numbers, and left to
 * themselves each one invents its own curve and its own timing, which is exactly how an
 * interface stops feeling like one place.
 *
 * So the same scale is written down once here, and the JS-driven animations — the walk in
 * through the doorway, the door reveal between rooms — read from it instead of carrying
 * their own magic numbers. The two files are two views of one decision.
 */

/** Milliseconds. The same four steps as `--dur-1` … `--dur-4`. */
export const DUR = {
  /** 180ms — a state change on something already on screen. */
  quick: 180,
  /** 320ms — a surface arriving or leaving. */
  base: 320,
  /** 560ms — a whole scene changing. */
  slow: 560,
  /** 900ms — the long move: the doorway, the arrival. */
  long: 900,
} as const;

/** The easing curves, matching `--ease`, `--ease-out` and `--ease-spring`. */
export const EASE = {
  standard: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

const cubic = (t: number) => t * t * t;

/** Slow in, fast out — the curve the camera moves on when it is travelling somewhere. */
export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Fast in, slow out — for the moment a push-in commits to the doorway. */
export function easeIn(t: number): number {
  return cubic(t);
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
