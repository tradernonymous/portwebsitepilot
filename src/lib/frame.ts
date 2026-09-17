/**
 * One clock for everything that moves.
 *
 * The lightpaintings, the radiant light and the kinetic type all used to run their own
 * requestAnimationFrame loop. On a hall with four canvases that is four loops, four
 * visibility handlers and four frame rates drifting apart, all doing the same scheduling
 * work. They now share one loop, so a single frame advances the whole page and there is one
 * place that decides whether the page is moving at all.
 *
 * The loop stops the moment the last subscriber leaves and while the tab is hidden, so a
 * page nobody is looking at costs nothing.
 */

export type FrameTick = (now: number, dt: number, elapsed: number) => void;

const ticks = new Set<FrameTick>();

let handle = 0;
let last = 0;
/** Seconds of *animation* time, not wall-clock: a hidden tab does not make it jump. */
let elapsed = 0;

function loop(now: number) {
  handle = 0;
  // A long gap (a hidden tab, a slow frame) is clamped so nothing lurches on return.
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
  last = now;
  elapsed += dt;
  // A tick may unsubscribe while the loop runs. Deleting from a Set mid-iteration is safe,
  // and iterating it directly keeps the loop free of per-frame allocation.
  for (const tick of ticks) tick(now, dt, elapsed);
  if (ticks.size) handle = requestAnimationFrame(loop);
}

function play() {
  if (handle || ticks.size === 0 || document.hidden) return;
  last = 0;
  handle = requestAnimationFrame(loop);
}

function pause() {
  if (handle) cancelAnimationFrame(handle);
  handle = 0;
  last = 0;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    else play();
  });
}

/** Run `tick` on every frame. Returns the unsubscribe. */
export function onFrame(tick: FrameTick): () => void {
  ticks.add(tick);
  play();
  return () => {
    ticks.delete(tick);
    if (!ticks.size) pause();
  };
}
