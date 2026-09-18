import { Canvas } from '@react-three/fiber';
import { Suspense, useState, useEffect, useMemo } from 'react';
import {
  EffectComposer,
  Bloom,
  Scanline,
  Noise,
  ChromaticAberration,
} from '@react-three/postprocessing';
import { BlendFunction, RenderPass } from 'postprocessing';
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
  onStationSelect?: (stationId: string) => void;
  onExhibitSelect?: (index: number) => void;
  onExhibitFocus?: (index: number) => void;
  onReady?: () => void;
  onExit?: () => void;
  corridorOnly?: boolean;
};

const initialCameraPosition: [number, number, number] = [0, 1.72, 66];

export function GalleryCanvas({
  stations,
  reducedMotion,
  onPhaseChange,
  onStationSelect,
  onExhibitSelect,
  onExhibitFocus,
  onReady,
  onExit,
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
      onCreated={({ gl }) => {
        setIsReady(true);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.setClearColor(0xf7f7f4, 1);
      }}
    >
      {/* A DOM fallback cannot render inside the canvas — the reconciler only accepts
          THREE objects. Async children simply pop in; the clear color covers the gap. */}
      <Suspense fallback={null}>
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
              onExit?.();
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

function PostProcessing({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) return null;

  return (
    <EffectComposer
      multisampling={8}
      enableNormalPass={false}
      renderPass={(scene: THREE.Scene, camera: THREE.Camera) => new RenderPass(scene, camera)}
    >
      <Bloom
        blendFunction={BlendFunction.ADD}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.4}
        radius={0.6}
        mipmapBlur
      />
      <Scanline blendFunction={BlendFunction.SCREEN} density={0.4} />
      <Noise blendFunction={BlendFunction.SCREEN} opacity={0.08} />
      <ChromaticAberration
        offset={new THREE.Vector2(0.0008, 0.0004)}
        radialModulation={false}
        modulationOffset={0}
      />
    </EffectComposer>
  );
}