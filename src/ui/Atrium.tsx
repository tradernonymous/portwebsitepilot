import { lazy, Suspense, useCallback, useEffect, useMemo } from 'react';
import { hrefFor } from '../lib/hooks';
import { useLang } from '../lib/lang';
import { pad, tourOrder } from '../lib/order';
import { ErrorBoundary } from '../lib/errors';
import { useGalleryStore } from '../experience/r3f/galleryStore';

/*
 * The deck is a three.js chunk. Lazy so the hub's first paint is the wordmark and the room
 * list, and the room they are standing in arrives a moment later — the same bargain the wings
 * already make.
 */
const GalleryCanvas = lazy(() =>
  import('../experience/r3f/GalleryCanvas').then((m) => ({ default: m.GalleryCanvas })),
);

type Props = {
  reducedMotion: boolean;
  webgl: boolean;
};

/** A corridor room is walked; every other room is read. */
function routeTo(stationId: string, kind: string) {
  return hrefFor(
    kind === 'corridor' ? { kind: 'walk', stationId } : { kind: 'station', stationId },
  );
}

/**
 * The atrium — the front door.
 *
 * PORT's rooms arranged on a deck you walk round: the wheel turns the ring, the focused room
 * comes forward to meet you, and clicking it walks you in. This is the hall the site used to
 * open with, moved into the building it describes; the scroll chapters it replaces were a
 * description of a place, and the place is more persuasive.
 *
 * The words are real DOM laid over the scene rather than only three.js text, and the room list
 * is a plain `<a>` for each room. That is deliberate: if the canvas is slow, blocked or
 * unavailable, the front door still says what PORT is and still lets a visitor in.
 */
export function Atrium({ reducedMotion, webgl }: Props) {
  const { t, stations } = useLang();
  const tour = useMemo(() => tourOrder(stations), [stations]);

  const focusedId = useGalleryStore((s) => s.focusedStationId);
  const setFocusedStationId = useGalleryStore((s) => s.setFocusedStationId);
  const setPhase = useGalleryStore((s) => s.setPhase);
  const setCurrentStation = useGalleryStore((s) => s.setCurrentStation);
  const setWalkProgress = useGalleryStore((s) => s.setWalkProgress);
  const setReducedMotion = useGalleryStore((s) => s.setReducedMotion);
  const skipEntry = useGalleryStore((s) => s.skipEntry);

  /*
   * The deck is a room you arrive in, so the store is put back to the approach. Coming here
   * from a wing would otherwise leave the store still standing in a corridor, and the ring
   * would find a station already open behind it.
   */
  useEffect(() => {
    setReducedMotion(reducedMotion);
    setCurrentStation(null);
    setWalkProgress(0);
    /* Somebody who has asked the machine for less motion is not flown at the door. */
    if (reducedMotion) skipEntry();
    else setPhase('entry');
  }, [reducedMotion, setCurrentStation, setWalkProgress, setReducedMotion, setPhase, skipEntry]);

  /*
   * Walking in. This is the same destination the room list links to, so the two ways of
   * choosing a room cannot drift apart — and the walk route falls back to the room page on
   * its own wherever WebGL is missing.
   */
  const enter = useCallback(
    (stationId: string) => {
      const station = stations.find((s) => s.id === stationId);
      if (!station) return;
      window.location.hash = routeTo(station.id, station.kind);
    },
    [stations],
  );

  /* Whichever room the deck has brought forward, the list says the same thing. */
  const here = focusedId ?? tour[0]?.id ?? null;

  return (
    <div className="atrium">
      {webgl ? (
        <div className="atrium-stage" aria-hidden="true">
          <ErrorBoundary name="atrium" flat>
            <Suspense fallback={null}>
              <GalleryCanvas
                stations={tour}
                reducedMotion={reducedMotion}
                onStationFocus={setFocusedStationId}
                onStationSelect={enter}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      ) : null}

      <div className="atrium-sheet">
        <header className="atrium-hero">
          <p className="kicker">{t('est')}</p>
          <h1 className="atrium-title">PORT</h1>
          <p className="atrium-sub">{t('subtitle')}</p>
          <p className="atrium-welcome serif-lede">{t('atriumWelcome')}</p>
          <p className="atrium-line">{t('line')}</p>
        </header>

        {/*
         * The rooms and the hint are one block pinned to the foot of the window. The deck brings
         * the room you have chosen to the centre of the frame, at eye level, so the middle of
         * the screen is the one place these words must not be.
         */}
        <div className="atrium-foot">
          <nav className="atrium-rooms" aria-label={t('subtitle')}>
            <ul>
              {tour.map((room, i) => (
                <li key={room.id}>
                  <a
                    href={routeTo(room.id, room.kind)}
                    className={`atrium-room${room.id === here ? ' is-here' : ''}`}
                    /* Pointing at a room brings it forward, the same as turning the ring. */
                    onPointerEnter={() => setFocusedStationId(room.id)}
                    onFocus={() => setFocusedStationId(room.id)}
                  >
                    <i>{pad(i + 1)}</i>
                    <span>{room.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <p className="atrium-hint">{t('atriumHint')}</p>
        </div>
      </div>
    </div>
  );
}
