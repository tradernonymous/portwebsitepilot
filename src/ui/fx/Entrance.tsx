import { useEffect, useRef } from 'react';
import { entranceStages } from '../../content';
import { PrismShards } from './PrismShards';

/**
 * Walking into PORT.
 *
 * The camera moves into the real building — the street front first when a photograph of it
 * has been supplied, then PORT's own lobby — travelling towards the doorway while light
 * shards ignite on the walls. At the door the light takes over: the doorway opens as a
 * widening aperture of white, the gallery is placed underneath, and the white dissolves
 * into it.
 *
 * Every moving part is a transform, an opacity or a clip-path on a composited layer. The
 * photographs are web-sized, so the push-in stops well short of the point where they would
 * break up, and the light carries the rest of the way.
 */
export function Entrance({
  onMidpoint,
  onDone,
  reducedMotion = false,
}: {
  /** The screen is fully white — swap in the gallery now. */
  onMidpoint: () => void;
  onDone: () => void;
  reducedMotion?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const stageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shards = useRef<HTMLDivElement>(null);
  const aperture = useRef<HTMLDivElement>(null);
  const midpoint = useRef(onMidpoint);
  const done = useRef(onDone);
  midpoint.current = onMidpoint;
  done.current = onDone;

  const stages = entranceStages;
  const last = stages[stages.length - 1];

  useEffect(() => {
    if (reducedMotion || !stages.length) {
      const a = window.setTimeout(() => midpoint.current(), 200);
      const b = window.setTimeout(() => done.current(), 480);
      return () => {
        window.clearTimeout(a);
        window.clearTimeout(b);
      };
    }

    const perStage = 1500;
    const doorway = 900;
    const total = stages.length * perStage + doorway;
    const start = performance.now();
    let raf = 0;
    let swapped = false;
    let leave = 0;

    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const easeIn = (x: number) => x * x * x;

    const tick = (now: number) => {
      const elapsed = now - start;

      stages.forEach((_stage, i) => {
        const el = stageRefs.current[i];
        if (!el) return;
        const local = (elapsed - i * perStage) / perStage;
        const isLast = i === stages.length - 1;
        // the final stage keeps pushing through the doorway phase
        const span = isLast ? (elapsed - i * perStage) / (perStage + doorway) : local;
        const p = Math.min(1, Math.max(0, span));
        const scale = 1.04 + (isLast ? easeIn(p) * 1.75 + ease(p) * 0.25 : ease(p) * 1.9);
        el.style.transform = `scale(${scale.toFixed(4)})`;
        const fadeIn = i === 0 ? Math.min(1, elapsed / 350) : Math.min(1, Math.max(0, (local + 0.02) / 0.18));
        const fadeOut = isLast ? 1 : 1 - Math.min(1, Math.max(0, (local - 0.82) / 0.18));
        el.style.opacity = String(Math.min(fadeIn, fadeOut));
      });

      const q = Math.min(1, elapsed / total);
      if (shards.current) {
        shards.current.style.opacity = String(Math.min(0.95, Math.max(0, (q - 0.15) / 0.35)));
        shards.current.style.transform = `scale(${(1 + easeIn(q) * 1.6).toFixed(4)})`;
      }

      // the doorway opens into white
      const open = Math.max(0, (elapsed - (total - doorway)) / doorway);
      if (aperture.current) {
        aperture.current.style.clipPath = `circle(${(easeIn(Math.min(1, open)) * 150).toFixed(2)}% at ${last.focus.x * 100}% ${last.focus.y * 100}%)`;
        aperture.current.style.opacity = open > 0 ? '1' : '0';
      }

      if (!swapped && open >= 1) {
        swapped = true;
        midpoint.current();
        root.current?.classList.add('is-leaving');
        leave = window.setTimeout(() => done.current(), 620);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(leave);
    };
  }, [reducedMotion, stages, last]);

  return (
    <div ref={root} className={`entrance${reducedMotion ? ' is-reduced' : ''}`} aria-hidden="true">
      {!reducedMotion
        ? stages.map((stage, i) => (
            <div
              key={stage.src}
              ref={(el) => {
                stageRefs.current[i] = el;
              }}
              className="entrance-stage"
              style={{
                backgroundImage: `url("${stage.src}")`,
                transformOrigin: `${stage.focus.x * 100}% ${stage.focus.y * 100}%`,
                backgroundPosition: `${stage.focus.x * 100}% ${stage.focus.y * 100}%`,
              }}
            />
          ))
        : null}
      <div className="entrance-grade" />
      {!reducedMotion ? (
        <div
          className="entrance-shards"
          ref={shards}
          style={{ transformOrigin: `${last.focus.x * 100}% ${last.focus.y * 100}%` }}
        >
          <PrismShards seed={29} reflection={false} />
        </div>
      ) : null}
      <div className="entrance-aperture" ref={aperture} />
    </div>
  );
}
