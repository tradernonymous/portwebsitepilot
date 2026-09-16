import { useId, type CSSProperties } from 'react';

type Props = {
  /** Diameter, any CSS length. */
  size?: string;
  /** Meridians — more rings read as a denser sphere of light. */
  rings?: number;
  /** Seconds per revolution. */
  period?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * The light painter's orb, built from SVG in real 3D.
 *
 * Spin a ring of light on its axis during a long exposure and the photograph shows a sphere.
 * Here each ring is a flat SVG circle, turned in CSS 3D space (`preserve-3d`) around the
 * vertical axis, with two latitude rings crossing them — so the orb has real depth and
 * perspective, and the browser's compositor does all the turning. No canvas, no WebGL, no
 * per-frame JavaScript.
 */
export function Orb({ size = 'min(62vmin, 560px)', rings = 9, period = 28, className, style }: Props) {
  const uid = useId().replace(/:/g, '');
  const gradient = `orb-${uid}`;

  return (
    <div
      className={`orb${className ? ` ${className}` : ''}`}
      style={{ ...style, ['--orb-size' as string]: size, ['--orb-period' as string]: `${period}s` }}
      aria-hidden="true"
    >
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3de8ff" />
            <stop offset="0.35" stopColor="#8b5cff" />
            <stop offset="0.65" stopColor="#ff3dcb" />
            <stop offset="1" stopColor="#ffb13d" />
          </linearGradient>
        </defs>
      </svg>
      <div className="orb-core" />
      <div className="orb-spin">
        {Array.from({ length: rings }, (_, i) => (
          <svg
            key={`m${i}`}
            className="orb-ring"
            viewBox="0 0 200 200"
            style={{ transform: `rotateY(${(i * 180) / rings}deg)` }}
          >
            <circle cx="100" cy="100" r="97" fill="none" stroke={`url(#${gradient})`} strokeWidth="5" opacity="0.14" />
            <circle
              cx="100"
              cy="100"
              r="97"
              fill="none"
              stroke={`url(#${gradient})`}
              strokeWidth="0.9"
              strokeDasharray={i % 2 ? '2 5' : undefined}
              opacity="0.9"
            />
          </svg>
        ))}
        {[-0.45, 0, 0.45].map((lat) => (
          <svg
            key={`l${lat}`}
            className="orb-ring is-latitude"
            viewBox="0 0 200 200"
            style={{
              transform: `translateY(calc(var(--orb-size) * ${lat / 2})) rotateX(90deg) scale(${Math.sqrt(1 - lat * lat)})`,
            }}
          >
            <circle cx="100" cy="100" r="97" fill="none" stroke={`url(#${gradient})`} strokeWidth="1.2" opacity="0.75" />
          </svg>
        ))}
      </div>
    </div>
  );
}
