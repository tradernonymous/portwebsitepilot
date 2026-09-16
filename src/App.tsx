import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { stationById, stations } from './content';
import type { Phase, PortWorld } from './experience/PortWorld';
import { detectWebGL, useHashRoute, useReducedMotion } from './lib/hooks';
import { CorridorRail, Dock, Hint, TopBar } from './ui/Hud';
import { EntryGate } from './ui/EntryGate';
import { ExhibitReader } from './ui/ExhibitReader';
import { FlatView } from './ui/FlatView';
import { HelpPanel } from './ui/HelpPanel';
import { StationPanel } from './ui/StationPanel';

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
  const [activeExhibit, setActiveExhibit] = useState(0);
  const [corridorProgress, setCorridorProgress] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);

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
        onStationSelect: (id) => {
          setHovered(id);
          navigate({ kind: 'station', stationId: id });
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

  // No WebGL, or someone arrived on a flat deep link: honour it before anything else.
  useEffect(() => {
    if (!webgl || route.kind === 'flat') setMode('flat');
  }, [webgl, route.kind]);

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

  const selectStation = useCallback(
    (id: string) => {
      worldRef.current?.aimAtStation(id);
      navigate({ kind: 'station', stationId: id });
    },
    [navigate],
  );

  const closeStation = useCallback(() => navigate({ kind: 'hub' }), [navigate]);

  /* ---------------------------------------------------------------- render */

  if (mode === 'flat') {
    return (
      <>
        <TopBar crumb={null} flat onToggleFlat={toggleFlat} onHelp={() => setHelpOpen(true)} />
        <FlatView />
        {helpOpen ? <HelpPanel onClose={() => setHelpOpen(false)} reducedMotion={reducedMotion} /> : null}
        {!webgl ? (
          <p className="notice">
            Peranti ini tidak menyokong grafik 3D, jadi laman dipaparkan dalam bentuk senarai.
            <button type="button" onClick={toggleFlat}>
              Cuba juga
            </button>
          </p>
        ) : null}
      </>
    );
  }

  const inCorridor = phase === 'corridor' && activeStation?.kind === 'corridor';
  const dimmed = route.kind === 'station' && activeStation?.kind !== 'corridor';

  return (
    <>
      <div className={`stage${dimmed ? ' is-dimmed' : ''}`}>
        <canvas ref={canvasRef} aria-hidden="true" />
      </div>
      <div className="vignette" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
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
              route.kind === 'exhibit' && activeStation ? (
                <>
                  <button type="button" className="crumb-link" onClick={() => navigate({ kind: 'station', stationId: activeStation.id })}>
                    {activeStation.label}
                  </button>
                  <span>/</span>
                  <b>{activeStation.exhibits[route.index]?.title ?? ''}</b>
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
          ) : (
            <>
              <Dock
                stations={stations}
                activeId={hovered ?? activeStation?.id ?? null}
                onSelect={selectStation}
                label="Pilih stesen — atau klik monolit di hadapan anda"
              />
              <Hint>Seret untuk memandang · Klik monolit untuk masuk</Hint>
            </>
          )}

          {inCorridor ? <Hint>Scroll atau ↑ ↓ untuk berjalan · Klik bingkai untuk membaca</Hint> : null}

          {route.kind === 'station' && activeStation && activeStation.kind !== 'corridor' ? (
            <StationPanel station={activeStation} onClose={closeStation} />
          ) : null}

          {route.kind === 'exhibit' && activeStation ? (
            <ExhibitReader
              station={activeStation}
              index={route.index}
              onClose={() => navigate({ kind: 'station', stationId: activeStation.id })}
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
          ) : null}
        </>
      )}

      {helpOpen ? (
        <HelpPanel onClose={() => setHelpOpen(false)} reducedMotion={reducedMotion} />
      ) : null}
    </>
  );
}
