import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { stationById, stations } from './content';
import type { Phase, PortWorld } from './experience/PortWorld';
import { detectWebGL, useHashRoute, useMediaQuery, useReducedMotion } from './lib/hooks';
import { CorridorRail, DeckCaption, Dock, Hint, TopBar } from './ui/Hud';
import { EntryGate } from './ui/EntryGate';
import { ExhibitReader } from './ui/ExhibitReader';
import { FlatView } from './ui/FlatView';
import { HelpPanel } from './ui/HelpPanel';
import { GalleryFoyer } from './ui/GalleryFoyer';
import { StationPanel } from './ui/StationPanel';
import { VideoRoom } from './ui/VideoRoom';

type Mode = '3d' | 'flat';

export default function App() {
  const reducedMotion = useReducedMotion();
  const webgl = useMemo(() => detectWebGL(), []);
  const { route, navigate } = useHashRoute();

  const [mode, setMode] = useState<Mode>('3d');
  const [entered, setEntered] = useState(false);
  /** three.js is a big chunk; the gate stays on screen until the space is actually built. */
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>('entry');
  const [hovered, setHovered] = useState<string | null>(null);
  /** Which station the visitor is turning towards — the deck's name for the room. */
  const [facing, setFacing] = useState<string | null>(null);
  const [activeExhibit, setActiveExhibit] = useState(0);
  const [corridorProgress, setCorridorProgress] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  /** The room preview shown in the foyer before a visitor enters it. */
  const [foyerStationId, setFoyerStationId] = useState(
    stations[1]?.id ?? stations[0]?.id ?? null,
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<PortWorld | null>(null);
  const openedStationRef = useRef<string | null>(null);
  /** What the visitor asked for while the world was still loading. */
  const pendingEntryRef = useRef<'none' | 'start' | 'skip'>('none');
  /**
   * Mirrors `entered` for the world-creation closure: if the visitor has already walked
   * in once, a rebuilt world (e.g. after switching back from the list view) must land on
   * the deck rather than parking them in the approach tunnel again.
   */
  const enteredRef = useRef(false);

  const activeStation =
    route.kind === 'station' || route.kind === 'exhibit'
      ? stationById(route.stationId)
      : undefined;

  /**
   * Which space a hint belongs to. Kept apart so that learning the deck does not silence
   * the wing, and stepping into a wing still gets its own one-time instruction.
   */
  const hintSpace = phase === 'corridor' && activeStation?.kind === 'corridor' ? 'corridor' : 'hub';
  /** A phone has no cursor, so "click" and "scroll" are simply the wrong words on it. */
  const coarsePointer = useMediaQuery('(pointer: coarse)');
  /** Set once the visitor has clearly begun exploring the current space. */
  const [taught, setTaught] = useState<string | null>(null);

  // A first-run hint is help; the same hint still sitting there after you have started
  // dragging and tapping is clutter. Retire it on the first deliberate input, per space.
  useEffect(() => {
    if (taught === hintSpace) return;
    const retire = () => setTaught(hintSpace);
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const name of events) {
      window.addEventListener(name, retire, { once: true, passive: true });
    }
    return () => {
      for (const name of events) window.removeEventListener(name, retire);
    };
  }, [hintSpace, taught]);

  /* ---------------------------------------------------------------- world lifecycle */

  useEffect(() => {
    if (mode !== '3d' || !webgl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let world: PortWorld | null = null;

    // Imported on demand so the flythrough gate renders before three.js arrives.
    void import('./experience/PortWorld').then(({ PortWorld: World }) => {
      if (cancelled) return;
      world = new World(canvas, {
        stations,
        reducedMotion,
        onReady: () => setReady(true),
        onPhase: (next) => {
          setPhase(next);
          if (next === 'hub') {
            enteredRef.current = true;
            setEntered(true);
          }
        },
        onHover: (id) => setHovered(id),
        onFacing: (id) => setFacing(id),
        onStationSelect: (id) => {
          setHovered(id);
          setFoyerStationId(id);
        },
        onExhibitSelect: (index) => {
          const station = worldRef.current?.getStation();
          if (station) navigate({ kind: 'exhibit', stationId: station.id, index });
        },
        onExhibitFocus: (index) => setActiveExhibit(index),
      });
      worldRef.current = world;
      world.mount();

      if (import.meta.env.DEV) {
        (window as unknown as { __PORT__?: PortWorld }).__PORT__ = world;
      }

      // Honour a click that landed while the chunk was still in flight, or a world that
      // is being rebuilt after the visitor already entered.
      const pending = pendingEntryRef.current;
      pendingEntryRef.current = 'none';
      if (pending === 'start') world.startEntry();
      else if (pending === 'skip') world.skipEntry();
      else if (enteredRef.current) world.skipEntry();
    });

    return () => {
      cancelled = true;
      setReady(false);
      world?.dispose();
      worldRef.current = null;
      openedStationRef.current = null;
    };
    // `reducedMotion` is handled by its own effect so toggling it never rebuilds the scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, webgl, navigate]);

  useEffect(() => {
    worldRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    document.body.classList.toggle('is-flat', mode === 'flat');
  }, [mode]);

  // Only the two views that name themselves switch the view: `#/senarai` is the plain list
  // and `#/` is the 3D home. Setting `flat` but never clearing it meant that leaving the
  // list with the browser's Back button left the list on screen while the URL said home —
  // Back looked broken. A link to a station or a work is content, not a view, so it stays
  // in whichever one the visitor is already reading.
  useEffect(() => {
    if (!webgl) setMode('flat');
    else if (route.kind === 'flat') setMode('flat');
    else if (route.kind === 'hub') setMode('3d');
  }, [webgl, route.kind]);

  /** The station named by a shareable link, if the visitor arrived on one. */
  const linkedStation =
    route.kind === 'station' || route.kind === 'exhibit' ? route.stationId : null;

  // Arriving on a link to a station or a work is not a first visit: the visitor already
  // knows where they want to be. Holding the gate over the built space hid the very thing
  // they came for, and "Masuk ke PORT" then replayed the approach and threw the link away,
  // leaving the URL and the breadcrumb naming a work that was no longer open.
  useEffect(() => {
    if (!ready || entered || mode !== '3d' || !linkedStation) return;
    enteredRef.current = true;
    setEntered(true);
    // A station with no wing has nothing to walk into, so the deck stays behind its panel.
    // One that does have a wing is opened by the route effect below, so leave it be.
    if (stationById(linkedStation)?.kind !== 'corridor') worldRef.current?.skipEntry();
  }, [ready, entered, mode, linkedStation]);

  /* ---------------------------------------------------------------- route -> world */

  useEffect(() => {
    const world = worldRef.current;
    if (!world || mode !== '3d') return;

    if (route.kind === 'hub' || route.kind === 'flat') {
      if (openedStationRef.current) {
        openedStationRef.current = null;
        world.leaveStation();
      }
      return;
    }

    const station = stationById(route.stationId);
    if (!station) {
      navigate({ kind: 'hub' }, true);
      return;
    }

    // A work that does not exist — a truncated share link, a URL from an older build — is
    // read as "no work named", so the visitor lands on the station itself instead of on a
    // breadcrumb trailing an empty title with nothing open behind it. Two stations carry
    // no works at all, which is why this also covers `/0` on those.
    if (route.kind === 'exhibit' && route.index >= station.exhibits.length) {
      navigate({ kind: 'station', stationId: station.id }, true);
      return;
    }

    if (station.kind === 'corridor') {
      if (openedStationRef.current !== station.id) {
        openedStationRef.current = station.id;
        setActiveExhibit(route.kind === 'exhibit' ? route.index : 0);
        world.openCorridor(station);
      }
      if (route.kind === 'exhibit') {
        setActiveExhibit(route.index);
        world.focusExhibit(route.index);
      }
    } else if (openedStationRef.current) {
      openedStationRef.current = null;
      world.leaveStation();
    }
    // `ready` matters: the station in the URL can only be opened once the world exists.
  }, [route, mode, navigate, ready]);

  /* ---------------------------------------------------------------- corridor progress */

  useEffect(() => {
    if (phase !== 'corridor') return;
    const id = window.setInterval(() => {
      setCorridorProgress(worldRef.current?.getWalkProgress() ?? 0);
    }, 160);
    return () => window.clearInterval(id);
  }, [phase]);

  /* ---------------------------------------------------------------- keyboard */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const world = worldRef.current;
      if (event.key === 'Escape') {
        if (helpOpen) {
          setHelpOpen(false);
        } else if (route.kind === 'exhibit') {
          navigate({ kind: 'station', stationId: route.stationId });
        } else if (route.kind === 'station' || route.kind === 'flat') {
          navigate({ kind: 'hub' });
        }
        return;
      }
      // A panel open over the corridor owns the arrow keys. Reading a work with ↓ used to
      // scroll nothing and walk the camera out from under it, because preventDefault
      // suppressed the panel's own scrolling while the corridor shortcuts still fired.
      if (route.kind === 'exhibit' && activeStation) {
        const last = activeStation.exhibits.length - 1;
        if (event.key === 'ArrowRight') {
          navigate({
            kind: 'exhibit',
            stationId: activeStation.id,
            index: Math.min(last, route.index + 1),
          });
          event.preventDefault();
        } else if (event.key === 'ArrowLeft') {
          navigate({
            kind: 'exhibit',
            stationId: activeStation.id,
            index: Math.max(0, route.index - 1),
          });
          event.preventDefault();
        }
        return;
      }
      if (helpOpen) return;
      if (!world || world.getPhase() !== 'corridor') return;
      const step = 4;
      if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
        world.walk(step);
        event.preventDefault();
      } else if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
        world.walk(-step);
        event.preventDefault();
      } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        const next = activeExhibit + 1;
        if (activeStation && next < activeStation.exhibits.length) {
          world.focusExhibit(next);
          setActiveExhibit(next);
        }
        event.preventDefault();
      } else if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        const prev = activeExhibit - 1;
        if (prev >= 0) {
          world.focusExhibit(prev);
          setActiveExhibit(prev);
        }
        event.preventDefault();
      } else if (event.key === 'Enter' && activeStation) {
        navigate({ kind: 'exhibit', stationId: activeStation.id, index: activeExhibit });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [route, navigate, helpOpen, activeExhibit, activeStation]);

  /* ---------------------------------------------------------------- actions */

  const enterSpace = useCallback(() => {
    enteredRef.current = true;
    setEntered(true);
    const world = worldRef.current;
    if (!world) {
      pendingEntryRef.current = reducedMotion ? 'skip' : 'start';
      return;
    }
    if (reducedMotion) world.skipEntry();
    else world.startEntry();
  }, [reducedMotion]);

  const skipToDeck = useCallback(() => {
    enteredRef.current = true;
    setEntered(true);
    const world = worldRef.current;
    if (!world) {
      pendingEntryRef.current = 'skip';
      return;
    }
    world.skipEntry();
  }, []);

  const goFlat = useCallback(() => {
    setMode('flat');
    navigate({ kind: 'flat' });
  }, [navigate]);

  const toggleFlat = useCallback(() => {
    if (mode === 'flat') {
      setMode('3d');
      navigate({ kind: 'hub' });
    } else {
      goFlat();
    }
  }, [mode, navigate, goFlat]);

  const selectStation = useCallback((id: string) => {
    worldRef.current?.aimAtStation(id);
    setFoyerStationId(id);
  }, []);

  const foyerStation = stationById(foyerStationId ?? '') ?? stations[0];
  const foyerIndex = Math.max(0, stations.findIndex((station) => station.id === foyerStation.id));
  const moveFoyer = useCallback((delta: number) => {
    const next = (foyerIndex + delta + stations.length) % stations.length;
    const station = stations[next];
    setFoyerStationId(station.id);
    worldRef.current?.aimAtStation(station.id);
  }, [foyerIndex]);

  const closeStation = useCallback(() => navigate({ kind: 'hub' }), [navigate]);

  /* ---------------------------------------------------------------- render */

  /**
   * The work reader, shared by both views. Every work in the plain list is a real link to
   * `#/s/<station>/<index>`, so without it here those links went nowhere for the readers the
   * list exists for — a device with no WebGL, or anyone who simply prefers reading.
   */
  const reader =
    route.kind === 'exhibit' && activeStation ? (
      <ExhibitReader
        station={activeStation}
        index={route.index}
        onClose={() =>
          mode === 'flat'
            ? navigate({ kind: 'flat' })
            : navigate({ kind: 'station', stationId: activeStation.id })
        }
        onPrev={() =>
          navigate({
            kind: 'exhibit',
            stationId: activeStation.id,
            index: Math.max(0, route.index - 1),
          })
        }
        onNext={() =>
          navigate({
            kind: 'exhibit',
            stationId: activeStation.id,
            index: Math.min(activeStation.exhibits.length - 1, route.index + 1),
          })
        }
      />
    ) : null;

  if (mode === 'flat') {
    return (
      <>
        <TopBar crumb={null} flat onToggleFlat={toggleFlat} onHelp={() => setHelpOpen(true)} />
        <FlatView />
        {reader}
        {helpOpen ? (
          <HelpPanel
            onClose={() => setHelpOpen(false)}
            reducedMotion={reducedMotion}
            coarsePointer={coarsePointer}
          />
        ) : null}
        {/* Without WebGL there is nothing to switch to, so this only explains — offering
            "Cuba juga" made a promise the device could never keep. */}
        {!webgl ? (
          <p className="notice">
            Peranti ini tidak menyokong grafik 3D, jadi laman dipaparkan dalam bentuk senarai.
          </p>
        ) : null}
      </>
    );
  }

  const inCorridor = hintSpace === 'corridor';
  const dimmed = route.kind === 'station' && activeStation?.kind !== 'corridor';
  /** Pointing at a station wins over merely facing it; otherwise the room names itself. */
  const captionStation = stationById(hovered ?? facing ?? '');
  const crumbExhibit =
    route.kind === 'exhibit' && activeStation ? activeStation.exhibits[route.index] : undefined;

  return (
    <>
      <div className={`stage${dimmed ? ' is-dimmed' : ''}`}>
        <canvas ref={canvasRef} aria-hidden="true" />
      </div>
      <div className="vignette" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      {/*
       * The same light paintings the room is filled with, laid along the bottom of the
       * screen, so the chrome stands in the same light as the space instead of on a strip
       * of grey. Three drifting bands, drawn in CSS: it costs no extra WebGL work and
       * cannot fail on a device that has none.
       */}
      {entered ? (
        <div className="lightbed" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      ) : null}
      {phase === 'warp' ? <div className="warp-flash" aria-hidden="true" /> : null}

      {!entered ? (
        <EntryGate
          ready={ready}
          reducedMotion={reducedMotion}
          onEnter={enterSpace}
          onSkipToDeck={skipToDeck}
          onFlat={goFlat}
        />
      ) : (
        <>
          <TopBar
            flat={false}
            onToggleFlat={toggleFlat}
            onHelp={() => setHelpOpen(true)}
            crumb={
              crumbExhibit && activeStation ? (
                <>
                  <button
                    type="button"
                    className="crumb-link"
                    onClick={() => navigate({ kind: 'station', stationId: activeStation.id })}
                  >
                    {activeStation.label}
                  </button>
                  <span>/</span>
                  <b>{crumbExhibit.title}</b>
                </>
              ) : activeStation ? (
                <b>{activeStation.label}</b>
              ) : null
            }
          />

          {inCorridor && activeStation ? (
            <CorridorRail
              station={activeStation}
              activeIndex={activeExhibit}
              progress={corridorProgress}
              onSelect={(index) => {
                setActiveExhibit(index);
                worldRef.current?.focusExhibit(index);
              }}
              onWalk={(delta) => worldRef.current?.walk(delta)}
              onOpen={(index) =>
                navigate({ kind: 'exhibit', stationId: activeStation.id, index })
              }
              onExit={closeStation}
            />
          ) : null}

          {/*
           * The station dock stands in every part of the space, not only on the deck. It
           * used to be swapped out for the wing rail, which left a visitor inside a wing
           * with no way to reach another station — the one control that is always there had
           * silently gone. The wing rail is a second, local control and now sits beside it.
           */}
          {phase === 'hub' && !activeStation && foyerStation ? (
            <GalleryFoyer
              station={foyerStation}
              index={foyerIndex}
              total={stations.length}
              onPrevious={() => moveFoyer(-1)}
              onNext={() => moveFoyer(1)}
              onEnter={() => navigate({ kind: 'station', stationId: foyerStation.id })}
            />
          ) : null}
          <Dock
            stations={stations}
            activeId={hovered ?? facing ?? activeStation?.id ?? null}
            onSelect={selectStation}
            label="Pilih stesen"
            caption={<DeckCaption station={captionStation} fallback="Pilih stesen" />}
          />

          {/* The dock names the stations; the hint teaches the gesture. One line each,
              and the verb follows the device — a phone has no cursor to click with. */}
          <Hint retiring={taught === hintSpace} wing={inCorridor}>
            {inCorridor
              ? coarsePointer
                ? 'Undur / Maju untuk berjalan · Ketuk bingkai untuk membaca'
                : 'Scroll atau ↑ ↓ untuk berjalan · Klik bingkai untuk membaca'
              : coarsePointer
                ? 'Seret untuk memandang · Ketuk karya untuk masuk'
                : 'Seret untuk memandang · Klik karya untuk masuk'}
          </Hint>

          {route.kind === 'station' && activeStation && activeStation.kind !== 'corridor' ? (
            // The film station opens as a room of its own rather than as a slide-over:
            // sixteen-by-nine video inside a narrow panel is the one thing a screening
            // room must not be.
            activeStation.kind === 'video' ? (
              <VideoRoom station={activeStation} onClose={closeStation} />
            ) : (
              <StationPanel station={activeStation} onClose={closeStation} />
            )
          ) : null}

          {reader}
        </>
      )}

      {helpOpen ? (
        <HelpPanel
          onClose={() => setHelpOpen(false)}
          reducedMotion={reducedMotion}
          coarsePointer={coarsePointer}
        />
      ) : null}
    </>
  );
}
