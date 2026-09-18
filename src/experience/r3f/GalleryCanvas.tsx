import { Canvas } from '@react-three/fiber';
import { Suspense, useState, useEffect, useMemo } from 'react';
import {
  EffectComposer,
  Bloom,
  Noise,
  ChromaticAberration,
} from '@react-three/postprocessing';
import { BlendFunction, RenderPass } from 'postprocessing';
import * as THREE from 'three';
import { Deck } from './Deck';
import { Corridor } from './Corridor';
import { Court } from './Court';
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
  /** The deck's ring turned: which room is brought forward, not which one is entered. */
  onStationFocus?: (stationId: string) => void;
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
  onStationFocus,
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

  const leaveStation = () => {
    setCurrentStation(null);
    setPhase('hub');
    onExit?.();
  };

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
              onStationFocus={onStationFocus}
              onStationSelect={onStationSelect}
            />
          </>
        )}

        {currentStation &&
          (currentStation.wing === 'court' ? (
            <Court
              station={currentStation}
              reducedMotion={reducedMotion}
              onExhibitSelect={onExhibitSelect}
              onExhibitFocus={onExhibitFocus}
              onExit={leaveStation}
            />
          ) : (
            <Corridor
              station={currentStation}
              reducedMotion={reducedMotion}
              onExhibitSelect={onExhibitSelect}
              onExhibitFocus={onExhibitFocus}
              onExit={leaveStation}
            />
          ))}

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

/**
 * The gallery's glass.
 *
 * This is a bright room — white walls lit to the top of their range — and the stack has to be
 * built for that. A scanline pass was SCREEN-blending a fine stripe pattern over the whole
 * frame and a chromatic pass was then shifting it by a pixel, which fringed every stripe
 * magenta on one edge and green on the other: a dead CRT laid over a lit gallery, and the
 * brightest thing on screen. The room stays clean now; what remains is the glow the light
 * paintings earn and a breath of grain.
 */
function PostProcessing({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) return null;

  return (
    <EffectComposer
      multisampling={8}
      enableNormalPass={false}
      renderPass={(scene: THREE.Scene, camera: THREE.Camera) => new RenderPass(scene, camera)}
    >
      {/* Only genuinely hot pixels bloom — the cores of the light, not the walls. */}
      <Bloom
        blendFunction={BlendFunction.ADD}
        luminanceThreshold={0.95}
        luminanceSmoothing={0.3}
        intensity={0.85}
        radius={0.55}
        mipmapBlur
      />
      <Noise blendFunction={BlendFunction.SCREEN} opacity={0.025} />
      {/* Enough to feel like glass, not enough to see a colour split. */}
      <ChromaticAberration
        offset={new THREE.Vector2(0.0002, 0.0001)}
        radialModulation={false}
        modulationOffset={0}
      />
    </EffectComposer>
  );
}