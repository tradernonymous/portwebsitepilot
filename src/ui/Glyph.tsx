import type { GlyphKey } from '../content';
import { glyphSvgPath } from '../content/glyphs';

type Props = {
  glyph: GlyphKey;
  size?: number;
  className?: string;
};

/** Renders the shared station glyph inline, so HUD and 3D always match. */
export function Glyph({ glyph, size = 20, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d={glyphSvgPath(glyph)} fill="currentColor" />
    </svg>
  );
}
