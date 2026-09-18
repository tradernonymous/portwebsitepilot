import { useEffect, useState } from 'react';
import type { Station } from '../content';
import { useMediaQuery } from '../lib/hooks';
import { useLang } from '../lib/lang';
import { ExhibitReader } from './ExhibitReader';
import { CorridorRail, Hint } from './Hud';
import { ErrorBoundary } from '../lib/errors';
import { GalleryCanvas } from '../experience/r3f/GalleryCanvas';
import { useGalleryStore } from '../experience/r3f/galleryStore';

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
      const store = useGalleryStore.getState();
      if (event.key === 'ArrowDown' || event.key === 's') {
        store.setWalkProgress(Math.min(1, store.walkProgress + 0.06));
        event.preventDefault();
      } else if (event.key === 'ArrowUp' || event.key === 'w') {
        store.setWalkProgress(Math.max(0, store.walkProgress - 0.06));
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
  }, [active, reading, onExit, station.exhibits.length]);

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
        onWalk={(delta) => {
          const store = useGalleryStore.getState();
          store.setWalkProgress(Math.max(0, Math.min(1, store.walkProgress + delta)));
        }}
        onOpen={(index) => setReading(index)}
        onExit={onExit}
      />
      <Hint retiring={taught}>{t(coarse ? 'hintWalkCoarse' : 'hintWalkFine')}</Hint>
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