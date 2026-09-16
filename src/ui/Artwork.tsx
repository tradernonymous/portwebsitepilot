import type { CSSProperties } from 'react';
import type { GalleryImage } from '../content';
import { LightPainting } from './fx/LightPainting';

/**
 * A photograph hung properly.
 *
 * The synced photographs are web exports — most are 800 to 1400 pixels wide — so the one
 * thing they must never be is stretched: that is where the broken, blocky look came from.
 * The browser is handed both sizes with their real widths and picks the sharper one for the
 * space; `contain` never upscales past the file's own width; `cover` is only used in frames
 * small enough for the file to fill.
 */
export function Artwork({
  image,
  alt = '',
  fit = 'cover',
  sizes = '(max-width: 760px) 92vw, 420px',
  eager = false,
  className,
  style,
}: {
  image: GalleryImage;
  alt?: string;
  fit?: 'cover' | 'contain';
  sizes?: string;
  eager?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const largeWidth = image.width ?? 1400;
  return (
    <img
      className={`artwork is-${fit}${className ? ` ${className}` : ''}`}
      src={image.large}
      srcSet={`${image.small} ${Math.min(560, largeWidth)}w, ${image.large} ${largeWidth}w`}
      sizes={sizes}
      alt={alt}
      width={image.width}
      height={image.height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      style={fit === 'contain' ? { maxWidth: `min(100%, ${largeWidth}px)`, ...style } : style}
    />
  );
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * The plate a work gets when it has no photograph of its own: a light painting exposed once
 * for that work alone (seeded by its id, so it is always the same picture), with the title
 * set on it like a gallery card. Honest, and never a stranger's photograph.
 */
export function LightPlate({ id, title, label }: { id: string; title: string; label?: string }) {
  const seed = hash(id);
  return (
    <div className="light-plate">
      <LightPainting still tone="dark" painters={3} seed={seed} weight={1.3} />
      <div className="light-plate-copy">
        {label ? <span>{label}</span> : null}
        <b>{title}</b>
      </div>
    </div>
  );
}
