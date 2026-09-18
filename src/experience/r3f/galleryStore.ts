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
  /**
   * Where a free-walking body may go in the open wing, published by the wing itself alongside
   * its length: the near and far stops on the walk axis, the half width, the plinths a body
   * must not walk through, and each work's viewing spot with the progress that names it.
   * A wing that publishes none keeps its visitor on the rail.
   */
  bounds: {
    zNear: number;
    zFar: number;
    halfX: number;
    plinths: { x: number; z: number; radius: number }[];
    works: { x: number; z: number; progress: number }[];
  } | null;
  /**
   * Whether the visitor has taken the walk into their own legs. The rail, the wheel and the
   * arrow keys stay live for free-walkers too — this adds a body over the rail, not instead of
   * it. When free-walking, the rail buttons become the keyboard-walk's own transport: a press
   * carries the body to that work's viewing spot and back to the line when done.
   */
  freeWalk: boolean;
  /** Whether the device tilts to look. Off until the visitor asks for it. */
  gyroLook: boolean;
  reducedMotion: boolean;

  setPhase: (phase: Phase) => void;
  setCurrentStation: (station: Station | null) => void;
  setFocusedStationId: (id: string | null) => void;
  setEntryProgress: (progress: number) => void;
  setWalkProgress: (progress: number) => void;
  setCorridorLength: (length: number) => void;
  setCorridorBounds: (bounds: GalleryState['bounds']) => void;
  setFreeWalk: (free: boolean) => void;
  setGyroLook: (on: boolean) => void;
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
    bounds: null,
    freeWalk: false,
    gyroLook: false,
    reducedMotion: false,

    setPhase: (phase) => set({ phase }),
    setCurrentStation: (station) => set({ currentStation: station }),
    setFocusedStationId: (id) => set({ focusedStationId: id }),
    setEntryProgress: (progress) => set({ entryProgress: progress }),
    setWalkProgress: (progress) => set({ walkProgress: progress }),
    setCorridorLength: (length) => set({ corridorLength: length }),
    setCorridorBounds: (bounds) => set({ bounds }),
    setFreeWalk: (free) => set({ freeWalk: free }),
    setGyroLook: (on) => set({ gyroLook: on }),
    setReducedMotion: (reduced) => set({ reducedMotion: reduced }),

    openCorridor: (station) => set({
      currentStation: station,
      phase: 'warp',
      walkProgress: 0,
      bounds: null,
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