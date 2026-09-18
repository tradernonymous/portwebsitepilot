/**
 * Quality levels and the hardware they buy, in one place.
 *
 * The governor walks this ladder; the Canvas reads the counts from the store. Three levels
 * because a setting nobody can name is a setting nobody uses — and one `auto`, the default,
 * which hands the decision to the sampler until the visitor takes it back.
 */
export type QualityLevel = 'low' | 'mid' | 'high';
export type QualityPref = QualityLevel | 'auto';

export const QUALITY_ORDER: QualityLevel[] = ['low', 'mid', 'high'];

/** Device pixel ratio ceilings. Richer rooms cost render resolution first. */
export const DPR_FOR: Record<QualityLevel, number> = {
  low: 1,
  mid: 1.5,
  high: 2,
};

/** Ambient dust particle counts. The governor trims these before it trims the room. */
export const DUST_FOR: Record<QualityLevel, number> = {
  low: 0,
  mid: 220,
  high: 520,
};

export function stepDown(level: QualityLevel): QualityLevel {
  const i = QUALITY_ORDER.indexOf(level);
  return QUALITY_ORDER[Math.max(0, i - 1)];
}

export function stepUp(level: QualityLevel): QualityLevel {
  const i = QUALITY_ORDER.indexOf(level);
  return QUALITY_ORDER[Math.min(QUALITY_ORDER.length - 1, i + 1)];
}

const KEY = 'port.qualityPref';

export function loadQualityPref(): QualityPref | null {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'low' || v === 'mid' || v === 'high' || v === 'auto') return v;
    return null;
  } catch {
    return null;
  }
}

export function saveQualityPref(pref: QualityPref): void {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* private mode — the visitor simply re-picks next visit */
  }
}
