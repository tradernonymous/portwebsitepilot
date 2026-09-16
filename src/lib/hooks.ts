import { useCallback, useEffect, useState } from 'react';

/** True when the visitor has asked their OS to calm animation down. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Cheap one-off capability probe — no context is created, the canvas is thrown away. */
export function detectWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}

export type Route =
  | { kind: 'hub' }
  | { kind: 'flat' }
  | { kind: 'station'; stationId: string }
  | { kind: 'exhibit'; stationId: string; index: number };

function parse(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '').trim();
  if (!clean) return { kind: 'hub' };
  const parts = clean.split('/').filter(Boolean);
  if (parts[0] === 'senarai') return { kind: 'flat' };
  if (parts[0] === 's' && parts[1]) {
    const index = parts[2] !== undefined ? Number(parts[2]) : NaN;
    if (Number.isInteger(index) && index >= 0) {
      return { kind: 'exhibit', stationId: parts[1], index };
    }
    return { kind: 'station', stationId: parts[1] };
  }
  return { kind: 'hub' };
}

function stringify(route: Route): string {
  switch (route.kind) {
    case 'hub':
      return '';
    case 'flat':
      return 'senarai';
    case 'station':
      return `s/${route.stationId}`;
    case 'exhibit':
      return `s/${route.stationId}/${route.index}`;
  }
}

/** Deep-linkable routes so a station or exhibit can be shared on WhatsApp. */
export function useHashRoute() {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === 'undefined' ? { kind: 'hub' } : parse(window.location.hash),
  );

  useEffect(() => {
    const onHash = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((next: Route, replace = false) => {
    const hash = `#/${stringify(next)}`;
    if (replace) {
      window.history.replaceState(null, '', hash);
      setRoute(next);
    } else if (window.location.hash !== hash) {
      window.location.hash = hash;
    } else {
      setRoute(next);
    }
  }, []);

  return { route, navigate };
}
