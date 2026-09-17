import { useCallback, useEffect, useState } from 'react';
import type { Station } from '../content';

/**
 * The visitor's notebook.
 *
 * A real gallery visit leaves traces: a postcard, a bookmarked page. This is that trace —
 * the works a visitor kept while walking, held in their own browser, belonging to them.
 *
 * The store is deliberately tiny: an array of `{ exhibitId, stationId }` kept under one
 * localStorage key, a version field so the shape can change without corrupting anyone's
 * notebook, and a custom event so every mounted copy of the hook hears about a change no
 * matter which button made it.
 */

const KEY = 'port.collected';
const VERSION = 1;
const CHANGE_EVENT = 'port:collected-changed';

export type CollectedWork = {
  exhibitId: string;
  stationId: string;
};

type Stored = {
  version: number;
  works: CollectedWork[];
};

function read(): Stored {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { version: VERSION, works: [] };
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.version !== VERSION || !Array.isArray(parsed.works)) return { version: VERSION, works: [] };
    return parsed;
  } catch {
    return { version: VERSION, works: [] };
  }
}

function write(stored: Stored) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    /* storage can be blocked — the notebook is then simply for this session */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function sameWork(a: CollectedWork, b: CollectedWork) {
  return a.exhibitId === b.exhibitId && a.stationId === b.stationId;
}

export function useCollected() {
  const [works, setWorks] = useState<CollectedWork[]>(() => read().works);

  useEffect(() => {
    const onChange = () => setWorks(read().works);
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const toggle = useCallback((work: CollectedWork) => {
    const current = read().works;
    const next = current.some((w) => sameWork(w, work))
      ? current.filter((w) => !sameWork(w, work))
      : [...current, work];
    write({ version: VERSION, works: next });
  }, []);

  const clear = useCallback(() => write({ version: VERSION, works: [] }), []);

  const has = useCallback(
    (work: CollectedWork) => works.some((w) => sameWork(w, work)),
    [works],
  );

  return { works, toggle, clear, has };
}

/** The station and exhibit a kept work points at, resolved against today's content. */
export function resolveCollected(works: CollectedWork[], stations: Station[]) {
  return works
    .map(({ exhibitId, stationId }) => {
      const station = stations.find((s) => s.id === stationId);
      const index = station?.exhibits.findIndex((e) => e.id === exhibitId) ?? -1;
      const exhibit = index >= 0 ? station?.exhibits[index] : undefined;
      if (!station || !exhibit) return null;
      return { station, exhibit, index };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

/**
 * The notebook as text: one line per kept work, with the room and the address. What the
 * share sheet sends, and what lands on the clipboard where there is no share sheet.
 */
export function collectedAsText(
  entries: NonNullable<ReturnType<typeof resolveCollected>>,
  baseUrl: string,
): string {
  const lines = entries.map(
    ({ station, exhibit, index }) =>
      `${exhibit.title} — ${station.label}\n${baseUrl}/#/s/${station.id}/${index}`,
  );
  return lines.join('\n\n');
}

/** Offer the notebook to the share sheet; fall back to the clipboard. */
export async function shareCollected(text: string): Promise<'shared' | 'copied' | 'refused'> {
  try {
    if (navigator.share) {
      await navigator.share({ title: 'PORT — Kunjungan saya / My visit', text });
      return 'shared';
    }
  } catch {
    return 'refused'; // a share sheet the visitor dismissed is not an error to report
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'refused';
  }
}
