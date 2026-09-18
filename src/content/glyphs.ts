import type { GlyphKey } from './index';

/**
 * Single source of truth for the station glyphs: the same 24x24 path data is used by
 * the React HUD (as inline SVG) and by the 3D space (rasterised onto a canvas texture),
 * so a monolith and its tab always carry the same mark.
 */
export const glyphPaths: Record<GlyphKey, string> = {
  // compass — "who we are, where we come from"
  compass:
    'M12 1.75A10.25 10.25 0 1 0 22.25 12 10.26 10.26 0 0 0 12 1.75Zm0 2.1A8.15 8.15 0 1 1 3.85 12 8.16 8.16 0 0 1 12 3.85Zm4.86 3.29-6.2 2.62a1 1 0 0 0-.54.54l-2.62 6.2a1 1 0 0 0 1.32 1.32l6.2-2.62a1 1 0 0 0 .54-.54l2.62-6.2a1 1 0 0 0-1.32-1.32ZM12 13.5A1.5 1.5 0 1 1 13.5 12 1.5 1.5 0 0 1 12 13.5Z',
  // stage — performance / symposium
  stage:
    'M12 1.75A3.25 3.25 0 0 0 8.75 5v6a3.25 3.25 0 0 0 6.5 0V5A3.25 3.25 0 0 0 12 1.75Zm-5.1 9.4a.9.9 0 0 0-1.8 0A7.05 7.05 0 0 0 11.1 18.1v2.2H8.6a.9.9 0 0 0 0 1.8h6.8a.9.9 0 0 0 0-1.8h-2.5v-2.2a7.05 7.05 0 0 0 6-6.95.9.9 0 0 0-1.8 0 5.25 5.25 0 0 1-10.2 0Z',
  // brush — residency / studio practice
  brush:
    'M18.6 2.4a3.1 3.1 0 0 1 4.36 4.36L13.2 16.5l-2.4-2.4ZM9.4 15.4l2.4 2.4-.6 1.5a3.2 3.2 0 0 1-1.7 1.75l-4.2 1.9a.9.9 0 0 1-1.2-1.2l1.9-4.2A3.2 3.2 0 0 1 7.75 15.8ZM3 4.5a.9.9 0 0 1 .9-.9h6.2a.9.9 0 0 1 0 1.8H3.9A.9.9 0 0 1 3 4.5Zm0 3.6a.9.9 0 0 1 .9-.9h3.4a.9.9 0 0 1 0 1.8H3.9a.9.9 0 0 1-.9-.9Z',
  // frame — exhibitions
  frame:
    'M3.5 2.5h17a1 1 0 0 1 1 1v17a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1Zm1.1 2.1v14.8h14.8V4.6Zm2.3 12.1 3.4-6.6 2.5 4.1 1.7-2.3 3.4 4.8Zm2.6-9.3a1.7 1.7 0 1 1 1.7 1.7 1.7 1.7 0 0 1-1.7-1.7Z',
  // wave — archive / audio
  wave:
    'M1.5 10.6a.9.9 0 0 1 1.8 0v2.8a.9.9 0 0 1-1.8 0Zm4.2-3.4a.9.9 0 0 1 1.8 0v9.6a.9.9 0 0 1-1.8 0ZM10 2.9a.9.9 0 0 1 1.8 0v18.2a.9.9 0 0 1-1.8 0Zm4.4 4.3a.9.9 0 0 1 1.8 0v9.6a.9.9 0 0 1-1.8 0Zm4.3 3.4a.9.9 0 0 1 1.8 0v2.8a.9.9 0 0 1-1.8 0Z',
  // beacon — current programmes / announcements
  beacon:
    'M12 1.5a3.4 3.4 0 1 1-3.4 3.4A3.4 3.4 0 0 1 12 1.5Zm-1.05 8.1h2.1l3.1 8.05a1 1 0 0 1-.93 1.35h-6.44a1 1 0 0 1-.93-1.35ZM6.9 8.05a.9.9 0 0 1 .5 1.17l-.7 1.8a.9.9 0 0 1-1.67-.66l.7-1.8a.9.9 0 0 1 1.17-.5Zm10.2 0a.9.9 0 0 1 1.17.5l.7 1.8a.9.9 0 0 1-1.67.66l-.7-1.8a.9.9 0 0 1 .5-1.17ZM9.5 19.9h5a.9.9 0 0 1 0 1.8h-5a.9.9 0 0 1 0-1.8Z',
  // pin — visit / contact
  pin:
    'M12 1.6a7.6 7.6 0 0 0-7.6 7.6c0 5.4 6.4 12.6 7 13.3a.85.85 0 0 0 1.24 0c.6-.7 7-7.9 7-13.3A7.6 7.6 0 0 0 12 1.6Zm0 10.5A2.9 2.9 0 1 1 14.9 9.2 2.9 2.9 0 0 1 12 12.1Z',
  // plinth — the sculpture court: a form standing on its own pedestal
  plinth:
    'M12 2.1a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM8 10.6h8l1.1 8.1a1 1 0 0 1-1 1.14H7.9a1 1 0 0 1-1-1.14ZM3.6 21.3h16.8v1.4H3.6Z',
  // video — the film and interview shelf
  video:
    'M2.6 3.6h18.8a1.6 1.6 0 0 1 1.6 1.6v13.6a1.6 1.6 0 0 1-1.6 1.6H2.6a1.6 1.6 0 0 1-1.6-1.6V5.2a1.6 1.6 0 0 1 1.6-1.6Zm1.7 1.7v13.4h15.4V5.3Zm5.3 2.9l7 3.8-7 3.8Z',
};

/** Ready-to-use inline SVG for the React HUD. */
export function glyphSvgPath(key: GlyphKey): string {
  return glyphPaths[key];
}

/**
 * A data-URL SVG, used to rasterise the glyph for the 3D monoliths. The explicit
 * width/height matter: without them a browser reports no intrinsic size and
 * three.js's TextureLoader would hand back a zero-sized image.
 */
export function glyphDataUrl(key: GlyphKey, colour: string, px = 256): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24">` +
    `<path fill="${colour}" d="${glyphPaths[key]}"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
