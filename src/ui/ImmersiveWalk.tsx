import { useCallback, useEffect, useState } from 'react';
import type { Station } from '../content';
import { useMediaQuery } from '../lib/hooks';
import { useLang } from '../lib/lang';
import { ExhibitReader } from './ExhibitReader';
import { CorridorRail, Hint } from './Hud';
import { ErrorBoundary } from '../lib/errors';
import { GalleryCanvas } from '../experience/r3f/GalleryCanvas';
import { useGalleryStore } from '../experience/r3f/galleryStore';
import { FreeWalkControls, FreeWalkToggle, QualityPicker } from './FreeWalkControls';
import { freeWalkBus } from '../experience/r3f/input';

type Props = {
  station: Station;
  reducedMotion: boolean;
  onExit: () => void;
};

/**
 * A room walked in 3D. React Three Fiber loads only when someone asks for this, builds only
 * the one wing, and is torn down the moment they leave — the gallery itself never pays for it.
 */
export function ImmersiveWalk({ station, reducedMotion, onExit }: Props) {
  const { t } = useLang();
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [reading, setReading] = useState<number | null>(null);
  const [taught, setTaught] = useState(false);
  const coarse = useMediaQuery('(pointer: coarse)');

  // Initialise the zustand store for corridor-only mode.
  useEffect(() => {
    const store = useGalleryStore.getState();
    store.setReducedMotion(reducedMotion);
    store.setCurrentStation(station);
    store.setPhase('corridor');
    store.setWalkProgress(0);
  }, [station.id, reducedMotion]);

  // Bridge walkProgress from the store to this component's local state.
  useEffect(() => {
    const unsub = useGalleryStore.subscribe(
      (s) => s.walkProgress,
      (p) => setProgress(p),
    );
    return unsub;
  }, []);

  useEffect(() => {
    document.body.classList.add('is-walking');
    return () => {
      document.body.classList.remove('is-walking');
      useGalleryStore.getState().setCurrentStation(null);
    };
  }, []);

  useEffect(() => {
    const retire = () => setTaught(true);
    window.addEventListener('pointerdown', retire, { once: true });
    window.addEventListener('keydown', retire, { once: true });
    window.addEventListener('wheel', retire, { once: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', retire);
      window.removeEventListener('keydown', retire);
      window.removeEventListener('wheel', retire);
    };
  }, []);

  /*
   * One step of the walk is one frame of the wing. The arrow keys and the rail buttons both
   * take a step in works rather than a raw progress fraction, so a press lands you at a work
   * and not somewhere between two — the button was written for a world-space distance and was
   * being added to a 0–1 progress, which sent it straight to the far end of the wing.
   */
  const step = 1 / Math.max(1, station.exhibits.length);
  const walkBy = useCallback(
    (steps: number) => {
      const store = useGalleryStore.getState();
      /*
       * With a body, the rail buttons are the body's transport: a press carries it to the
       * neighbouring work's viewing spot instead of sliding the line out from under it. The
       * camera owns the body, so the command goes through the bus; it no-ops when no wing is
       * open, and the rail's own bounds checking still applies through the store.
       */
      if (store.freeWalk && freeWalkBus.carryBy) {
        freeWalkBus.carryBy(steps);
        return;
      }
      store.setWalkProgress(Math.max(0, Math.min(1, store.walkProgress + steps * step)));
    },
    [step],
  );

  /*
   * A step taken at either end of the wing writes the same progress back, so the store does not
   * change, React does not render, and the control reads as broken rather than as finished —
   * the visitor who has reached the last work presses MAJU and nothing ever happens. The rail
   * disables the step it cannot honour instead. The epsilon absorbs the rounding left by adding
   * a fraction n times, so the end is reached exactly rather than one press short of it.
   */
  const atStart = progress <= 1e-6;
  const atEnd = progress >= 1 - 1e-6;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (reading !== null) {
        if (event.key === 'Escape') setReading(null);
        return;
      }
      if (event.key === 'Escape') {
        onExit();
        return;
      }
      /*
       * The free-walking body owns the movement keys while it exists — the camera reads the
       * held set every frame. The walk mode's own Escape (leave the wing) still answers.
       */
      if (useGalleryStore.getState().freeWalk) return;
      if (event.key === 'ArrowDown' || event.key === 's') {
        walkBy(1);
        event.preventDefault();
      } else if (event.key === 'ArrowUp' || event.key === 'w') {
        walkBy(-1);
        event.preventDefault();
      } else if (event.key === 'ArrowRight' || event.key === 'd') {
        const next = Math.min(station.exhibits.length - 1, active + 1);
        setActive(next);
        event.preventDefault();
      } else if (event.key === 'ArrowLeft' || event.key === 'a') {
        const prev = Math.max(0, active - 1);
        setActive(prev);
        event.preventDefault();
      } else if (event.key === 'Enter') {
        setReading(active);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, reading, onExit, station.exhibits.length, walkBy]);

  return (
    <div className="walk">
      <ErrorBoundary name="walk" flat>
        <GalleryCanvas
          stations={[station]}
          reducedMotion={reducedMotion}
          corridorOnly={true}
          onExhibitSelect={(index) => setReading(index)}
          onExhibitFocus={(index) => setActive(index)}
          onExit={onExit}
        />
      </ErrorBoundary>
      <CorridorRail
        station={station}
        activeIndex={active}
        progress={progress}
        onSelect={(index) => {
          setActive(index);
        }}
        onWalk={walkBy}
        canWalkBack={!atStart}
        canWalkForward={!atEnd}
        onOpen={(index) => setReading(index)}
        onExit={onExit}
      />
      <Hint retiring={taught}>{t(coarse ? 'hintWalkCoarse' : 'hintWalkFine')}</Hint>
      <FreeWalkToggle coarse={coarse} />
      <FreeWalkControls coarse={coarse} />
      <QualityPicker />
      {reading !== null ? (
        <ExhibitReader
          station={station}
          index={reading}
          onClose={() => setReading(null)}
          onPrev={() => setReading((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setReading((i) => Math.min(station.exhibits.length - 1, (i ?? 0) + 1))}
        />
      ) : null}
    </div>
  );
}