import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Station } from '../../content';

type Phase = 'entry' | 'hub' | 'warp' | 'corridor';

interface GalleryState {
  phase: Phase;
  currentStation: Station | null;
  focusedStationId: string | null;
  entryProgress: number;
  walkProgress: number;
  /**
   * How long the open wing is, in world units. Only `Corridor` knows this, and only the camera
   * and the wheel need it — so the wing publishes it here instead of each of them keeping a
   * private guess. It was a ref that nothing ever assigned, which is what froze the walk.
   */
  corridorLength: number;
  reducedMotion: boolean;

  setPhase: (phase: Phase) => void;
  setCurrentStation: (station: Station | null) => void;
  setFocusedStationId: (id: string | null) => void;
  setEntryProgress: (progress: number) => void;
  setWalkProgress: (progress: number) => void;
  setCorridorLength: (length: number) => void;
  setReducedMotion: (reduced: boolean) => void;

  openCorridor: (station: Station) => void;
  leaveStation: () => void;
  skipEntry: () => void;
}

export const useGalleryStore = create<GalleryState>()(
  subscribeWithSelector((set) => ({
    phase: 'entry',
    currentStation: null,
    focusedStationId: null,
    entryProgress: 0,
    walkProgress: 0,
    corridorLength: 0,
    reducedMotion: false,

    setPhase: (phase) => set({ phase }),
    setCurrentStation: (station) => set({ currentStation: station }),
    setFocusedStationId: (id) => set({ focusedStationId: id }),
    setEntryProgress: (progress) => set({ entryProgress: progress }),
    setWalkProgress: (progress) => set({ walkProgress: progress }),
    setCorridorLength: (length) => set({ corridorLength: length }),
    setReducedMotion: (reduced) => set({ reducedMotion: reduced }),

    openCorridor: (station) => set({
      currentStation: station,
      phase: 'warp',
      walkProgress: 0,
    }),

    leaveStation: () => set({
      currentStation: null,
      phase: 'hub',
    }),

    skipEntry: () => set({
      phase: 'hub',
      entryProgress: 1,
    }),
  }))
);