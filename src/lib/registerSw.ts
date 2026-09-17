/**
 * The page side of the service worker.
 *
 * Registration is production-only. A service worker over a Vite dev server can cache source
 * modules and make Preview show an older application than the files on disk — a particularly
 * misleading failure for a gallery under development. When a previous build did register on
 * localhost, unregister it once so the dev surface returns to the network immediately.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  if (import.meta.env.DEV) {
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) void registration.unregister();
    });
    return;
  }

  if (location.protocol !== 'https:') return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      /* Offline support is a bonus, never a dependency; a refusal is only logged. */
      console.warn('[port] service worker did not register', error);
    });
  });
}
