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
  reducedMotion: boolean;

  setPhase: (phase: Phase) => void;
  setCurrentStation: (station: Station | null) => void;
  setFocusedStationId: (id: string | null) => void;
  setEntryProgress: (progress: number) => void;
  setWalkProgress: (progress: number) => void;
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
    reducedMotion: false,

    setPhase: (phase) => set({ phase }),
    setCurrentStation: (station) => set({ currentStation: station }),
    setFocusedStationId: (id) => set({ focusedStationId: id }),
    setEntryProgress: (progress) => set({ entryProgress: progress }),
    setWalkProgress: (progress) => set({ walkProgress: progress }),
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