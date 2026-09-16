import type { Station } from '../content';

/** The film room leads: it is the hall's hero, and every other room follows along the corridor. */
export const HERO_ROOM = 'video';

/** Rooms in the order a visitor meets them — the hero first, then the corridor. */
export function tourOrder(stations: Station[]): Station[] {
  const hero = stations.find((s) => s.id === HERO_ROOM);
  return hero ? [hero, ...stations.filter((s) => s.id !== HERO_ROOM)] : stations;
}

export function roomNumber(stations: Station[], id: string): number {
  return tourOrder(stations).findIndex((s) => s.id === id) + 1;
}

export const pad = (n: number) => String(n).padStart(2, '0');
