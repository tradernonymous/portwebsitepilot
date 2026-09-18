import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useCollected } from './lib/collected';
import {
  clearTrailProgress,
  curatedTrails,
  readTrailProgress,
  writeTrailProgress,
  type CuratedTrail,
  type TrailProgress,
} from './content/trails';
import { useGalleryWalk } from './lib/gallery';
import { useRoomMood } from './lib/mood';
import { detectWebGL, useHashRoute, useReducedMotion, type Route } from './lib/hooks';
import { ErrorBoundary } from './lib/errors';
import { useLang } from './lib/lang';
import { startScrollEngine } from './lib/scroll';
import { EntryGate } from './ui/EntryGate';
import { GalleryHud } from './ui/GalleryHud';
import { Opening } from './ui/Opening';
import { AmbientVeil } from './ui/fx/AmbientVeil';
import { CuratorPanel } from './ui/CuratorPanel';
import { FIRST_RUN_KEY, FirstRun } from './ui/FirstRun';
import { Cursor } from './ui/fx/Cursor';
import { Entrance } from './ui/fx/Entrance';
import { Hall } from './ui/Hall';
import { HelpPanel } from './ui/HelpPanel';
import { TopBar, type ChromeActions } from './ui/Hud';
import { MenuPanel } from './ui/MenuPanel';
import { RoomView } from './ui/RoomView';
import { TrailPanel } from './ui/TrailPanel';

/*
 * The three surfaces a visitor only reaches by asking for them. Keeping them out of the
 * opening bundle means the first paint is the gate and the hall, and nothing else.
 *
 *   Atrium        the hub's front door — the deck of rooms, with the words over it
 *   FlatView      the whole plain document — a reader who chose it is reading, not waiting
 *                 on the spatial site
 *   ImmersiveWalk the 3D wing; its own three.js chunk only loads when the walk begins
 *   ExhibitReader the work dialog, shared with the walk
 */
const Atrium = lazy(() => import('./ui/Atrium').then((m) => ({ default: m.Atrium })));
const FlatView = lazy(() => import('./ui/FlatView').then((m) => ({ default: m.FlatView })));
const ImmersiveWalk = lazy(() => import('./ui/ImmersiveWalk').then((m) => ({ default: m.ImmersiveWalk })));
const ExhibitReader = lazy(() => import('./ui/ExhibitReader').then((m) => ({ default: m.ExhibitReader })));
const NotebookPanel = lazy(() => import('./ui/NotebookPanel').then((m) => ({ default: m.NotebookPanel })));

const ENTERED_KEY = 'port.entered';

function sameRoute(a: Route, b: Route): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'hub' || a.kind === 'flat') return true;
  if (a.kind === 'walk' && b.kind === 'walk') return a.stationId === b.stationId;
  if (a.kind === 'exhibit' && b.kind === 'exhibit') {
    return a.stationId === b.stationId && a.index === b.index;
  }
  if (a.kind === 'station' && b.kind === 'station') {
    return a.stationId === b.stationId && a.shelf === b.shelf;
  }
  return false;
}

function initialTrailId(route: Route, progress: TrailProgress | null): string | null {
  if (!progress) return null;
  const trail = curatedTrails.find((candidate) => candidate.id === progress.trailId);
  const stop = trail?.stops[progress.index];
  return stop && sameRoute(route, stop.route) ? trail.id : null;
}

function alreadyEntered(): boolean {
  try {
    return window.sessionStorage.getItem(ENTERED_KEY) === '1';
  } catch {
    return false;
  }
}

function tourAlreadySeen(): boolean {
  try {
    return window.localStorage.getItem(FIRST_RUN_KEY) === '1';
  } catch {
    return true;
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
  const [tourSeen, setTourSeen] = useState(tourAlreadySeen);
  const [helpOpen, setHelpOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [trailOpen, setTrailOpen] = useState(false);
  const [savedTrail, setSavedTrail] = useState<TrailProgress | null>(() => readTrailProgress());
  const [trailId, setTrailId] = useState<string | null>(() => initialTrailId(route, readTrailProgress()));
  const [trailIndex, setTrailIndex] = useState(() => {
    const progress = readTrailProgress();
    return initialTrailId(route, progress) ? progress?.index ?? 0 : 0;
  });
  const trailNavigation = useRef(false);
  const { works: collected } = useCollected();
  const activeTrail = useMemo<CuratedTrail | null>(
    () => curatedTrails.find((trail) => trail.id === trailId) ?? null,
    [trailId],
  );

  useEffect(() => {
    if (!activeTrail) return;
    const expected = activeTrail.stops[trailIndex]?.route;
    if (!expected) return;
    if (sameRoute(route, expected)) {
      trailNavigation.current = false;
      return;
    }
    if (trailNavigation.current) return;
    clearTrailProgress();
    setSavedTrail(null);
    setTrailId(null);
    setTrailIndex(0);
    setTrailOpen(false);
  }, [route, activeTrail, trailIndex]);

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

  /* Any change of page closes the plan — including one the plan itself asked for. */
  useEffect(() => {
    setMenuOpen(false);
  }, [pageKey]);

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

  /* The air of the room the visitor is standing in, published for the ambient layer. */
  useRoomMood();

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

  const { position: galleryPosition, step, settling } = useGalleryWalk({
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

  /*
   * The Curator's Eye. It is the gallery walk plus a voice: a note at every stop, and the
   * willingness to move on its own. The walk is borrowed, not rebuilt — the tour has no
   * stops of its own and no keys of its own.
   *
   * The auto-advance waits for the glide to settle, then dwells, then steps. A visitor who
   * pauses takes the walk back — the arrows work either way — and resumes with the button.
   */
  const [curator, setCurator] = useState(false);
  const [curatorPaused, setCuratorPaused] = useState(false);
  const curatorOn = curator && galleryOn;

  /* Where the tour offers itself, gallery mode does too; turning the walk off ends the tour. */
  useEffect(() => {
    if (!gallery) setCurator(false);
  }, [gallery]);

  /*
   * The gallery's mode, published for the stylesheet and the pointer.
   *
   * Both were reading `body.is-gallery` — the rail stands down so the readout has the bottom
   * of the screen to itself, and the cursor changes what its ring is made of — and nothing was
   * ever setting it, so the rail sat underneath the readout and the cursor's gallery styling
   * never once appeared. It is published on exactly the condition that renders the readout, so
   * the two can never both be claiming the same corner.
   */
  useEffect(() => {
    document.body.classList.toggle('is-gallery', galleryOn);
    return () => document.body.classList.remove('is-gallery');
  }, [galleryOn]);

  const curatorDwellMs = reducedMotion ? 5200 : 6400;
  /*
   * `step` and `settling` are read through refs: they are not stable identities, and an effect
   * that depended on them would tear down and re-arm its own timer on every render — the dwell
   * would never elapse and the tour would stand still forever. The stop index is the trigger;
   * the functions are just how the step is taken.
   */
  const walkRef = useRef({ step, settling });
  walkRef.current = { step, settling };
  useEffect(() => {
    if (!curatorOn || curatorPaused) return;
    /* One shared timer: wait for the glide, dwell on the stop, then step on. */
    let timer = 0;
    let cancelled = false;
    const tick = () => {
      if (walkRef.current.settling()) {
        timer = window.setTimeout(tick, 400);
        return;
      }
      timer = window.setTimeout(() => {
        if (cancelled || !walkRef.current.step(1)) setCuratorPaused(true);
      }, curatorDwellMs);
    };
    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [curatorOn, curatorPaused, galleryPosition?.index, pageKey, curatorDwellMs]);

  /* ---------------------------------------------------------------- keyboard */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (route.kind === 'walk') return; // the walk owns its keys
      if (event.key === 'Escape') {
        /*
         * One Esc dismisses one layer — the topmost. Help and the notebook close themselves
         * and stop here; only with no panel open does Esc reach the reader underneath.
         * Closing the notebook used to fall through and close the work as well, throwing the
         * visitor out of what they were reading just for having peeked at their notebook.
         */
        if (helpOpen) setHelpOpen(false);
        else if (menuOpen) setMenuOpen(false);
        else if (notebookOpen) setNotebookOpen(false);
        else if (trailOpen) setTrailOpen(false);
        else if (route.kind === 'exhibit') navigate({ kind: 'station', stationId: route.stationId });
        return;
      }
      if (route.kind === 'exhibit' && station && !helpOpen && !notebookOpen) {
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
  }, [route, station, navigate, helpOpen, menuOpen, notebookOpen, trailOpen]);

  /* ---------------------------------------------------------------- chrome */

  /**
   * The tour rides on the walk: turning the tour on turns the walk on too. It lives here
   * rather than in the button so the bar and the building map offer exactly the same move.
   */
  const toggleCurator = useCallback(() => {
    if (!gallery) setGallery(true);
    setCurator((on) => !on);
  }, [gallery]);

  const chrome: ChromeActions = {
    onTour: () => setTourSeen(false),
    flat: route.kind === 'flat',
    onToggleFlat: () => navigate(route.kind === 'flat' ? { kind: 'hub' } : { kind: 'flat' }),
    onHelp: () => setHelpOpen(true),
    notebook: { count: collected.length, onToggle: () => setNotebookOpen((open) => !open) },
    trail:
      route.kind === 'hub' || route.kind === 'station' || route.kind === 'exhibit'
        ? { active: Boolean(activeTrail), onToggle: () => setTrailOpen((open) => !open) }
        : null,
    gallery: galleryToggleable ? { active: gallery, onToggle: () => setGallery((on) => !on) } : null,
    curator: galleryToggleable ? { active: curator, onToggle: toggleCurator } : null,
  };

  /**
   * The guide has been read, or the visitor walked on. Either way it is remembered, so the
   * next visit opens in the gallery rather than in an explanation of the gallery.
   */
  const finishTour = useCallback(() => {
    setTourSeen(true);
    try {
      window.localStorage.setItem(FIRST_RUN_KEY, '1');
    } catch {
      /* it simply shows again next time */
    }
  }, []);

  /* ---------------------------------------------------------------- render */

  const help = helpOpen ? <HelpPanel onClose={() => setHelpOpen(false)} reducedMotion={reducedMotion} /> : null;
  /* A dialog owns the screen and the keys, so the readout stands down with them. */
  const reading = helpOpen || menuOpen || notebookOpen || trailOpen || route.kind === 'exhibit';
  /*
   * Said once, after the gate, in the hall, and only when nothing else is on screen. It never
   * appears before the entrance — two full-screen introductions in a row is one too many.
   */
  const firstRun = entered && !tourSeen && !entering && !reading && route.kind === 'hub';
  const notebook = notebookOpen ? (
    <Suspense fallback={null}>
      <NotebookPanel onClose={() => setNotebookOpen(false)} />
    </Suspense>
  ) : null;
  const readout =
    galleryOn && galleryPosition && !reading ? (
      curatorOn ? (
        <CuratorPanel
          position={galleryPosition}
          paused={curatorPaused}
          onPause={() => setCuratorPaused((p) => !p)}
          onExit={() => {
            setCurator(false);
            setGallery(false);
          }}
        />
      ) : (
        <GalleryHud position={galleryPosition} inRoom={route.kind === 'station'} onExit={() => setGallery(false)} />
      )
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
        {...chrome}
        pageKey={pageKey}
        onMenu={() => setMenuOpen(true)}
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
            ) : webgl ? (
              /*
               * The front door is the building. Without WebGL it stays the written hall, so a
               * visitor whose browser cannot draw the deck is still shown what PORT is and
               * still has every room within a click.
               */
              <Atrium reducedMotion={reducedMotion} webgl={webgl} />
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
              suspended={helpOpen || notebookOpen || trailOpen}
            />
          </Suspense>
        </ErrorBoundary>
      ) : null}
      {readout}
      {firstRun ? <FirstRun onDone={finishTour} /> : null}
      <MenuPanel
        {...chrome}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        here={route.kind === 'hub' ? null : (station?.id ?? null)}
        reducedMotion={reducedMotion}
      />
      {help}
      {notebook}
      <TrailPanel
        trails={curatedTrails}
        activeTrail={activeTrail}
        activeIndex={trailIndex}
        resumeTrail={
          savedTrail
            ? curatedTrails.find((trail) => trail.id === savedTrail.trailId) ?? null
            : null
        }
        resumeIndex={savedTrail?.index ?? 0}
        open={trailOpen || Boolean(activeTrail)}
        onStart={(trail) => {
          const progress = { trailId: trail.id, index: 0 };
          trailNavigation.current = true;
          writeTrailProgress(progress);
          setSavedTrail(progress);
          setTrailId(trail.id);
          setTrailIndex(0);
          setTrailOpen(false);
          navigate(trail.stops[0].route);
        }}
        onResume={() => {
          if (!savedTrail) return;
          const trail = curatedTrails.find((candidate) => candidate.id === savedTrail.trailId);
          const stop = trail?.stops[savedTrail.index];
          if (!trail || !stop) {
            clearTrailProgress();
            setSavedTrail(null);
            return;
          }
          trailNavigation.current = true;
          setTrailId(trail.id);
          setTrailIndex(savedTrail.index);
          setTrailOpen(false);
          navigate(stop.route);
        }}
        onNavigate={(index) => {
          if (!activeTrail) return;
          const next = Math.max(0, Math.min(activeTrail.stops.length - 1, index));
          const progress = { trailId: activeTrail.id, index: next };
          trailNavigation.current = true;
          writeTrailProgress(progress);
          setSavedTrail(progress);
          setTrailIndex(next);
          navigate(activeTrail.stops[next].route);
        }}
        onExit={() => {
          trailNavigation.current = false;
          clearTrailProgress();
          setSavedTrail(null);
          setTrailId(null);
          setTrailIndex(0);
          setTrailOpen(false);
        }}
        onClose={() => setTrailOpen(false)}
        onChange={() => {
          setTrailId(null);
          setTrailIndex(0);
          setTrailOpen(true);
        }}
      />
      {entrance}
      {/* remounts on every route change, so the light replays as the room changes */}
      {reducedMotion ? null : <AmbientVeil key={pageKey} dark={route.kind !== 'flat'} />}
      <Cursor />
    </>
  );
}
