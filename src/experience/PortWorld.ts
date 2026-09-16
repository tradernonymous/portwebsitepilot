/**
 * The PORT space.
 *
 * A small state machine over three hand-built three.js scenes:
 *
 *   entry     POV flythrough — you approach and pass through the PORT gate.
 *   hub       The space itself: a circular deck ringed with station monoliths.
 *   corridor  A gallery wing — real PORT photographs hung on the walls, walkable.
 *
 * Everything is procedural (no model files, no API keys). Photography comes from
 * `public/media`, produced by `npm run sync:content`.
 */

import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import boldTypeface from 'three/examples/fonts/helvetiker_bold.typeface.json';
import type { GalleryImage, Station } from '../content';
import { artPool, deckCovers, entranceImage } from '../content';
import { glyphDataUrl } from '../content/glyphs';

export type Phase = 'entry' | 'hub' | 'warp' | 'corridor';

export type WorldOptions = {
  stations: Station[];
  reducedMotion?: boolean;
  onPhase?: (phase: Phase) => void;
  /** 0..1 progress through the entry flythrough. */
  onEntryProgress?: (progress: number) => void;
  /** Which monolith the pointer is over, or null. */
  onHover?: (stationId: string | null) => void;
  onStationSelect?: (stationId: string) => void;
  /** An exhibit frame was clicked inside the corridor. */
  onExhibitSelect?: (index: number) => void;
  /** Which exhibit the camera is nearest, as you walk. */
  onExhibitFocus?: (index: number) => void;
  onReady?: () => void;
};

type Monolith = {
  station: Station;
  group: THREE.Group;
  body: THREE.Mesh;
  ring: THREE.Mesh;
  /** The work hung on this station's face, and the light and gold leaf that frame it. */
  art?: THREE.Mesh;
  haloMaterial?: THREE.MeshBasicMaterial;
  edgeMaterial?: THREE.LineBasicMaterial;
  /** Rises to 1 while the station is hovered, so the wall answers the pointer. */
  hot: number;
};

/**
 * The floating name plate for a station: extruded 3D lettering that turns to face the
 * visitor. This is the deck's wayfinding — from anywhere on the deck you can read where
 * each station is without hunting for it.
 */
type DeckLabel = {
  station: Station;
  group: THREE.Group;
  name: THREE.Mesh;
  nameMaterial: THREE.MeshStandardMaterial;
  nameBase: THREE.Color;
  nameHot: THREE.Color;
  glyph: THREE.Mesh;
  glyphMaterial: THREE.MeshBasicMaterial;
  baseY: number;
  hot: number;
  phase: number;
};

type FrameRef = {
  index: number;
  group: THREE.Group;
  plate: THREE.Mesh;
  side: number;
  z: number;
};

const ACCENT_DIM = '#141210';
const HUB_CAMERA = new THREE.Vector3(0, 1.72, 0);
const HUB_RADIUS = 8.1;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ------------------------------------------------------------------ texture helpers */

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function labelTexture(
  text: string,
  opts: { colour?: string; size?: number; weight?: string; spacing?: number } = {},
) {
  const { colour = '#f2ede2', size = 96, weight = '600', spacing = 6 } = opts;
  const font = `${weight} ${size}px "Chakra Petch", ui-sans-serif, system-ui, sans-serif`;
  const measure = document.createElement('canvas').getContext('2d');
  let width = 1024;
  if (measure) {
    measure.font = font;
    const perChar = spacing;
    width = Math.ceil(
      measure.measureText(text).width + perChar * text.length + size,
    );
  }
  return canvasTexture(Math.max(256, Math.min(4096, width)), Math.ceil(size * 2.2), (ctx) => {
    const { width: w, height: h } = ctx.canvas;
    ctx.clearRect(0, 0, w, h);
    ctx.font = font;
    ctx.fillStyle = colour;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = colour;
    ctx.shadowBlur = size * 0.35;
    if (spacing) {
      const glyphs = [...text];
      const widths = glyphs.map((g) => ctx.measureText(g).width + spacing);
      const total = widths.reduce((a, b) => a + b, 0) - spacing;
      let x = (w - total) / 2;
      for (let i = 0; i < glyphs.length; i++) {
        ctx.fillText(glyphs[i], x + widths[i] / 2 - spacing / 2, h / 2);
        x += widths[i];
      }
    } else {
      ctx.fillText(text, w / 2, h / 2);
    }
  });
}

/** Soft round sprite, used for particles and the floor glow. */
function dotTexture() {
  return canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(190,235,255,0.55)');
    g.addColorStop(1, 'rgba(120,190,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}

function radialGlowTexture(inner: string, outer: string) {
  return canvasTexture(512, 512, (ctx) => {
    const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    g.addColorStop(0, inner);
    g.addColorStop(0.45, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
  });
}

/**
 * Greyscale radial falloff used as an alphaMap, so a photograph dissolves into the
 * surrounding dark instead of ending on a hard rectangular edge.
 */
function radialFadeTexture() {
  const tex = canvasTexture(768, 768, (ctx) => {
    const g = ctx.createRadialGradient(384, 384, 0, 384, 384, 384);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.42, '#e8e8e8');
    g.addColorStop(0.72, '#4a4a4a');
    g.addColorStop(1, '#000000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 768, 768);
  });
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/** Soft vertical gradient, used to fade the floor reflection out downwards. */
function verticalFadeTexture() {
  const tex = canvasTexture(8, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, '#3a3a3a');
    g.addColorStop(1, '#000000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 256);
  });
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ world */

type DisplayFont = ReturnType<FontLoader['parse']>;

/**
 * The display face for the deck lettering, taken from the typeface three.js ships so the
 * space needs no extra font asset. Parsed synchronously, and the space degrades to flat
 * canvas labels if it ever fails.
 */
function loadDisplayFont() {
  try {
    return new FontLoader().parse(
      boldTypeface as unknown as Parameters<FontLoader['parse']>[0],
    );
  } catch {
    return null;
  }
}

export class PortWorld {
  private readonly canvas: HTMLCanvasElement;
  private readonly opts: WorldOptions;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly rig = new THREE.Object3D();
  private readonly yaw = new THREE.Object3D();
  private readonly pitch = new THREE.Object3D();
  private readonly clock = new THREE.Clock();
  private readonly ray = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly loader = new THREE.TextureLoader();
  private readonly textureCache = new Map<string, THREE.Texture>();

  private readonly entryGroup = new THREE.Group();
  private readonly hubGroup = new THREE.Group();
  private readonly corridorGroup = new THREE.Group();

  private monoliths: Monolith[] = [];
  private deckLabels: DeckLabel[] = [];
  /**
   * Covers hung on the deck keep their own textures rather than joining `textureCache`:
   * leaving a wing releases every photograph in that cache, and the deck is still standing.
   */
  private deckCoverTextures: THREE.Texture[] = [];
  private font: DisplayFont | null = null;
  private frames: FrameRef[] = [];
  private starField?: THREE.Points;
  private entryGate = new THREE.Group();
  private gateLogo?: THREE.Mesh;
  private hubLogo?: THREE.Mesh;
  private hoverRing?: THREE.Mesh;
  private corridorDoor?: THREE.Mesh;
  /** Photographic frontage planes in the approach, faded in as the visitor arrives. */
  private frontPanels: { mesh: THREE.Mesh; baseOpacity: number }[] = [];
  private farBackdrop?: THREE.Mesh;
  private frontageHeight = 11.5;

  private phase: Phase = 'entry';
  private reduced: boolean;
  private raf = 0;
  private mounted = false;
  private dragging = false;
  private moved = 0;
  private pointer = { x: 0, y: 0 };
  private look = { yaw: 0, pitch: 0, ty: 0, tp: 0 };
  private hovered: string | null = null;
  private entryT = 0;
  /** The flythrough holds until the visitor actually asks to walk in. */
  private entryArmed = false;
  private entryDuration = 8.5;
  private warpT = 0;
  /** Where the visitor wants to be along the corridor, and where they actually are. */
  private corridorTarget = 0;
  private corridorLength = 0;
  private corridorWalk = 0;
  private currentStation: Station | null = null;
  private focusedExhibit = -1;
  private glowTexture: THREE.Texture;
  private particleTexture: THREE.Texture;
  private disposed = false;
  /** Textures for the works hung in the approach — owned by the entry scene, not the corridor. */
  private entryArtTextures: THREE.Texture[] = [];

  /* the ambient constellation */
  private readonly constellation = new THREE.Group();
  private nodeBase: THREE.Vector3[] = [];
  private nodePos: THREE.Vector3[] = [];
  private nodeVel: THREE.Vector3[] = [];
  private nodeAttributes?: THREE.BufferAttribute;
  private linkAttributes?: THREE.BufferAttribute;
  private linkColors?: THREE.BufferAttribute;
  private linkGeometry?: THREE.BufferGeometry;
  private maxLinks = 0;
  private lastLinkCount = 0;
  private hasPointer = false;
  private readonly cursorWorld = new THREE.Vector3();
  private readonly cursorLocal = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, opts: WorldOptions) {
    this.canvas = canvas;
    this.opts = opts;
    this.reduced = opts.reducedMotion ?? false;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !this.reduced,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
    this.camera.position.set(0, 0, 0);

    this.rig.add(this.yaw);
    this.yaw.add(this.pitch);
    this.pitch.add(this.camera);
    this.scene.add(this.rig);

    this.glowTexture = radialGlowTexture('rgba(240,228,205,0.5)', 'rgba(130,110,82,0.12)');
    this.particleTexture = dotTexture();

    this.scene.fog = new THREE.FogExp2(0x000000, 0.017);

    this.font = loadDisplayFont();

    this.scene.add(this.entryGroup, this.hubGroup, this.corridorGroup);
    this.buildEnvironment();
    this.buildConstellation();
    this.buildEntry();
    this.buildHub(opts.stations);
    // Applied silently: the entry gate is still on screen at this point, so the
    // world must not tell React it has arrived anywhere yet.
    this.applyPhase(this.reduced ? 'hub' : 'entry');

    if (this.reduced) {
      this.rig.position.copy(HUB_CAMERA);
    } else {
      // Park the camera at the far mouth of the approach tunnel while the visitor
      // decides to walk in, so the gate overlay sits over the actual approach.
      this.rig.position.set(0, 0.1, 66);
    }
  }

  /* ---------------------------------------------------------------- lifecycle */

  mount() {
    if (this.mounted) return;
    this.mounted = true;
    this.resize();
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: true });
    this.opts.onReady?.();
    this.loop();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.clearCorridor();
    this.disposeTextures(this.entryArtTextures);
    this.entryArtTextures = [];
    this.disposeTextures(this.deckCoverTextures);
    this.deckCoverTextures = [];
    this.constellation.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
    for (const tex of this.textureCache.values()) tex.dispose();
    this.textureCache.clear();
    this.glowTexture.dispose();
    this.particleTexture.dispose();
    this.renderer.dispose();
  }

  /**
   * Let go of a list of textures.
   *
   * Written to tolerate the list being absent: a hot reload can tear down an instance that
   * was constructed before the field existed, and a throw in here aborts the rest of
   * teardown and surfaces as a React error rather than as a dev-server hiccup.
   */
  private disposeTextures(list: THREE.Texture[] | undefined) {
    for (const texture of list ?? []) texture.dispose();
  }

  setReducedMotion(reduced: boolean) {
    this.reduced = reduced;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, reduced ? 1.25 : 1.75));
    if (reduced) {
      this.look.ty = this.look.yaw;
      this.look.tp = this.look.pitch;
    }
  }

  private onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else if (this.mounted && !this.raf && !this.disposed) {
      this.clock.getDelta();
      this.loop();
    }
  };

  private resize = () => {
    const parent = this.canvas.parentElement;
    const w = parent?.clientWidth || window.innerWidth;
    const h = parent?.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  };

  /* ---------------------------------------------------------------- scenes */

  private buildEnvironment() {
    // gradient backdrop
    const bg = canvasTexture(32, 512, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, '#000000');
      g.addColorStop(0.5, '#050505');
      g.addColorStop(1, '#000000');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 32, 512);
    });
    this.scene.background = bg;

    // Restrained gallery lighting: enough to give the lettering and frames an edge,
    // never enough to lift the black off zero.
    this.scene.add(new THREE.AmbientLight(0x5a5348, 0.5));
    const key = new THREE.DirectionalLight(0xf0e8d8, 0.7);
    key.position.set(6, 12, 8);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x8a7355, 18, 60, 2);
    rim.position.set(0, 7, 0);
    this.scene.add(rim);

    // starfield
    const count = this.reduced ? 500 : 1400;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 60 + Math.random() * 120;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.6;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      sizes[i] = 0.5 + Math.random() * 1.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    const stars = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        map: this.particleTexture,
        size: 0.85,
        transparent: true,
        depthWrite: false,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        color: 0xe6dfd2,
      }),
    );
    this.starField = stars;
    this.scene.add(stars);
  }

  /**
   * The ambient field: a constellation of nodes that drift, link to whichever neighbours
   * come close, and lean toward the pointer. Hairlines only appear where nodes meet, so
   * the black stays black and the field reads as depth rather than decoration.
   */
  private buildConstellation() {
    const count = this.reduced ? 44 : 116;
    const spread = 54;

    for (let i = 0; i < count; i++) {
      const base = new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(spread),
        THREE.MathUtils.randFloatSpread(20),
        THREE.MathUtils.randFloatSpread(spread),
      );
      // keep the middle of the deck clear so the stations stay unobstructed
      if (base.length() < 11) base.setLength(11 + Math.random() * 7);
      this.nodeBase.push(base.clone());
      this.nodePos.push(base.clone());
      this.nodeVel.push(
        new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(0.05),
          THREE.MathUtils.randFloatSpread(0.04),
          THREE.MathUtils.randFloatSpread(0.05),
        ),
      );
    }

    const nodeGeo = new THREE.BufferGeometry();
    this.nodeAttributes = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    nodeGeo.setAttribute('position', this.nodeAttributes);
    this.constellation.add(
      new THREE.Points(
        nodeGeo,
        new THREE.PointsMaterial({
          map: this.particleTexture,
          size: 0.42,
          transparent: true,
          opacity: 0.7,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          color: 0xd9c9a4,
        }),
      ),
    );

    this.maxLinks = count * 5;
    this.linkAttributes = new THREE.BufferAttribute(new Float32Array(this.maxLinks * 6), 3);
    this.linkColors = new THREE.BufferAttribute(new Float32Array(this.maxLinks * 6), 3);
    this.linkGeometry = new THREE.BufferGeometry();
    this.linkGeometry.setAttribute('position', this.linkAttributes);
    this.linkGeometry.setAttribute('color', this.linkColors);
    this.linkGeometry.setDrawRange(0, 0);
    this.constellation.add(
      new THREE.LineSegments(
        this.linkGeometry,
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );

    this.scene.add(this.constellation);
  }

  /**
   * Advance the field. The whole constellation rides with the visitor, so it works in the
   * approach, on the deck and inside a gallery wing without any special casing.
   */
  private updateConstellation(delta: number) {
    const nodes = this.nodePos;
    const total = nodes.length;
    if (!total || !this.nodeAttributes || !this.linkAttributes || !this.linkColors || !this.linkGeometry) {
      return;
    }

    this.constellation.position.copy(this.rig.position);

    // The pointer becomes a point out in the field; nodes near it are drawn toward it and
    // their links brighten, which is what makes the background feel alive under the cursor.
    let reaching = false;
    if (this.hasPointer) {
      this.ray.setFromCamera(this.ndc.set(this.pointer.x, this.pointer.y), this.camera);
      this.ray.ray.at(16, this.cursorWorld);
      this.cursorLocal.copy(this.cursorWorld).sub(this.constellation.position);
      reaching = true;
    }

    const positions = this.nodeAttributes.array as Float32Array;
    const pull = Math.min(1, delta * 0.9);
    for (let i = 0; i < total; i++) {
      const node = nodes[i];
      const base = this.nodeBase[i];
      const velocity = this.nodeVel[i];

      node.addScaledVector(velocity, delta * 6);
      node.lerp(base, Math.min(1, delta * 0.5));

      if (reaching) {
        const distance = node.distanceTo(this.cursorLocal);
        if (distance < 11) {
          node.lerp(this.cursorLocal, (1 - distance / 11) * pull * 0.5);
        }
      }

      positions[i * 3] = node.x;
      positions[i * 3 + 1] = node.y;
      positions[i * 3 + 2] = node.z;
    }
    this.nodeAttributes.needsUpdate = true;

    const linkDistance = 6.4;
    const points = this.linkAttributes.array as Float32Array;
    const colours = this.linkColors.array as Float32Array;
    let vertex = 0;
    let links = 0;

    for (let i = 0; i < total && links < this.maxLinks; i++) {
      const a = nodes[i];
      const aNear = reaching ? a.distanceTo(this.cursorLocal) : Infinity;
      for (let j = i + 1; j < total && links < this.maxLinks; j++) {
        const b = nodes[j];
        const distance = a.distanceTo(b);
        if (distance > linkDistance) continue;

        const proximity = 1 - distance / linkDistance;
        let strength = proximity * 0.45;
        if (reaching) {
          const near = Math.min(aNear, b.distanceTo(this.cursorLocal));
          if (near < 13) strength += (1 - near / 13) * 0.55;
        }

        points[vertex * 3] = a.x;
        points[vertex * 3 + 1] = a.y;
        points[vertex * 3 + 2] = a.z;
        points[(vertex + 1) * 3] = b.x;
        points[(vertex + 1) * 3 + 1] = b.y;
        points[(vertex + 1) * 3 + 2] = b.z;

        // dim gold where nodes only just reach each other, chrome-white where the pointer
        // is pulling them together
        for (let end = 0; end < 2; end++) {
          const at = (vertex + end) * 3;
          colours[at] = 0.4 + strength * 0.58;
          colours[at + 1] = 0.34 + strength * 0.62;
          colours[at + 2] = 0.24 + strength * 0.72;
        }

        vertex += 2;
        links++;
      }
    }

    this.linkAttributes.needsUpdate = true;
    this.linkColors.needsUpdate = true;
    this.linkGeometry.setDrawRange(0, vertex);
    this.lastLinkCount = links;
  }

  /**
   * The approach: a gallery you walk up to, not a tunnel you fly down.
   *
   * Black on black, with two gold hairlines converging on the door and works hung either
   * side, so the eye settles on art and then on the entrance rather than on glowing rings.
   */
  private buildEntry() {
    const group = this.entryGroup;
    const railZ = 78;
    const railEnd = -16;

    for (const rail of [
      { y: -1.7, opacity: 0.3 },
      { y: 5.6, opacity: 0.2 },
    ]) {
      const positions: number[] = [];
      const segments = 64;
      const spread = (z: number) => Math.max(1.9, 1.9 + (z - railEnd) * 0.052);
      for (let s = 0; s < segments; s++) {
        const z0 = railZ - (s / segments) * (railZ - railEnd);
        const z1 = railZ - ((s + 1) / segments) * (railZ - railEnd);
        const x0 = spread(z0);
        const x1 = spread(z1);
        positions.push(-x0, rail.y, z0, -x1, rail.y, z1, x0, rail.y, z0, x1, rail.y, z1);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      group.add(
        new THREE.LineSegments(
          geometry,
          new THREE.LineBasicMaterial({
            color: 0xd9b978,
            transparent: true,
            opacity: rail.opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        ),
      );
    }

    this.hangApproachWorks();

    // the gate at the end of the approach
    const gateGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshBasicMaterial({
        map: radialGlowTexture('rgba(255,246,228,0.82)', 'rgba(150,120,80,0.16)'),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    gateGlow.position.z = -0.4;
    this.entryGate.add(gateGlow);

    const portal = new THREE.Mesh(
      new THREE.TorusGeometry(4.2, 0.085, 12, 96),
      new THREE.MeshBasicMaterial({
        color: 0xe8dcc0,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
      }),
    );
    portal.position.z = 0;
    this.entryGate.add(portal);

    // A gold arch around the doorway with a faint chrome lip behind it — a frame, not a halo.
    for (const arch of [
      { radius: 4.6, colour: 0xd9b978, opacity: 0.5, z: -0.1 },
      { radius: 5.7, colour: 0xc3c9d4, opacity: 0.16, z: -0.6 },
    ]) {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(arch.radius, 0.032, 8, 96),
        new THREE.MeshBasicMaterial({
          color: arch.colour,
          transparent: true,
          opacity: arch.opacity,
          blending: THREE.AdditiveBlending,
        }),
      );
      halo.position.z = arch.z;
      this.entryGate.add(halo);
    }

    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 2.25),
      new THREE.MeshBasicMaterial({
        map: labelTexture('PORT', { colour: '#f7f2e8', size: 220, spacing: 40 }),
        transparent: true,
        opacity: 0.95,
      }),
    );
    logo.position.set(0, -0.1, 0.6);
    this.gateLogo = logo;
    this.entryGate.add(logo);

    const sub = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 0.9),
      new THREE.MeshBasicMaterial({
        map: labelTexture('PEOPLE OF REMARKABLE TALENTS', {
          colour: '#e9dcc2',
          size: 54,
          weight: '400',
          spacing: 12,
        }),
        transparent: true,
        opacity: 0.75,
      }),
    );
    sub.position.set(0, -1.5, 0.6);
    this.entryGate.add(sub);

    this.entryGate.position.z = 0;
    group.add(this.entryGate);

    this.buildFrontage();
  }

  /**
   * Works hung along the approach, angled toward the visitor as they walk up: black walls,
   * a gold leaf edge, and just enough light for the image to read.
   */
  private hangApproachWorks() {
    const pool = artPool;
    if (!pool.length) return;
    const perSide = Math.min(6, Math.max(2, Math.floor(pool.length / 2)));

    for (let i = 0; i < perSide * 2; i++) {
      const image = pool[i % pool.length];
      const side = i % 2 === 0 ? -1 : 1;
      const rank = Math.floor(i / 2);
      const ratio = image.height && image.width ? image.height / image.width : 1.2;
      const height = clamp(1.85 * ratio, 1.5, 2.9);
      const width = clamp(height * 0.78, 1.2, 2.1);

      const piece = new THREE.Group();
      piece.position.set(side * 7.4, 2.35, 34 - rank * 9 - (side === 1 ? 4 : 0));
      piece.rotation.y = side * -0.5;

      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.16, height + 0.16, 0.07),
        new THREE.MeshStandardMaterial({ color: 0x0b0a09, metalness: 0.8, roughness: 0.35 }),
      );
      piece.add(frame);

      const leaf = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(width + 0.2, height + 0.2, 0.1)),
        new THREE.LineBasicMaterial({ color: 0xd9b978, transparent: true, opacity: 0.8 }),
      );
      piece.add(leaf);

      const texture = this.loader.load(image.small, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
      });
      this.entryArtTextures.push(texture);

      const art = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({ map: texture, color: 0xefe8db, side: THREE.DoubleSide }),
      );
      art.position.z = 0.05;
      piece.add(art);

      this.entryGroup.add(piece);
    }
  }

  /**
   * The approach resolves onto the PORT front: a doorway in shadow with light spilling out,
   * the building photographed behind it, and a mirrored catch on the floor.
   *
   * The photograph is masked so it dissolves into the dark on every edge, which is what
   * lets any real photo of the frontage sit convincingly in this space.
   */
  private buildFrontage() {
    const group = this.entryGroup;
    const image: GalleryImage | undefined = entranceImage;
    if (!image) return;

    const alpha = radialFadeTexture();
    const vFade = verticalFadeTexture();

    const panels: THREE.Mesh[] = [];
    this.frontageHeight = 11.5;

    const texture = this.loader.load(image.large, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      const img = t.image as { width?: number; height?: number } | undefined;
      if (!img?.width || !img?.height) return;
      const ratio = img.height / img.width;
      const width = 36;
      const height = clamp(width * ratio, 8, 26);
      this.frontageHeight = height;
      for (const mesh of panels) {
        mesh.geometry.dispose();
        mesh.geometry = new THREE.PlaneGeometry(width, height);
        mesh.position.y = 2.2 + (mesh.userData.yOffset as number) * height;
      }
    });

    const makePanel = (
      opacity: number,
      tint: number,
      yOffset: number,
      flip: boolean,
      map: THREE.Texture | null,
      fadeMap: THREE.Texture,
    ) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(36, this.frontageHeight),
        new THREE.MeshBasicMaterial({
          map,
          alphaMap: fadeMap,
          transparent: true,
          opacity,
          color: tint,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      mesh.userData.yOffset = yOffset;
      mesh.position.set(0, 2.2 + yOffset * this.frontageHeight, -11);
      mesh.scale.y = flip ? -1 : 1;
      group.add(mesh);
      this.frontPanels.push({ mesh, baseOpacity: opacity });
      return mesh;
    };

    // the building itself
    panels.push(makePanel(0.92, 0xd7e6f7, 0, false, texture, alpha));
    // its mirror in the street, faded out downwards
    panels.push(makePanel(0.3, 0x9dc4e8, -1.0, true, texture, vFade));

    // A threshold bloom rather than a drawn doorway. The photograph already is the real
    // space, so this only has to glow warmly as you cross into it — and it sits happily
    // over an interior shot or an exterior one.
    const threshold = new THREE.Mesh(
      new THREE.PlaneGeometry(17, 12),
      new THREE.MeshBasicMaterial({
        map: radialGlowTexture('rgba(255,238,208,0.45)', 'rgba(150,120,80,0.1)'),
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    threshold.position.set(0, 2.4, -10.6);
    group.add(threshold);

    // A huge, very faint copy that rides with the camera, so the front is present in the
    // background from the very first frame of the gate screen.
    const far = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 60),
      new THREE.MeshBasicMaterial({
        map: texture,
        alphaMap: radialFadeTexture(),
        transparent: true,
        opacity: 0.34,
        color: 0x7fa8d4,
        depthWrite: false,
      }),
    );
    far.position.z = -60;
    far.renderOrder = -1;
    this.farBackdrop = far;
    group.add(far);
  }

  /** The deck: a ring of station monoliths you can turn around and pick from. */
  private buildHub(stations: Station[]) {
    const group = this.hubGroup;

    // deck floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(26, 72),
      new THREE.MeshStandardMaterial({
        color: 0x030303,
        roughness: 0.5,
        metalness: 0.7,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    group.add(floor);

    // concentric rings + radial spokes
    const linePositions: number[] = [];
    for (let r = 2; r <= 24; r += 2) {
      const segments = 96;
      for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        linePositions.push(
          Math.cos(a0) * r, 0.012, Math.sin(a0) * r,
          Math.cos(a1) * r, 0.012, Math.sin(a1) * r,
        );
      }
    }
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      linePositions.push(
        Math.cos(a) * 2.4, 0.012, Math.sin(a) * 2.4,
        Math.cos(a) * 24, 0.012, Math.sin(a) * 24,
      );
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    group.add(
      new THREE.LineSegments(
        gridGeo,
        new THREE.LineBasicMaterial({
          color: 0x4a4234,
          transparent: true,
          opacity: 0.3,
          blending: THREE.AdditiveBlending,
        }),
      ),
    );

    // central glow + beam
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshBasicMaterial({
        map: this.glowTexture,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.02;
    group.add(glow);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 1.5, 12, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff6e6,
        transparent: true,
        opacity: 0.03,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    beam.position.y = 6;
    group.add(beam);

    // rim
    const rimPoints: number[] = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      rimPoints.push(Math.cos(a) * HUB_RADIUS, 0.03, Math.sin(a) * HUB_RADIUS);
    }
    const rimGeo = new THREE.BufferGeometry().setFromPoints(
      rimPoints.reduce<THREE.Vector3[]>((acc, _, i, arr) => {
        if (i % 3 === 0) acc.push(new THREE.Vector3(arr[i], arr[i + 1], arr[i + 2]));
        return acc;
      }, []),
    );
    group.add(
      new THREE.Line(
        rimGeo,
        new THREE.LineBasicMaterial({
          color: 0xd9b978,
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending,
        }),
      ),
    );

    // a brass medallion inlaid at the centre of the deck
    for (const radius of [3.1, 3.35]) {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 128; i++) {
        const angle = (i / 128) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(angle) * radius, 0.02, Math.sin(angle) * radius));
      }
      group.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineBasicMaterial({
            color: 0xd9b978,
            transparent: true,
            opacity: radius === 3.1 ? 0.4 : 0.18,
          }),
        ),
      );
    }

    // drift particles
    const pCount = this.reduced ? 90 : 320;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 22;
      pPos[i * 3] = Math.cos(a) * r;
      pPos[i * 3 + 1] = 0.4 + Math.random() * 9;
      pPos[i * 3 + 2] = Math.sin(a) * r;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    group.add(
      new THREE.Points(
        pGeo,
        new THREE.PointsMaterial({
          map: this.particleTexture,
          size: 0.34,
          transparent: true,
          depthWrite: false,
          opacity: 0.75,
          blending: THREE.AdditiveBlending,
          color: 0xeae3d5,
        }),
      ),
    );

    // PORT wordmark hanging over the deck, facing down
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 2.75),
      new THREE.MeshBasicMaterial({
        map: labelTexture('PORT', { colour: '#f2ece0', size: 200, spacing: 36 }),
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
      }),
    );
    logo.position.set(0, 6.4, 0);
    logo.rotation.x = Math.PI / 2.1;
    this.hubLogo = logo;
    group.add(logo);

    // hover ring
    const hoverRing = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 1.78, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    hoverRing.rotation.x = -Math.PI / 2;
    this.hoverRing = hoverRing;
    group.add(hoverRing);

    // monoliths
    const n = Math.max(1, stations.length);
    stations.forEach((station, i) => {
      const angle = (i / n) * Math.PI * 2 + Math.PI / n;
      const mg = new THREE.Group();
      mg.position.set(Math.cos(angle) * HUB_RADIUS, 0, Math.sin(angle) * HUB_RADIUS);
      mg.rotation.y = -angle + Math.PI / 2;

      const accent = new THREE.Color(station.accent);

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 4.2, 0.34),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(ACCENT_DIM),
          emissive: accent.clone().multiplyScalar(0.1),
          roughness: 0.32,
          metalness: 0.85,
        }),
      );
      body.position.y = 2.3;
      body.userData.stationId = station.id;
      mg.add(body);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(body.geometry),
        new THREE.LineBasicMaterial({
          color: accent,
          transparent: true,
          opacity: 0.85,
        }),
      );
      edges.position.copy(body.position);
      mg.add(edges);

      const pedestal = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.22, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x121110, metalness: 0.9, roughness: 0.3 }),
      );
      pedestal.position.y = 0.11;
      mg.add(pedestal);

      const bar = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 0.045),
        new THREE.MeshBasicMaterial({
          color: accent,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
        }),
      );
      // −Z is the face the visitor sees, so the accent line belongs there rather than
      // hidden behind the monolith.
      bar.position.set(0, 4.42, -0.19);
      mg.add(bar);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.35, 1.45, 40),
        new THREE.MeshBasicMaterial({
          color: accent,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      mg.add(ring);

      const cover = this.hangDeckCover(station, mg);

      group.add(mg);
      this.monoliths.push({
        station,
        group: mg,
        body,
        ring,
        art: cover?.art,
        haloMaterial: cover?.haloMaterial,
        edgeMaterial: cover?.edgeMaterial,
        hot: 0,
      });
    });

    this.buildDeckLabels(stations);
  }

  /**
   * A floating name plate in front of every monolith, carrying the station glyph, its
   * number and its name in extruded type. Each plate turns to face the visitor every
   * frame, so the deck is legible wherever you are standing — and brightens when you
   * point at it.
   */
  private buildDeckLabels(stations: Station[]) {
    const n = Math.max(1, stations.length);
    const inward = 1.5;
    const font = this.font;

    stations.forEach((station, i) => {
      const angle = (i / n) * Math.PI * 2 + Math.PI / n;
      const group = new THREE.Group();
      group.position.set(
        Math.cos(angle) * (HUB_RADIUS - inward),
        2.75,
        Math.sin(angle) * (HUB_RADIUS - inward),
      );
      group.userData.stationId = station.id;
      this.hubGroup.add(group);

      const accent = new THREE.Color(station.accent);

      // glyph
      const glyphMaterial = new THREE.MeshBasicMaterial({
        map: this.loader.load(glyphDataUrl(station.glyph, station.accent)),
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const glyph = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), glyphMaterial);
      glyph.position.y = 0.88;
      group.add(glyph);

      // number
      const numeral = this.text3D(String(i + 1).padStart(2, '0'), {
        size: 0.34,
        depth: 0.05,
        color: accent,
        emissive: 0.55,
      });
      if (numeral) {
        numeral.position.y = 0.34;
        group.add(numeral);
      }

      // name
      const maxWidth = 3.5;
      let name: THREE.Mesh;
      let nameMaterial: THREE.MeshStandardMaterial;
      let nameWidth = maxWidth;

      if (font) {
        nameMaterial = new THREE.MeshStandardMaterial({
          color: 0xf3ece0,
          emissive: new THREE.Color(0xf3ece0).multiplyScalar(0.16),
          roughness: 0.34,
          metalness: 0.6,
        });
        const nameGeo = new TextGeometry(station.label, {
          font,
          size: 0.28,
          depth: 0.055,
          curveSegments: 2,
          bevelEnabled: true,
          bevelThickness: 0.005,
          bevelSize: 0.004,
          bevelSegments: 1,
        });
        nameGeo.computeBoundingBox();
        const box = nameGeo.boundingBox;
        nameWidth = box ? box.max.x - box.min.x : maxWidth;
        nameGeo.center();
        name = new THREE.Mesh(nameGeo, nameMaterial);
        // squeeze only when a long name would crowd its neighbours around the ring
        if (nameWidth > maxWidth) name.scale.setScalar(maxWidth / nameWidth);
      } else {
        // If the display face ever fails to parse, fall back to a flat placard. It still
        // turns to face the visitor, so the deck stays navigable either way.
        nameMaterial = new THREE.MeshStandardMaterial({
          map: labelTexture(station.label, { colour: '#f3ece0', size: 58, spacing: 6 }),
          transparent: true,
          roughness: 0.5,
          metalness: 0.2,
        });
        name = new THREE.Mesh(new THREE.PlaneGeometry(maxWidth, 0.58), nameMaterial);
      }

      name.position.y = -0.12;
      group.add(name);

      // a short accent rule under the name
      const rule = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(maxWidth, nameWidth || maxWidth) * 0.92, 0.022),
        new THREE.MeshBasicMaterial({
          color: accent,
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      rule.position.y = -0.42;
      group.add(rule);

      this.deckLabels.push({
        station,
        group,
        name,
        nameMaterial,
        nameBase: new THREE.Color(0xf3ece0),
        nameHot: new THREE.Color(0xffffff),
        glyph,
        glyphMaterial,
        baseY: group.position.y,
        hot: 0,
        phase: i * 0.9,
      });
    });
  }

  /* ---------------------------------------------------------------- 3D lettering */

  /**
   * Real extruded text — geometry, not a texture, so it catches the deck lighting and
   * reads from any angle. Optionally squeezed to a maximum width so a long station name
   * never crowds its neighbours around the ring.
   */
  private text3D(
    text: string,
    opts: {
      size: number;
      depth: number;
      maxWidth?: number;
      color: THREE.ColorRepresentation;
      emissive?: number;
      roughness?: number;
      metalness?: number;
    },
  ): THREE.Mesh | null {
    if (!this.font) return null;
    let geometry: TextGeometry;
    try {
      geometry = new TextGeometry(text, {
        font: this.font,
        size: opts.size,
        depth: opts.depth,
        curveSegments: 2,
        bevelEnabled: true,
        bevelThickness: 0.006,
        bevelSize: 0.005,
        bevelSegments: 1,
      });
    } catch {
      return null;
    }

    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const width = box ? box.max.x - box.min.x : 0;
    geometry.center();

    const material = new THREE.MeshStandardMaterial({
      color: opts.color,
      emissive: new THREE.Color(opts.color).multiplyScalar(opts.emissive ?? 0.35),
      roughness: opts.roughness ?? 0.32,
      metalness: opts.metalness ?? 0.65,
    });

    const mesh = new THREE.Mesh(geometry, material);
    if (opts.maxWidth && width > opts.maxWidth) {
      mesh.scale.setScalar(opts.maxWidth / width);
    }
    return mesh;
  }

  /* ---------------------------------------------------------------- corridor */

  private clearCorridor() {
    // Generated label textures belong to this corridor and die with it; photograph
    // textures are shared through `textureCache` and are released separately below.
    const cached = new Set(this.textureCache.values());
    for (const child of [...this.corridorGroup.children]) {
      this.corridorGroup.remove(child);
      child.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        const disposeMat = (m: THREE.Material) => {
          const map = (m as THREE.MeshBasicMaterial).map;
          if (map && !cached.has(map)) map.dispose();
          m.dispose();
        };
        if (Array.isArray(mat)) mat.forEach(disposeMat);
        else if (mat) disposeMat(mat);
      });
    }
    this.releasePhotoTextures();
    this.frames = [];
    this.corridorDoor = undefined;
  }

  /**
   * Only one corridor is ever alive, so tearing it down lets go of every photograph
   * texture it pulled in. Re-entering a station re-reads them from the HTTP cache.
   */
  private releasePhotoTextures() {
    for (const tex of this.textureCache.values()) tex.dispose();
    this.textureCache.clear();
  }

  private textureFor(url: string) {
    const cached = this.textureCache.get(url);
    if (cached) return cached;
    const tex = this.loader.load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
      },
      undefined,
      () => undefined,
    );
    this.textureCache.set(url, tex);
    return tex;
  }

  /**
   * A cover for the deck. Same loading rules as `textureFor`, separate lifetime: these live
   * as long as the deck does, and the corridor teardown must not reach them.
   */
  private coverTextureFor(url: string, onReady?: (tex: THREE.Texture) => void) {
    const cached = this.deckCoverTextures.find((t) => t.name === url);
    if (cached) {
      onReady?.(cached);
      return cached;
    }
    const tex = this.loader.load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        onReady?.(t);
      },
      undefined,
      () => undefined,
    );
    tex.name = url;
    this.deckCoverTextures.push(tex);
    return tex;
  }

  /**
   * Hang one work on a station's face: a dark board, gold leaf, and the piece itself.
   *
   * This is the corridor's frame, built from the same materials at a smaller size, so the
   * deck and the wings read as one gallery rather than two ideas. The work is mounted, not
   * cropped — it keeps its true shape and is centred in the opening, because stretching a
   * poster of one proportion into a frame of another is the one thing that would give the
   * whole wall away as a mock-up.
   */
  private hangDeckCover(station: Station, parent: THREE.Group) {
    const image = deckCovers.get(station.id);
    if (!image) return;

    const accent = new THREE.Color(station.accent);
    const width = 2.34;
    const height = 1.74;
    const openingWidth = 2.02;
    const openingHeight = 1.42;
    const centreY = 2.45;

    /*
     * The monolith group is turned so that its local +Z points radially *outward* — away
     * from the visitor standing on the deck. A flat work mounted at +Z would therefore face
     * the dark, and read mirrored from behind. Everything hangs on a mounting turned to face
     * the deck, so the piece and its frame are built the obvious way round.
     */
    const mount = new THREE.Group();
    mount.rotation.y = Math.PI;
    parent.add(mount);

    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 0.1),
      new THREE.MeshStandardMaterial({
        color: 0x0e0d0b,
        metalness: 0.7,
        roughness: 0.4,
        emissive: accent.clone().multiplyScalar(0.06),
      }),
    );
    plate.position.set(0, centreY, 0.25);
    mount.add(plate);

    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xd9b978,
      transparent: true,
      opacity: 0.9,
    });
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(width + 0.06, height + 0.06, 0.16)),
      edgeMaterial,
    );
    edge.position.copy(plate.position);
    mount.add(edge);

    // A soft spill of the station's colour around the board, so each work reads as lit
    // rather than pasted on.
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(width + 0.8, height + 0.86), haloMaterial);
    halo.position.set(0, centreY, 0.2);
    mount.add(halo);

    // A unit plane, scaled once the piece's real shape is known.
    const artMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const art = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), artMaterial);
    art.position.set(0, centreY, 0.31);
    mount.add(art);

    artMaterial.map = this.coverTextureFor(image.small, (texture) => {
      const loaded = texture.image as
        | { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number }
        | null;
      // The sync does not always record dimensions, so trust the pixels when it has not.
      const w = image.width || loaded?.naturalWidth || loaded?.width || 0;
      const h = image.height || loaded?.naturalHeight || loaded?.height || 0;
      if (!w || !h) return;
      const fit = Math.min(openingWidth / w, openingHeight / h);
      art.scale.set(w * fit, h * fit, 1);
    });
    artMaterial.needsUpdate = true;

    return { art, haloMaterial, edgeMaterial };
  }

  private buildCorridor(station: Station) {
    this.clearCorridor();
    const exhibits = station.exhibits;
    const spacing = 7.4;
    const length = Math.max(24, exhibits.length * spacing + 12);
    this.corridorLength = length;
    this.corridorWalk = 0;
    this.corridorTarget = 0;

    const group = this.corridorGroup;

    // floor + ceiling
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x050504,
      roughness: 0.28,
      metalness: 0.8,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, length + 20), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -length / 2 + 6);
    group.add(floor);

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(9, length + 20),
      new THREE.MeshStandardMaterial({ color: 0x030303, roughness: 0.9, metalness: 0.2 }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 4.4, -length / 2 + 6);
    group.add(ceiling);

    // side walls (dim, so the frames read)
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(length + 20, 4.6),
        new THREE.MeshStandardMaterial({
          color: 0x0b0a09,
          roughness: 0.85,
          metalness: 0.15,
          side: THREE.DoubleSide,
        }),
      );
      wall.rotation.y = side * (Math.PI / 2);
      wall.position.set(side * 4.6, 2.2, -length / 2 + 6);
      group.add(wall);
    }

    // Brass inlay beside the walkway and brass skirting along the walls — the only lines in
    // the room, and neither of them glows. Gallery detailing, not starship lighting.
    const lineDetails: { positions: number[]; opacity: number }[] = [
      {
        positions: [-1.7, 0.015, 6, -1.7, 0.015, -length - 2, 1.7, 0.015, 6, 1.7, 0.015, -length - 2],
        opacity: 0.2,
      },
      {
        positions: [-4.55, 0.11, 6, -4.55, 0.11, -length - 2, 4.55, 0.11, 6, 4.55, 0.11, -length - 2],
        opacity: 0.14,
      },
    ];
    for (const detail of lineDetails) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(detail.positions, 3));
      group.add(
        new THREE.LineSegments(
          geometry,
          new THREE.LineBasicMaterial({
            color: 0xd9b978,
            transparent: true,
            opacity: detail.opacity,
          }),
        ),
      );
    }

    // ceiling lights
    for (let i = 0; i < Math.ceil(length / 6); i++) {
      const lamp = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.12),
        new THREE.MeshBasicMaterial({
          color: 0xf2e8d5,
          transparent: true,
          opacity: 0.45,
          blending: THREE.AdditiveBlending,
        }),
      );
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(0, 4.35, 4 - i * 6);
      group.add(lamp);
    }

    exhibits.forEach((ex, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const z = -5 - i * spacing;
      const fg = new THREE.Group();
      fg.position.set(side * 4.5, 2.1, z);
      fg.rotation.y = side * (Math.PI / 2);

      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(3.5, 2.5, 0.14),
        new THREE.MeshStandardMaterial({ color: 0x0e0d0b, metalness: 0.7, roughness: 0.4 }),
      );
      fg.add(plate);

      // gold leaf around the frame
      const border = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(3.56, 2.56, 0.2)),
        new THREE.LineBasicMaterial({ color: 0xd9b978, transparent: true, opacity: 0.9 }),
      );
      fg.add(border);

      const image = ex.images[0];
      const art = new THREE.Mesh(
        new THREE.PlaneGeometry(3.05, 2.05),
        new THREE.MeshBasicMaterial({
          color: image ? 0xffffff : 0x14202f,
          map: image ? this.textureFor(image.small) : null,
          side: THREE.DoubleSide,
        }),
      );
      art.position.z = 0.1;
      art.userData.exhibitIndex = i;
      fg.add(art);

      const caption = new THREE.Mesh(
        new THREE.PlaneGeometry(3.3, 0.44),
        new THREE.MeshBasicMaterial({
          map: labelTexture(ex.title.toUpperCase(), {
            colour: '#efe9dd',
            size: 44,
            spacing: 3,
          }),
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
        }),
      );
      caption.position.set(0, -1.62, 0.12);
      fg.add(caption);

      const meta = new THREE.Mesh(
        new THREE.PlaneGeometry(3.3, 0.3),
        new THREE.MeshBasicMaterial({
          map: labelTexture(ex.meta, { colour: station.accent, size: 30, weight: '500', spacing: 2 }),
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
        }),
      );
      meta.position.set(0, -1.98, 0.12);
      fg.add(meta);

      const spotlight = new THREE.Mesh(
        new THREE.PlaneGeometry(3.9, 2.9),
        new THREE.MeshBasicMaterial({
          map: this.glowTexture,
          transparent: true,
          opacity: 0.26,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      spotlight.position.set(0, 0, 0.05);
      fg.add(spotlight);

      group.add(fg);
      this.frames.push({ index: i, group: fg, plate: art, side, z });
    });

    // arrival plate, in the same extruded lettering as the deck so the two agree
    const wingName = this.text3D(station.label, {
      size: 0.42,
      depth: 0.08,
      maxWidth: 9,
      color: 0xf3ece0,
      emissive: 0.28,
      metalness: 0.5,
      roughness: 0.38,
    });
    if (wingName) {
      wingName.position.set(0, 3.2, 1.5);
      group.add(wingName);
    } else {
      const entryPlate = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 0.9),
        new THREE.MeshBasicMaterial({
          map: labelTexture(station.label, { colour: '#f2ece0', size: 60, spacing: 10 }),
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
        }),
      );
      entryPlate.position.set(0, 3.2, 1.5);
      group.add(entryPlate);
    }

    // exit portal at the far end — walk here to return to the deck
    const doorGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 7),
      new THREE.MeshBasicMaterial({
        map: radialGlowTexture('rgba(255,246,228,0.78)', 'rgba(150,120,80,0.14)'),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    doorGlow.position.set(0, 2.4, -length - 1.4);
    group.add(doorGlow);

    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(3.3, 3.9),
      new THREE.MeshBasicMaterial({
        color: 0xf4e9d2,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    door.position.set(0, 2.1, -length - 1.5);
    door.userData.returnToHub = true;
    this.corridorDoor = door;
    group.add(door);

    const exitSign = this.text3D('KEMBALI KE DEK', {
      size: 0.34,
      depth: 0.06,
      maxWidth: 5.2,
      color: station.accent,
      emissive: 0.5,
    });
    if (exitSign) {
      exitSign.position.set(0, 4.55, -length - 1.4);
      group.add(exitSign);
    } else {
      const doorLabel = new THREE.Mesh(
        new THREE.PlaneGeometry(4.4, 0.5),
        new THREE.MeshBasicMaterial({
          map: labelTexture('KEMBALI KE DEK', { colour: '#e9dcc2', size: 42, spacing: 4 }),
          transparent: true,
          opacity: 0.85,
        }),
      );
      doorLabel.position.set(0, 4.55, -length - 1.4);
      group.add(doorLabel);
    }

    group.visible = false;
  }

  /* ---------------------------------------------------------------- phases */

  private applyPhase(phase: Phase) {
    this.phase = phase;
    this.entryGroup.visible = phase === 'entry';
    this.hubGroup.visible = phase === 'hub' || phase === 'warp';
    this.corridorGroup.visible = phase === 'corridor';
  }

  private setPhase(phase: Phase) {
    this.applyPhase(phase);
    this.opts.onPhase?.(phase);
  }

  getPhase(): Phase {
    return this.phase;
  }

  getEntryDuration() {
    return this.reduced ? 0 : this.entryDuration;
  }

  startEntry() {
    if (!this.reduced) {
      this.entryT = 0;
      this.entryArmed = true;
      this.setPhase('entry');
      this.look = { yaw: 0, pitch: 0, ty: 0, tp: 0 };
      this.rig.position.set(0, 0.1, 66);
      return;
    }
    this.skipEntry();
  }

  skipEntry() {
    this.entryArmed = false;
    this.entryT = this.entryDuration;
    this.enterHub();
  }

  private enterHub() {
    this.rig.position.copy(HUB_CAMERA);
    this.look = { yaw: 0, pitch: 0, ty: 0, tp: 0 };
    this.setPhase('hub');
  }

  /** Warp from the deck into a station. */
  openCorridor(station: Station) {
    this.currentStation = station;
    this.buildCorridor(station);
    this.focusedExhibit = -1;
    if (this.reduced) {
      this.rig.position.set(0, 1.72, 3.2);
      this.look = { yaw: 0, pitch: 0, ty: 0, tp: 0 };
      this.corridorGroup.visible = true;
      this.phase = 'corridor';
      this.setPhase('corridor');
      return;
    }
    this.warpT = 0;
    this.setPhase('warp');
    window.setTimeout(() => {
      if (this.disposed) return;
      this.rig.position.set(0, 1.72, 4.6);
      this.look = { yaw: 0, pitch: 0, ty: 0, tp: 0 };
      this.setPhase('corridor');
    }, 520);
  }

  leaveStation() {
    this.currentStation = null;
    this.focusedExhibit = -1;
    if (this.reduced) {
      this.enterHub();
      return;
    }
    this.warpT = 0;
    this.setPhase('warp');
    window.setTimeout(() => {
      if (this.disposed) return;
      this.clearCorridor();
      this.enterHub();
    }, 420);
  }

  getStation(): Station | null {
    return this.currentStation;
  }

  /**
   * Introspection for tuning the space. Exposed on `window.__PORT__` during development
   * so the live scene can be inspected from the console.
   */
  debug() {
    const info = this.renderer.info;
    return {
      phase: this.phase,
      station: this.currentStation?.id ?? null,
      constellation: { nodes: this.nodePos.length, links: this.lastLinkCount },
      monoliths: this.monoliths.length,
      deckLabels: this.deckLabels.length,
      deckCovers: this.monoliths.map((m) => ({
        id: m.station.id,
        hung: Boolean(m.art),
        artSize: m.art ? [+m.art.scale.x.toFixed(2), +m.art.scale.y.toFixed(2)] : null,
        textureLoaded: Boolean((m.art?.material as THREE.MeshBasicMaterial | undefined)?.map?.image),
      })),
      displayFont: this.font ? 'loaded' : 'missing',
      frames: this.frames.length,
      hovered: this.hovered,
      camZ: Number(this.rig.position.z.toFixed(2)),
      camY: Number(this.rig.position.y.toFixed(2)),
      walk: Number(this.corridorWalk.toFixed(2)),
      progress: Number(this.getWalkProgress().toFixed(3)),
      labels: this.deckLabels.map((l) => ({
        id: l.station.id,
        glyphs: l.name.geometry.attributes.position?.count ?? 0,
        rotY: Number(l.group.rotation.y.toFixed(3)),
        hot: Number(l.hot.toFixed(2)),
      })),
      frontageOpacity: this.frontPanels.map((p) =>
        Number((p.mesh.material as THREE.MeshBasicMaterial).opacity.toFixed(3)),
      ),
      farBackdropOpacity: this.farBackdrop
        ? Number((this.farBackdrop.material as THREE.MeshBasicMaterial).opacity.toFixed(3))
        : null,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      textures: info.memory.textures,
      geometries: info.memory.geometries,
    };
  }

  /** Walk up to a specific frame, so the corridor can be driven from the DOM rail. */
  focusExhibit(index: number) {
    const frame = this.frames[index];
    if (!frame) return;
    this.focusedExhibit = index;
    const targetWalk = clamp(-(frame.z + 5), 0, Math.max(0, this.corridorLength - 8));
    this.corridorTarget = targetWalk;
    if (this.reduced) {
      this.corridorWalk = targetWalk;
      this.rig.position.z = 4.6 + targetWalk;
    }
  }

  /** Distance along the corridor the visitor has walked (for the HUD progress bar). */
  getWalkProgress() {
    return this.corridorLength <= 0 ? 0 : clamp(this.corridorWalk / (this.corridorLength - 8), 0, 1);
  }

  setLook(yaw: number, pitch: number) {
    this.look.yaw = yaw;
    this.look.ty = yaw;
    this.look.pitch = pitch;
    this.look.tp = pitch;
  }

  /** Point the camera at whichever monolith is focused (used by the HUD list). */
  aimAtStation(stationId: string) {
    const m = this.monoliths.find((x) => x.station.id === stationId);
    if (!m) return;
    const p = m.group.position;
    const yaw = Math.atan2(-p.x, -p.z);
    this.look.ty = yaw;
    this.look.tp = -0.06;
    if (this.reduced) {
      this.look.yaw = yaw;
      this.look.pitch = -0.06;
    }
  }

  getHovered() {
    return this.hovered;
  }

  /* ---------------------------------------------------------------- input */

  private setPointer(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onPointerDown = (event: PointerEvent) => {
    this.canvas.setPointerCapture?.(event.pointerId);
    this.dragging = true;
    this.moved = 0;
    this.setPointer(event);
  };

  private onPointerMove = (event: PointerEvent) => {
    this.setPointer(event);
    this.hasPointer = true;
    if (this.dragging) {
      this.moved += Math.abs(event.movementX) + Math.abs(event.movementY);
      const speed = this.phase === 'entry' ? 0.0008 : 0.0032;
      this.look.ty -= event.movementX * speed;
      this.look.tp = clamp(this.look.tp - event.movementY * speed, -0.85, 0.85);
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    const wasDragging = this.dragging;
    this.dragging = false;
    this.canvas.releasePointerCapture?.(event.pointerId);
    if (!wasDragging || this.moved > 12) return;
    this.pick();
  };

  private onPointerLeave = () => {
    this.dragging = false;
    this.hasPointer = false;
    this.setHovered(null);
  };

  private onWheel = (event: WheelEvent) => {
    this.walk(event.deltaY * 0.012);
  };

  /** Move along the corridor from the HUD, the wheel or the keyboard. */
  walk(delta: number) {
    if (this.phase !== 'corridor') return;
    this.corridorTarget = clamp(
      this.corridorTarget + delta,
      0,
      Math.max(0, this.corridorLength - 8),
    );
    if (this.reduced) {
      this.corridorWalk = this.corridorTarget;
      this.rig.position.z = 4.6 + this.corridorWalk;
    }
  }

  private setHovered(stationId: string | null) {
    if (this.hovered === stationId) return;
    this.hovered = stationId;
    this.opts.onHover?.(stationId);
    this.canvas.style.cursor = stationId ? 'pointer' : 'grab';
  }

  private pick() {
    this.ray.setFromCamera(this.ndc.set(this.pointer.x, this.pointer.y), this.camera);

    if (this.phase === 'hub' || this.phase === 'warp') {
      const bodies = this.monoliths.map((m) => m.body);
      const hits = this.ray.intersectObjects(bodies, false);
      if (hits.length) {
        const id = hits[0].object.userData.stationId as string;
        this.opts.onStationSelect?.(id);
      }
      return;
    }

    if (this.phase === 'corridor') {
      if (this.corridorDoor) {
        const doorHits = this.ray.intersectObject(this.corridorDoor, false);
        if (doorHits.length) {
          this.leaveStation();
          return;
        }
      }
      const arts = this.frames.map((f) => f.plate);
      const hits = this.ray.intersectObjects(arts, false);
      if (hits.length) {
        const index = hits[0].object.userData.exhibitIndex as number;
        this.opts.onExhibitSelect?.(index);
      }
    }
  }

  private updateHover() {
    if (this.phase === 'hub' || this.phase === 'warp') {
      this.ray.setFromCamera(this.ndc.set(this.pointer.x, this.pointer.y), this.camera);
      const hits = this.ray.intersectObjects(
        this.monoliths.map((m) => m.body),
        false,
      );
      this.setHovered(hits.length ? (hits[0].object.userData.stationId as string) : null);
    } else if (this.phase === 'corridor') {
      this.ray.setFromCamera(this.ndc.set(this.pointer.x, this.pointer.y), this.camera);
      const arts = this.frames.map((f) => f.plate);
      const doorHit = this.corridorDoor
        ? this.ray.intersectObject(this.corridorDoor, false).length > 0
        : false;
      const hit = this.ray.intersectObjects(arts, false).length > 0;
      this.canvas.style.cursor = doorHit || hit ? 'pointer' : 'grab';
    } else if (this.hovered) {
      this.setHovered(null);
    }
  }

  /* ---------------------------------------------------------------- frame loop */

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    if (this.phase === 'entry') {
      if (this.entryArmed) {
        this.entryT += delta;
        const p = clamp(this.entryT / this.entryDuration, 0, 1);
        this.opts.onEntryProgress?.(p);
        const eased = easeInOut(p);
        this.rig.position.z = 66 - eased * 66;
        this.rig.position.y = Math.sin(p * Math.PI * 1.6) * 0.9 * (1 - p) + 0.1;
        this.look.tp = Math.sin(p * Math.PI * 2.2) * 0.12 * (1 - p);
        this.gateLogo?.lookAt(this.camera.getWorldPosition(new THREE.Vector3()));
        if (p >= 1) this.enterHub();
      }
    } else if (this.phase === 'warp') {
      this.warpT += delta;
      this.look.ty += delta * 1.4;
    } else if (this.phase === 'corridor') {
      this.corridorWalk = this.reduced
        ? this.corridorTarget
        : THREE.MathUtils.damp(this.corridorWalk, this.corridorTarget, 3.2, delta);
      this.rig.position.z = 4.6 + this.corridorWalk;

      // nearest frame drives the HUD readout
      const camZ = this.rig.position.z;
      let nearest = -1;
      let best = Infinity;
      for (const f of this.frames) {
        const d = Math.abs(f.z - (camZ - 6));
        if (d < best) {
          best = d;
          nearest = f.index;
        }
      }
      if (nearest !== this.focusedExhibit && best < 4.4) {
        this.focusedExhibit = nearest;
        this.opts.onExhibitFocus?.(nearest);
      }
    }

    if (this.phase === 'hub' || this.phase === 'warp') {
      this.rig.position.y = HUB_CAMERA.y + Math.sin(t * 0.6) * 0.045;
    }

    // smooth look
    this.look.yaw += (this.look.ty - this.look.yaw) * Math.min(1, delta * 7);
    this.look.pitch += (this.look.tp - this.look.pitch) * Math.min(1, delta * 7);
    this.yaw.rotation.y = this.look.yaw;
    this.pitch.rotation.x = this.look.pitch;

    // ambient motion
    this.updateConstellation(delta);
    if (this.starField) this.starField.rotation.y = t * 0.008;
    if (this.hubLogo) this.hubLogo.rotation.z = Math.sin(t * 0.25) * 0.03;
    if (this.entryGate && this.phase === 'entry') {
      this.entryGate.rotation.z = Math.sin(t * 0.4) * 0.03;
      // idle shimmer while the gate overlay is still up
      if (!this.entryArmed) this.entryGate.rotation.y = Math.sin(t * 0.22) * 0.05;
    }

    if (this.phase === 'entry') {
      const p = this.entryArmed ? clamp(this.entryT / this.entryDuration, 0, 1) : 0;
      // the frontage resolves as you close on it, then releases as you step through
      const arrive = clamp((p - 0.25) / 0.55, 0, 1);
      const passThrough = 1 - clamp((p - 0.9) / 0.1, 0, 1);
      for (const { mesh, baseOpacity } of this.frontPanels) {
        const material = mesh.material as THREE.MeshBasicMaterial;
        material.opacity = baseOpacity * (0.35 + 0.65 * arrive) * passThrough;
      }
      if (this.farBackdrop) {
        const material = this.farBackdrop.material as THREE.MeshBasicMaterial;
        material.opacity = 0.34 * (1 - arrive * 0.75) * passThrough;
        // keep the far front at a stable distance so it always reads as background
        this.farBackdrop.position.z = this.rig.position.z - 62;
        this.farBackdrop.position.y = this.rig.position.y + 4;
      }
    }
    if (this.phase === 'hub') this.updateHover();

    // monolith hover feedback
    for (const m of this.monoliths) {
      const isHovered = this.hovered === m.station.id;
      const mat = m.ring.material as THREE.MeshBasicMaterial;
      mat.opacity += ((isHovered ? 0.9 : 0) - mat.opacity) * Math.min(1, delta * 10);
      m.group.position.y = THREE.MathUtils.damp(
        m.group.position.y,
        isHovered ? 0.38 : 0,
        6,
        delta,
      );
    }

    // Deck lettering: every plate turns to face the visitor, so the stations stay
    // readable from wherever you are standing. `warp` keeps it working mid-transition.
    if (this.phase === 'hub' || this.phase === 'warp') {
      const camX = this.rig.position.x;
      const camZ = this.rig.position.z;
      for (const label of this.deckLabels) {
        const { x, z } = label.group.position;
        label.group.rotation.y = Math.atan2(camX - x, camZ - z);
        label.group.position.y =
          label.baseY + Math.sin(t * 1.1 + label.phase) * 0.035;

        const isHovered = this.hovered === label.station.id;
        label.hot = THREE.MathUtils.damp(label.hot, isHovered ? 1 : 0, 8, delta);
        const scale = 1 + label.hot * 0.12;
        label.group.scale.setScalar(scale);
        label.nameMaterial.color.lerpColors(
          label.nameBase,
          label.nameHot,
          label.hot,
        );
        label.glyphMaterial.opacity = 0.72 + label.hot * 0.28;
      }
    }

    // The hung works answer the pointer the same way the lettering does: a still, dim wall
    // that lifts the one you are pointing at, so the deck tells you what you are about to open.
    if (this.phase === 'hub' || this.phase === 'warp') {
      for (const monolith of this.monoliths) {
        const want = this.hovered === monolith.station.id ? 1 : 0;
        monolith.hot = THREE.MathUtils.damp(monolith.hot, want, 8, delta);
        if (monolith.haloMaterial) monolith.haloMaterial.opacity = 0.15 + monolith.hot * 0.3;
        if (monolith.edgeMaterial) monolith.edgeMaterial.opacity = 0.62 + monolith.hot * 0.38;
      }
    }

    if (this.hoverRing) {
      const hovered = this.monoliths.find((m) => m.station.id === this.hovered);
      const mat = this.hoverRing.material as THREE.MeshBasicMaterial;
      mat.opacity += ((hovered ? 0.5 : 0) - mat.opacity) * Math.min(1, delta * 10);
      if (hovered) {
        (this.hoverRing.material as THREE.MeshBasicMaterial).color.copy(
          new THREE.Color(hovered.station.accent),
        );
        this.hoverRing.position.set(
          hovered.group.position.x,
          0.06,
          hovered.group.position.z,
        );
      }
    }

    this.renderer.render(this.scene, this.camera);
  };
}
