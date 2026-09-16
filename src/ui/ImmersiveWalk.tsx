import { useEffect, useRef, useState } from 'react';
import type { Station } from '../content';
import type { PortWorld } from '../experience/PortWorld';
import { useMediaQuery } from '../lib/hooks';
import { useLang } from '../lib/lang';
import { ExhibitReader } from './ExhibitReader';
import { CorridorRail, Hint } from './Hud';

type Props = {
  station: Station;
  reducedMotion: boolean;
  onExit: () => void;
};

/**
 * A room walked in 3D. three.js is loaded only when someone asks for this, builds only the
 * one wing, and is torn down the moment they leave — the gallery itself never pays for it.
 */
export function ImmersiveWalk({ station, reducedMotion, onExit }: Props) {
  const { t } = useLang();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<PortWorld | null>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [reading, setReading] = useState<number | null>(null);
  const [taught, setTaught] = useState(false);
  const coarse = useMediaQuery('(pointer: coarse)');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let world: PortWorld | null = null;
    void import('../experience/PortWorld').then(({ PortWorld: World }) => {
      if (cancelled) return;
      world = new World(canvas, {
        stations: [station],
        reducedMotion,
        corridorOnly: true,
        onReady: () => setReady(true),
        onExhibitSelect: (index) => setReading(index),
        onExhibitFocus: (index) => setActive(index),
      });
      worldRef.current = world;
      world.mount();
      world.openCorridor(station);
    });
    const poll = window.setInterval(() => setProgress(worldRef.current?.getWalkProgress() ?? 0), 160);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      world?.dispose();
      worldRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station.id]);

  useEffect(() => {
    document.body.classList.add('is-walking');
    return () => document.body.classList.remove('is-walking');
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
      const world = worldRef.current;
      if (event.key === 'Escape') {
        onExit();
        return;
      }
      if (!world) return;
      if (event.key === 'ArrowDown' || event.key === 's') {
        world.walk(4);
        event.preventDefault();
      } else if (event.key === 'ArrowUp' || event.key === 'w') {
        world.walk(-4);
        event.preventDefault();
      } else if (event.key === 'ArrowRight' || event.key === 'd') {
        const next = Math.min(station.exhibits.length - 1, active + 1);
        world.focusExhibit(next);
        setActive(next);
      } else if (event.key === 'ArrowLeft' || event.key === 'a') {
        const prev = Math.max(0, active - 1);
        world.focusExhibit(prev);
        setActive(prev);
      } else if (event.key === 'Enter') {
        setReading(active);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, reading, onExit, station.exhibits.length]);

  return (
    <div className="walk">
      <canvas ref={canvasRef} className="walk-canvas" aria-hidden="true" />
      {!ready ? <p className="walk-loading">{t('loading3d')}</p> : null}
      <CorridorRail
        station={station}
        activeIndex={active}
        progress={progress}
        onSelect={(index) => {
          setActive(index);
          worldRef.current?.focusExhibit(index);
        }}
        onWalk={(delta) => worldRef.current?.walk(delta)}
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
