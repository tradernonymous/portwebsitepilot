import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { EffectComposer, RenderPass, UnrealBloomPass, FilmPass, ChromaticAberrationPass } from '@react-three/postprocessing';
import { Suspense, useRef, useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Deck } from './Deck';
import { Corridor } from './Corridor';
import { Entry } from './Entry';
import { LightPaintings } from './LightPaintings';
import { GalleryCamera } from './GalleryCamera';
import { useGalleryStore } from './galleryStore';
import type { Station } from '../../content';

type Phase = 'entry' | 'hub' | 'warp' | 'corridor';

type GalleryCanvasProps = {
  stations: Station[];
  reducedMotion: boolean;
  onPhaseChange?: (phase: Phase) => void;
  onEntryProgress?: (progress: number) => void;
  onStationSelect?: (stationId: string) => void;
  onExhibitSelect?: (index: number) => void;
  onExhibitFocus?: (index: number) => void;
  onReady?: () => void;
  corridorOnly?: boolean;
};

const initialCameraPosition = { x: 0, y: 1.72, z: 66 };

export function GalleryCanvas({
  stations,
  reducedMotion,
  onPhaseChange,
  onEntryProgress,
  onStationSelect,
  onExhibitSelect,
  onExhibitFocus,
  onReady,
  corridorOnly,
}: GalleryCanvasProps) {
  const { setPhase, setCurrentStation, phase, currentStation } = useGalleryStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (isReady) {
      onReady?.();
    }
  }, [isReady, onReady]);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  const gl = useMemo(() => ({
    antialias: !reducedMotion,
    alpha: false,
    powerPreference: 'high-performance' as const,
    stencil: false,
    depth: true,
    logarithmicDepthBuffer: true,
  }), [reducedMotion]);

  return (
    <Canvas
      gl={gl}
      camera={{ position: initialCameraPosition, fov: 62, near: 0.1, far: 400 }}
      shadows={false}
      dpr={[1, 1.75]}
      onCreated={() => setIsReady(true)}
      onCreated2={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.setClearColor(0xf7f7f4, 1);
      }}
    >
      <Suspense fallback={<LoadingFallback />}>
        <color attach="background" args={[0xf7f7f4]} />
        <fog attach="fog" args={[0xf7f7f4, 0.0045, 200]} />

        <ambientLight intensity={1.15} />
        <directionalLight position={[6, 12, 8]} intensity={1.25} />
        <pointLight position={[0, 7, 0]} intensity={10} distance={60} decay={2} />

        <GalleryCamera reducedMotion={reducedMotion} />

        {!corridorOnly && (
          <>
            <Entry
              reducedMotion={reducedMotion}
              onMidpoint={() => setPhase('hub')}
              onDone={() => {}}
            />
            <Deck
              stations={stations}
              reducedMotion={reducedMotion}
              onStationSelect={onStationSelect}
            />
          </>
        )}

        {currentStation && (
          <Corridor
            station={currentStation}
            reducedMotion={reducedMotion}
            onExhibitSelect={onExhibitSelect}
            onExhibitFocus={onExhibitFocus}
            onExit={() => {
              setCurrentStation(null);
              setPhase('hub');
            }}
          />
        )}

        <LightPaintings
          tone="dark"
          count={reducedMotion ? 3 : 5}
          reducedMotion={reducedMotion}
        />
      </Suspense>

      <PostProcessing reducedMotion={reducedMotion} />
    </Canvas>
  );
}

function LoadingFallback() {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'grid', placeItems: 'center',
      background: '#050507', color: '#f7f7fb', zIndex: 100,
      fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem',
      letterSpacing: '0.14em', textTransform: 'uppercase'
    }}>
      Preparing 3D space...
    </div>
  );
}

function PostProcessing({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) return null;

  return (
    <EffectComposer multisampling={8} disableNormalPass>
      <RenderPass />
      <UnrealBloomPass
        strength={0.35}
        radius={0.6}
        threshold={0.85}
        resolutionScale={1}
      />
      <FilmPass
        noiseIntensity={0.08}
        scanlineIntensity={0.02}
        grayscale={false}
      />
      <ChromaticAberrationPass
        offset={[0.0008, 0.0004]}
        radialModification={0}
        modulationOffset={0}
      />
    </EffectComposer>
  );
}