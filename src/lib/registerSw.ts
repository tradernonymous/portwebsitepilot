/**
 * The page side of the service worker.
 *
 * Registration waits for the page's own `load`: the gallery's first paint should never wait
 * in a worker's queue. An update found later does not hard-reload anybody — the new worker
 * waits until this tab is hidden or closed, and the visit after that opens the new build.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      /* Offline support is a bonus, never a dependency; a refusal is only logged. */
      console.warn('[port] service worker did not register', error);
    });
  });
}
