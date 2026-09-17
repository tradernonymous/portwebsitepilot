/**
 * MOTIFS — the visual language each room wears.
 *
 * PORT's own thread is lightpainting: colour thrown off a photographed object. These are the
 * other half of the conversation — how colour field painters, fluorescent light artists,
 * optical painters and light-and-space builders have handled colour, edge and light since the
 * 1950s. A motif is that language, generated; never a reproduction of anybody's work.
 *
 * Each room is assigned the language its *content* calls for rather than one cycled by
 * position, so the borrowed language says something true about what is in the room. The
 * assignment lives on the station itself (see `motif` in `index.ts`) so it reads as curation
 * next to the room's accent colour, and can be changed in one place.
 */

export type MotifKind =
  | 'field' // colour field painting — soft-edged stacked colour
  | 'tubes' // fluorescent light art — parallel bars of lit colour
  | 'aperture' // light-and-space — a lit rectangle in a dark wall
  | 'waves' // optical art — drifting concentric rings
  | 'dots' // the infinity room — a field of dots fading out
  | 'void' // the void — a black disc inside a chromatic ring
  | 'fog' // atmospheric installation — veils of coloured haze
  | 'scan'; // video art — broadcast scan lines and a rolling sweep

/** Every motif, in the order the stylesheet documents them. */
export const MOTIFS: MotifKind[] = ['field', 'tubes', 'aperture', 'waves', 'dots', 'void', 'fog', 'scan'];

/**
 * The motif a room wears.
 *
 * A room that names its own always keeps it. A room that does not gets one derived from its
 * id — stable, so a room never changes its look between visits, and unaffected by reordering
 * the walk, which a position-based choice would not survive.
 */
export function motifFor(room: { id: string; motif?: MotifKind }): MotifKind {
  if (room.motif) return room.motif;
  let hash = 0;
  for (let i = 0; i < room.id.length; i += 1) hash = (hash * 31 + room.id.charCodeAt(i)) >>> 0;
  return MOTIFS[hash % MOTIFS.length];
}
