import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGalleryWalk } from './lib/gallery';
import { detectWebGL, useHashRoute, useReducedMotion } from './lib/hooks';
import { ErrorBoundary } from './lib/errors';
import { useLang } from './lib/lang';
import { startScrollEngine } from './lib/scroll';
import { EntryGate } from './ui/EntryGate';
import { GalleryHud } from './ui/GalleryHud';
import { Opening } from './ui/Opening';
import { AmbientVeil } from './ui/fx/AmbientVeil';
import { Cursor } from './ui/fx/Cursor';
import { Entrance } from './ui/fx/Entrance';
import { Hall } from './ui/Hall';
import { HelpPanel } from './ui/HelpPanel';
import { TopBar } from './ui/Hud';
import { RoomView } from './ui/RoomView';

/*
 * The three surfaces a visitor only reaches by asking for them. Keeping them out of the
 * opening bundle means the first paint is the gate and the hall, and nothing else.
 *
 *   FlatView      the whole plain document — a reader who chose it is reading, not waiting
 *                 on the spatial site
 *   ImmersiveWalk the 3D wing; its own three.js chunk only loads when the walk begins
 *   ExhibitReader the work dialog, shared with the walk
 */
const FlatView = lazy(() => import('./ui/FlatView').then((m) => ({ default: m.FlatView })));
const ImmersiveWalk = lazy(() => import('./ui/ImmersiveWalk').then((m) => ({ default: m.ImmersiveWalk })));
const ExhibitReader = lazy(() => import('./ui/ExhibitReader').then((m) => ({ default: m.ExhibitReader })));

const ENTERED_KEY = 'port.entered';

function alreadyEntered(): boolean {
  try {
    return window.sessionStorage.getItem(ENTERED_KEY) === '1';
  } catch {
    return false;
  }
}

export default function App() {
  const reducedMotion = useReducedMotion();
  const webgl = useMemo(() => detectWebGL(), []);
  const { route, navigate } = useHashRoute();
  const { stations, t, lang } = useLang();

  /**
   * The gate greets a first visit. A shared link to a room, or a reload after coming in,
   * goes straight to what was asked for.
   */
  const [entered, setEntered] = useState(() => route.kind !== 'hub' || alreadyEntered());
  const [entering, setEntering] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const markEntered = useCallback(() => {
    setEntered(true);
    try {
      window.sessionStorage.setItem(ENTERED_KEY, '1');
    } catch {
      /* the gate simply shows again next time */
    }
  }, []);

  const station =
    route.kind === 'station' || route.kind === 'exhibit' || route.kind === 'walk'
      ? stations.find((s) => s.id === route.stationId)
      : undefined;

  // An address naming a room or a work that does not exist lands somewhere real instead.
  useEffect(() => {
    if ((route.kind === 'station' || route.kind === 'exhibit' || route.kind === 'walk') && !station) {
      navigate({ kind: 'hub' }, true);
    } else if (route.kind === 'exhibit' && station && route.index >= station.exhibits.length) {
      navigate({ kind: 'station', stationId: station.id }, true);
    } else if (route.kind === 'walk' && station && (!webgl || station.kind !== 'corridor')) {
      navigate({ kind: 'station', stationId: station.id }, true);
    }
  }, [route, station, navigate, webgl]);

  /* ---------------------------------------------------------------- scroll memory */

  // The hall remembers how far down the corridor the visitor had walked; a room always opens
  // at its door. Opening or closing a work over a room leaves the room where it was.
  const hallScroll = useRef(0);
  const pageKey =
    route.kind === 'hub' ? 'hall' : route.kind === 'flat' ? 'flat' : route.kind === 'walk' ? `walk:${route.stationId}` : `room:${route.stationId}`;
  const lastPage = useRef(pageKey);

  useEffect(() => {
    if (route.kind !== 'hub') return;
    const onScroll = () => {
      hallScroll.current = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [route.kind]);

  useLayoutEffect(() => {
    if (lastPage.current === pageKey) return;
    lastPage.current = pageKey;
    if (pageKey === 'hall') {
      const y = hallScroll.current;
      // the corridor's height is laid out a frame after it mounts
      requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'auto' }));
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [pageKey]);

  /* ---------------------------------------------------------------- motion */

  /**
   * The scroll engine, for the whole app. It owns the glide and publishes the one scroll state
   * that the light, the depth and the keyboard walk all read, so they move to the same clock.
   * Restarted when the motion preference changes, because that is what decides whether the
   * page glides at all.
   */
  useEffect(() => startScrollEngine(reducedMotion), [reducedMotion]);

  /* ---------------------------------------------------------------- gallery mode */

  /**
   * Gallery mode. Off by default, because taking the arrow keys is a bold thing to do to a
   * page; where it is offered a reader can turn it on, walk with the arrows, and leave with
   * Escape. It stays on across a step into a room, so walking chapters and walking works are
   * one continuous walk.
   */
  const [gallery, setGallery] = useState(false);
  /*
   * Two different questions, kept apart on purpose.
   *
   * `supported` is where the walk survives — a work opened over a room is still the same page,
   * so reading one does not end the walk. `toggleable` is where the button belongs: offering it
   * over an open reader would put a control on screen that the reader is covering.
   */
  const gallerySupported =
    route.kind === 'hub' || route.kind === 'station' || route.kind === 'exhibit';
  const galleryToggleable = route.kind === 'hub' || route.kind === 'station';

  /* Only a surface that owns its own keys ends the walk: the plain list, and the 3D wing. */
  useEffect(() => {
    if (gallery && !gallerySupported) setGallery(false);
  }, [gallery, gallerySupported]);

  const { position: galleryPosition } = useGalleryWalk({
    active: gallery && gallerySupported,
    /* the language is part of the key: a stop renamed by the toggle must not keep its old name */
    stopKey: `${pageKey}:${lang}`,
    reducedMotion,
    onExit: () => setGallery(false),
  });

  /*
   * The chapter rail and the readout both answer "where am I"; only one shows at a time, and
   * only where there is a readout to show. A page with no stops keeps its rail and its
   * ordinary keys rather than going blank for no reason.
   */
  const galleryOn = gallery && gallerySupported && Boolean(galleryPosition);

  useEffect(() => {
    document.body.classList.toggle('is-gallery', galleryOn);
    return () => document.body.classList.remove('is-gallery');
  }, [galleryOn]);

  /* ---------------------------------------------------------------- keyboard */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (route.kind === 'walk') return; // the walk owns its keys
      if (event.key === 'Escape') {
        if (helpOpen) setHelpOpen(false);
        else if (route.kind === 'exhibit') navigate({ kind: 'station', stationId: route.stationId });
        return;
      }
      if (route.kind === 'exhibit' && station && !helpOpen) {
        const last = station.exhibits.length - 1;
        if (event.key === 'ArrowRight' && route.index < last) {
          navigate({ kind: 'exhibit', stationId: station.id, index: route.index + 1 }, true);
        } else if (event.key === 'ArrowLeft' && route.index > 0) {
          navigate({ kind: 'exhibit', stationId: station.id, index: route.index - 1 }, true);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [route, station, navigate, helpOpen]);

  /* ---------------------------------------------------------------- render */

  const help = helpOpen ? <HelpPanel onClose={() => setHelpOpen(false)} reducedMotion={reducedMotion} /> : null;
  /* A dialog owns the screen and the keys, so the readout stands down with them. */
  const reading = helpOpen || route.kind === 'exhibit';
  const readout =
    galleryOn && galleryPosition && !reading ? (
      <GalleryHud position={galleryPosition} inRoom={route.kind === 'station'} onExit={() => setGallery(false)} />
    ) : null;
  const entrance = entering ? (
    <Entrance key="entrance" reducedMotion={reducedMotion} onMidpoint={markEntered} onDone={() => setEntering(false)} />
  ) : null;

  if (!entered) {
    return (
      <>
        <EntryGate
          reducedMotion={reducedMotion}
          onEnter={() => setEntering(true)}
          onFlat={() => {
            markEntered();
            navigate({ kind: 'flat' });
          }}
        />
        {entrance}
        <Cursor />
      </>
    );
  }

  if (route.kind === 'walk' && station) {
    return (
      <>
        <ErrorBoundary name="walk" flat>
          <Suspense fallback={<Opening />}>
            <ImmersiveWalk
              station={station}
              reducedMotion={reducedMotion}
              onExit={() => navigate({ kind: 'station', stationId: station.id })}
            />
          </Suspense>
        </ErrorBoundary>
        {help}
        <Cursor />
      </>
    );
  }

  const exhibitIndex = route.kind === 'exhibit' ? route.index : -1;
  const crumbWork = station && exhibitIndex >= 0 ? station.exhibits[exhibitIndex] : undefined;

  return (
    <>
      <a className="skip-link" href="#content">
        {t('skipToContent')}
      </a>
      <TopBar
        pageKey={pageKey}
        flat={route.kind === 'flat'}
        onToggleFlat={() => navigate(route.kind === 'flat' ? { kind: 'hub' } : { kind: 'flat' })}
        onHelp={() => setHelpOpen(true)}
        gallery={galleryToggleable ? { active: gallery, onToggle: () => setGallery((on) => !on) } : null}
        crumb={
          station ? (
            <>
              <a href={`#/s/${station.id}`}>{station.label}</a>
              {crumbWork ? (
                <>
                  <span aria-hidden="true">/</span>
                  <b>{crumbWork.title}</b>
                </>
              ) : null}
            </>
          ) : null
        }
      />
      <main id="content">
        <ErrorBoundary name="page" flat>
          <Suspense fallback={<Opening />}>
            {route.kind === 'flat' ? (
              <FlatView />
            ) : station ? (
              <RoomView
                station={station}
                shelf={route.kind === 'station' ? route.shelf : undefined}
                reducedMotion={reducedMotion}
                webgl={webgl}
              />
            ) : (
              <Hall reducedMotion={reducedMotion} />
            )}
          </Suspense>
        </ErrorBoundary>
      </main>
      {station && exhibitIndex >= 0 && crumbWork ? (
        <ErrorBoundary name="reader">
          <Suspense fallback={<Opening />}>
            <ExhibitReader
              station={station}
              index={exhibitIndex}
              onClose={() => navigate({ kind: 'station', stationId: station.id })}
              onPrev={() => navigate({ kind: 'exhibit', stationId: station.id, index: Math.max(0, exhibitIndex - 1) }, true)}
              onNext={() =>
                navigate(
                  { kind: 'exhibit', stationId: station.id, index: Math.min(station.exhibits.length - 1, exhibitIndex + 1) },
                  true,
                )
              }
            />
          </Suspense>
        </ErrorBoundary>
      ) : null}
      {readout}
      {help}
      {entrance}
      {/* remounts on every route change, so the light replays as the room changes */}
      {reducedMotion ? null : <AmbientVeil key={pageKey} dark={route.kind !== 'flat'} />}
      <Cursor />
    </>
  );
}
