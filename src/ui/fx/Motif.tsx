import type { MotifKind } from '../../content/motifs';

/**
 * A generated background in one of the visual languages of contemporary art.
 *
 * The vocabulary and the assignment live in `content/motifs.ts`; this only renders one. The
 * motif is always `aria-hidden`, never interactive, and always sits under the lightpainting —
 * it is the air in the room, not a subject.
 */
export function Motif({ kind, className }: { kind: MotifKind; className?: string }) {
  return <div className={`motif motif-${kind}${className ? ` ${className}` : ''}`} aria-hidden="true" />;
}
