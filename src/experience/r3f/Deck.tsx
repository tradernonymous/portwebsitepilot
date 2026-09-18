import { useRef, useEffect } from 'react';
import { useGalleryStore } from './galleryStore';
import { DeckFloor } from './DeckFloor';
import { DeckCenter } from './DeckCenter';
import { Monolith } from './Monolith';
import * as THREE from 'three';
import type { Station } from '../../content';

const HUB_RADIUS = 8.1;

type DeckProps = {
  stations: Station[];
  reducedMotion: boolean;
  onStationSelect?: (stationId: string) => void;
};

/**
 * The circular deck: a floor, a centre wordmark, and one monolith per station
 * arranged around the ring. Wheel and hover pick the focused station; clicking
 * walks into it.
 */
export function Deck({ stations, reducedMotion, onStationSelect }: DeckProps) {
  void reducedMotion;
  const { phase, focusedStationId, setFocusedStationId } = useGalleryStore();
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (phase !== 'hub') return;
      if (Math.abs(event.deltaY) < 10) return;
      const stationIds = stations.map(s => s.id);
      const currentIdx = focusedStationId ? stationIds.indexOf(focusedStationId) : 0;
      const step = event.deltaY > 0 ? 1 : -1;
      const nextIdx = (currentIdx + step + stationIds.length) % stationIds.length;
      setFocusedStationId(stationIds[nextIdx]);
      onStationSelect?.(stationIds[nextIdx]);
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [phase, focusedStationId, stations, setFocusedStationId, onStationSelect]);

  return (
    <group ref={groupRef} visible={phase === 'hub' || phase === 'warp'}>
      <DeckFloor />
      <DeckCenter />
      {stations.map((station, i) => {
        const n = stations.length;
        const angle = (i / n) * Math.PI * 2 + Math.PI / n;
        const isFocused = focusedStationId === station.id;
        const homePos: [number, number, number] = [
          Math.cos(angle) * HUB_RADIUS,
          0,
          Math.sin(angle) * HUB_RADIUS,
        ];
        const homeRot = -angle + Math.PI / 2;

        return (
          <Monolith
            key={station.id}
            station={station}
            position={isFocused ? [0, 0, -HUB_RADIUS] : homePos}
            rotationY={isFocused ? Math.PI : homeRot}
            accent={station.accent}
            isFocused={isFocused}
            onClick={() => onStationSelect?.(station.id)}
          />
        );
      })}
    </group>
  );
}