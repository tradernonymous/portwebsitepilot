/**
 * Motifs — the visual languages of contemporary art, as generated backgrounds.
 *
 * Lightpainting is PORT's own thread: colour thrown off a photographed object. These are
 * the other half of the conversation — how colour field painters, fluorescent light
 * artists, optical painters and light-and-space builders have handled colour, edge and
 * light since the 1950s. The pattern is generated, never a reproduction: the language,
 * not the picture.
 *
 * The motif is always `aria-hidden` and never interactive. It is the air in the room.
 */
export type MotifKind = 'field' | 'tubes' | 'aperture' | 'waves' | 'dots' | 'void' | 'fog';

/** The motif cycle, so a run of panels never repeats its neighbour. */
export const MOTIF_CYCLE: MotifKind[] = ['field', 'tubes', 'aperture', 'waves', 'dots', 'void', 'fog'];

export function Motif({ kind, className }: { kind: MotifKind; className?: string }) {
  return <div className={`motif motif-${kind}${className ? ` ${className}` : ''}`} aria-hidden="true" />;
}
