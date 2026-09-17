import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { detectWebGL, useHashRoute, useReducedMotion } from './lib/hooks';
import { useLang } from './lib/lang';
import { EntryGate } from './ui/EntryGate';
import { ExhibitReader } from './ui/ExhibitReader';
import { FlatView } from './ui/FlatView';
import { AmbientVeil } from './ui/fx/AmbientVeil';
import { Entrance } from './ui/fx/Entrance';
import { Hall } from './ui/Hall';
import { HelpPanel } from './ui/HelpPanel';
import { TopBar } from './ui/Hud';
import { ImmersiveWalk } from './ui/ImmersiveWalk';
import { RoomView } from './ui/RoomView';

const ENTERED_KEY = 'port.entered';

function alreadyEntered(): boolean {
  try {
    return window.sessionStorage.getItem(ENTERED_KEY) === '1';
  } catch {
    return false;
  }
}

export default function App() {
  const reducedMotion = useReducedMotion();
  const webgl = useMemo(() => detectWebGL(), []);
  const { route, navigate } = useHashRoute();
  const { stations, t } = useLang();

  /**
   * The gate greets a first visit. A shared link to a room, or a reload after coming in,
   * goes straight to what was asked for.
   */
  const [entered, setEntered] = useState(() => route.kind !== 'hub' || alreadyEntered());
  const [entering, setEntering] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const markEntered = useCallback(() => {
    setEntered(true);
    try {
      window.sessionStorage.setItem(ENTERED_KEY, '1');
    } catch {
      /* the gate simply shows again next time */
    }
  }, []);

  const station =
    route.kind === 'station' || route.kind === 'exhibit' || route.kind === 'walk'
      ? stations.find((s) => s.id === route.stationId)
      : undefined;

  // An address naming a room or a work that does not exist lands somewhere real instead.
  useEffect(() => {
    if ((route.kind === 'station' || route.kind === 'exhibit' || route.kind === 'walk') && !station) {
      navigate({ kind: 'hub' }, true);
    } else if (route.kind === 'exhibit' && station && route.index >= station.exhibits.length) {
      navigate({ kind: 'station', stationId: station.id }, true);
    } else if (route.kind === 'walk' && station && (!webgl || station.kind !== 'corridor')) {
      navigate({ kind: 'station', stationId: station.id }, true);
    }
  }, [route, station, navigate, webgl]);

  /* ---------------------------------------------------------------- scroll memory */

  // The hall remembers how far down the corridor the visitor had walked; a room always opens
  // at its door. Opening or closing a work over a room leaves the room where it was.
  const hallScroll = useRef(0);
  const pageKey =
    route.kind === 'hub' ? 'hall' : route.kind === 'flat' ? 'flat' : route.kind === 'walk' ? `walk:${route.stationId}` : `room:${route.stationId}`;
  const lastPage = useRef(pageKey);

  useEffect(() => {
    if (route.kind !== 'hub') return;
    const onScroll = () => {
      hallScroll.current = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [route.kind]);

  useLayoutEffect(() => {
    if (lastPage.current === pageKey) return;
    lastPage.current = pageKey;
    if (pageKey === 'hall') {
      const y = hallScroll.current;
      // the corridor's height is laid out a frame after it mounts
      requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'auto' }));
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [pageKey]);

  /* ---------------------------------------------------------------- keyboard */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (route.kind === 'walk') return; // the walk owns its keys
      if (event.key === 'Escape') {
        if (helpOpen) setHelpOpen(false);
        else if (route.kind === 'exhibit') navigate({ kind: 'station', stationId: route.stationId });
        return;
      }
      if (route.kind === 'exhibit' && station && !helpOpen) {
        const last = station.exhibits.length - 1;
        if (event.key === 'ArrowRight' && route.index < last) {
          navigate({ kind: 'exhibit', stationId: station.id, index: route.index + 1 }, true);
        } else if (event.key === 'ArrowLeft' && route.index > 0) {
          navigate({ kind: 'exhibit', stationId: station.id, index: route.index - 1 }, true);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [route, station, navigate, helpOpen]);

  /* ---------------------------------------------------------------- render */

  const help = helpOpen ? <HelpPanel onClose={() => setHelpOpen(false)} reducedMotion={reducedMotion} /> : null;
  const entrance = entering ? (
    <Entrance key="entrance" reducedMotion={reducedMotion} onMidpoint={markEntered} onDone={() => setEntering(false)} />
  ) : null;

  if (!entered) {
    return (
      <>
        <EntryGate
          reducedMotion={reducedMotion}
          onEnter={() => setEntering(true)}
          onFlat={() => {
            markEntered();
            navigate({ kind: 'flat' });
          }}
        />
        {entrance}
      </>
    );
  }

  if (route.kind === 'walk' && station) {
    return (
      <>
        <ImmersiveWalk
          station={station}
          reducedMotion={reducedMotion}
          onExit={() => navigate({ kind: 'station', stationId: station.id })}
        />
        {help}
      </>
    );
  }

  const exhibitIndex = route.kind === 'exhibit' ? route.index : -1;
  const crumbWork = station && exhibitIndex >= 0 ? station.exhibits[exhibitIndex] : undefined;

  return (
    <>
      <a className="skip-link" href="#content">
        {t('skipToContent')}
      </a>
      <TopBar
        pageKey={pageKey}
        flat={route.kind === 'flat'}
        onToggleFlat={() => navigate(route.kind === 'flat' ? { kind: 'hub' } : { kind: 'flat' })}
        onHelp={() => setHelpOpen(true)}
        crumb={
          station ? (
            <>
              <a href={`#/s/${station.id}`}>{station.label}</a>
              {crumbWork ? (
                <>
                  <span aria-hidden="true">/</span>
                  <b>{crumbWork.title}</b>
                </>
              ) : null}
            </>
          ) : null
        }
      />
      <main id="content">
        {route.kind === 'flat' ? (
          <FlatView />
        ) : station ? (
          <RoomView
            station={station}
            shelf={route.kind === 'station' ? route.shelf : undefined}
            reducedMotion={reducedMotion}
            webgl={webgl}
          />
        ) : (
          <Hall reducedMotion={reducedMotion} />
        )}
      </main>
      {station && exhibitIndex >= 0 && crumbWork ? (
        <ExhibitReader
          station={station}
          index={exhibitIndex}
          onClose={() => navigate({ kind: 'station', stationId: station.id })}
          onPrev={() => navigate({ kind: 'exhibit', stationId: station.id, index: Math.max(0, exhibitIndex - 1) }, true)}
          onNext={() =>
            navigate(
              { kind: 'exhibit', stationId: station.id, index: Math.min(station.exhibits.length - 1, exhibitIndex + 1) },
              true,
            )
          }
        />
      ) : null}
      {help}
      {entrance}
      {/* remounts on every route change, so the light replays as the room changes */}
      {reducedMotion ? null : <AmbientVeil key={pageKey} />}
    </>
  );
}
