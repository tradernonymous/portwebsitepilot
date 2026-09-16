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
import type { GalleryImage, Station } from '../content';
import { entranceImage } from '../content';
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
  glyph: THREE.Mesh;
  ring: THREE.Mesh;
  label: THREE.Mesh;
  baseY: number;
};

type FrameRef = {
  index: number;
  group: THREE.Group;
  plate: THREE.Mesh;
  side: number;
  z: number;
};

const ACCENT_DIM = '#0d1622';
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
  const { colour = '#e9f2ff', size = 96, weight = '600', spacing = 6 } = opts;
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
  private frames: FrameRef[] = [];
  private starField?: THREE.Points;
  private entryRings: THREE.Mesh[] = [];
  private entryGate = new THREE.Group();
  private gateLogo?: THREE.Mesh;
  private hubLogo?: THREE.Mesh;
  private hoverRing?: THREE.Mesh;
  private corridorDoor?: THREE.Mesh;
  private corridorStrip?: THREE.Mesh;
  /** Photographic frontage planes in the approach, faded in as the visitor arrives. */
  private frontPanels: { mesh: THREE.Mesh; baseOpacity: number }[] = [];
  private frontDoor?: THREE.Mesh;
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

    this.glowTexture = radialGlowTexture('rgba(120,210,255,0.55)', 'rgba(40,110,200,0.12)');
    this.particleTexture = dotTexture();

    this.scene.fog = new THREE.FogExp2(0x04060c, 0.017);

    this.scene.add(this.entryGroup, this.hubGroup, this.corridorGroup);
    this.buildEnvironment();
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
    for (const tex of this.textureCache.values()) tex.dispose();
    this.textureCache.clear();
    this.glowTexture.dispose();
    this.particleTexture.dispose();
    this.renderer.dispose();
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
      g.addColorStop(0, '#050912');
      g.addColorStop(0.45, '#081423');
      g.addColorStop(1, '#02040a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 32, 512);
    });
    this.scene.background = bg;

    this.scene.add(new THREE.AmbientLight(0x4a6a92, 0.85));
    const key = new THREE.DirectionalLight(0xbfe4ff, 0.9);
    key.position.set(6, 12, 8);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x2e7fd8, 42, 60, 2);
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
        size: 1.1,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: 0xa8d4ff,
      }),
    );
    this.starField = stars;
    this.scene.add(stars);
  }

  /** POV approach: a tunnel of gate rings with a PORT portal at the end. */
  private buildEntry() {
    const group = this.entryGroup;
    const ringCount = this.reduced ? 8 : 26;

    for (let i = 0; i < ringCount; i++) {
      const t = i / ringCount;
      const radius = 7.5 - t * 3.4;
      const geo = new THREE.TorusGeometry(radius, 0.045 + t * 0.05, 8, 64);
      const tone = new THREE.Color().setHSL(0.55 - t * 0.06, 0.85, 0.55 - t * 0.12);
      const mat = new THREE.MeshBasicMaterial({
        color: tone,
        transparent: true,
        opacity: 0.28 + t * 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.position.z = 74 - i * 3.1;
      ring.rotation.z = t * Math.PI * 0.6;
      this.entryRings.push(ring);
      group.add(ring);
    }

    // light streaks
    const streakCount = this.reduced ? 40 : 220;
    const pos = new Float32Array(streakCount * 6);
    for (let i = 0; i < streakCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 9;
      const z = -Math.random() * 120 + 40;
      const len = 3 + Math.random() * 9;
      pos[i * 6] = Math.cos(a) * r;
      pos[i * 6 + 1] = Math.sin(a) * r;
      pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = Math.cos(a) * r;
      pos[i * 6 + 4] = Math.sin(a) * r;
      pos[i * 6 + 5] = z - len;
    }
    const streakGeo = new THREE.BufferGeometry();
    streakGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    group.add(
      new THREE.LineSegments(
        streakGeo,
        new THREE.LineBasicMaterial({
          color: 0x8fd8ff,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );

    // the gate at the end of the approach
    const gateGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshBasicMaterial({
        map: radialGlowTexture('rgba(180,235,255,0.85)', 'rgba(50,130,220,0.18)'),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    gateGlow.position.z = -0.4;
    this.entryGate.add(gateGlow);

    const portal = new THREE.Mesh(
      new THREE.TorusGeometry(4.2, 0.16, 12, 96),
      new THREE.MeshBasicMaterial({ color: 0x9fe4ff, blending: THREE.AdditiveBlending }),
    );
    portal.position.z = 0;
    this.entryGate.add(portal);

    for (let i = 0; i < 3; i++) {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(5 + i * 1.5, 0.045, 8, 96),
        new THREE.MeshBasicMaterial({
          color: i === 1 ? 0xffb457 : 0x7fe3ff,
          transparent: true,
          opacity: 0.4 - i * 0.08,
          blending: THREE.AdditiveBlending,
        }),
      );
      halo.position.z = -i * 0.3;
      this.entryGate.add(halo);
    }

    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 2.25),
      new THREE.MeshBasicMaterial({
        map: labelTexture('PORT', { colour: '#eaf6ff', size: 220, spacing: 40 }),
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
          colour: '#7fd6ff',
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
      const doorY = 2.2 - height * 0.5 + 2.1;
      if (this.frontDoor) this.frontDoor.position.y = Math.max(1.4, doorY);
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

    // a doorway punched into the frontage, dark with a warm lip of light
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 4.4),
      new THREE.MeshBasicMaterial({
        color: 0x05080f,
        transparent: true,
        opacity: 0.86,
        depthWrite: false,
      }),
    );
    door.position.set(0, 2.1, -10.85);
    this.frontDoor = door;
    group.add(door);

    const doorLip = new THREE.Mesh(
      new THREE.PlaneGeometry(3.9, 0.16),
      new THREE.MeshBasicMaterial({
        color: 0xffd9a0,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    doorLip.position.set(0, 4.34, -10.8);
    group.add(doorLip);

    const doorGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 9),
      new THREE.MeshBasicMaterial({
        map: radialGlowTexture('rgba(255,214,160,0.5)', 'rgba(120,170,235,0.1)'),
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    doorGlow.position.set(0, 2.4, -10.7);
    group.add(doorGlow);

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
        color: 0x070d18,
        roughness: 0.55,
        metalness: 0.65,
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
          color: 0x1d4c78,
          transparent: true,
          opacity: 0.55,
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
        color: 0x63c8ff,
        transparent: true,
        opacity: 0.055,
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
          color: 0x7fe3ff,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
        }),
      ),
    );

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
          color: 0x9fd8ff,
        }),
      ),
    );

    // PORT wordmark hanging over the deck, facing down
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 2.75),
      new THREE.MeshBasicMaterial({
        map: labelTexture('PORT', { colour: '#dcf1ff', size: 200, spacing: 36 }),
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
        new THREE.BoxGeometry(2.05, 3.1, 0.34),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(ACCENT_DIM),
          emissive: accent.clone().multiplyScalar(0.08),
          roughness: 0.32,
          metalness: 0.85,
        }),
      );
      body.position.y = 1.75;
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
        new THREE.MeshStandardMaterial({ color: 0x0a1220, metalness: 0.9, roughness: 0.3 }),
      );
      pedestal.position.y = 0.11;
      mg.add(pedestal);

      const bar = new THREE.Mesh(
        new THREE.PlaneGeometry(1.7, 0.045),
        new THREE.MeshBasicMaterial({
          color: accent,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
        }),
      );
      bar.position.set(0, 3.32, 0.19);
      mg.add(bar);

      const glyph = new THREE.Mesh(
        new THREE.PlaneGeometry(1.05, 1.05),
        new THREE.MeshBasicMaterial({
          map: this.loader.load(glyphDataUrl(station.glyph, station.accent)),
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      glyph.position.set(0, 2.2, 0.22);
      mg.add(glyph);

      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(3.1, 0.55),
        new THREE.MeshBasicMaterial({
          map: labelTexture(station.label, { colour: '#dbe9ff', size: 62, spacing: 5 }),
          transparent: true,
          opacity: 0.92,
        }),
      );
      label.position.set(0, 0.72, 0.22);
      mg.add(label);

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

      group.add(mg);
      this.monoliths.push({
        station,
        group: mg,
        body,
        glyph,
        ring,
        label,
        baseY: 0,
      });
    });
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
    this.corridorStrip = undefined;
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

  private buildCorridor(station: Station) {
    this.clearCorridor();
    const exhibits = station.exhibits;
    const spacing = 7.4;
    const length = Math.max(24, exhibits.length * spacing + 12);
    this.corridorLength = length;
    this.corridorWalk = 0;
    this.corridorTarget = 0;

    const accent = new THREE.Color(station.accent);
    const group = this.corridorGroup;

    // floor + ceiling
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x06090f,
      roughness: 0.28,
      metalness: 0.8,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, length + 20), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -length / 2 + 6);
    group.add(floor);

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(9, length + 20),
      new THREE.MeshStandardMaterial({ color: 0x04060b, roughness: 0.9, metalness: 0.2 }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 4.4, -length / 2 + 6);
    group.add(ceiling);

    // side walls (dim, so the frames read)
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(length + 20, 4.6),
        new THREE.MeshStandardMaterial({
          color: 0x080c14,
          roughness: 0.85,
          metalness: 0.15,
          side: THREE.DoubleSide,
        }),
      );
      wall.rotation.y = side * (Math.PI / 2);
      wall.position.set(side * 4.6, 2.2, -length / 2 + 6);
      group.add(wall);
    }

    // guiding light strip down the middle
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, length + 12),
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, 0.02, -length / 2 + 6);
    this.corridorStrip = strip;
    group.add(strip);

    // ceiling lights
    for (let i = 0; i < Math.ceil(length / 6); i++) {
      const lamp = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.12),
        new THREE.MeshBasicMaterial({
          color: 0xbfe6ff,
          transparent: true,
          opacity: 0.5,
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
        new THREE.MeshStandardMaterial({ color: 0x0b1119, metalness: 0.7, roughness: 0.4 }),
      );
      fg.add(plate);

      const border = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(3.5, 2.5, 0.2)),
        new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.6 }),
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
            colour: '#dcebff',
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
        new THREE.PlaneGeometry(4.4, 3.2),
        new THREE.MeshBasicMaterial({
          map: this.glowTexture,
          transparent: true,
          opacity: 0.35,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      spotlight.position.set(0, 0, 0.05);
      fg.add(spotlight);

      group.add(fg);
      this.frames.push({ index: i, group: fg, plate: art, side, z });
    });

    // arrival plate
    const entryPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 0.9),
      new THREE.MeshBasicMaterial({
        map: labelTexture(station.label, { colour: '#e6f3ff', size: 60, spacing: 10 }),
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      }),
    );
    entryPlate.position.set(0, 3.2, 1.5);
    group.add(entryPlate);

    // exit portal at the far end — walk here to return to the deck
    const doorGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 7),
      new THREE.MeshBasicMaterial({
        map: radialGlowTexture('rgba(200,240,255,0.8)', 'rgba(60,150,230,0.14)'),
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
        color: 0x9fe4ff,
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

    const doorLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 0.5),
      new THREE.MeshBasicMaterial({
        map: labelTexture('KEMBALI KE DEK', { colour: '#cfe9ff', size: 42, spacing: 4 }),
        transparent: true,
        opacity: 0.85,
      }),
    );
    doorLabel.position.set(0, 4.55, -length - 1.4);
    group.add(doorLabel);

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
      monoliths: this.monoliths.length,
      frames: this.frames.length,
      hovered: this.hovered,
      camZ: Number(this.rig.position.z.toFixed(2)),
      camY: Number(this.rig.position.y.toFixed(2)),
      walk: Number(this.corridorWalk.toFixed(2)),
      progress: Number(this.getWalkProgress().toFixed(3)),
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
      if (this.frontDoor) {
        (this.frontDoor.material as THREE.MeshBasicMaterial).opacity = 0.86 * arrive * passThrough;
      }
    }
    if (this.phase === 'hub') this.updateHover();

    // monolith hover feedback
    for (const m of this.monoliths) {
      const isHovered = this.hovered === m.station.id;
      const target = isHovered ? 1 : 0;
      const mat = m.ring.material as THREE.MeshBasicMaterial;
      mat.opacity += (target * 0.9 - mat.opacity) * Math.min(1, delta * 10);
      m.group.position.y = THREE.MathUtils.damp(
        m.group.position.y,
        isHovered ? 0.32 : 0,
        6,
        delta,
      );
      m.label.position.y = 0.72 + Math.sin(t * 1.2 + m.baseY + m.group.position.x) * 0.03;
      const gm = m.glyph.material as THREE.MeshBasicMaterial;
      gm.opacity = 0.72 + Math.sin(t * 1.4 + m.group.position.z) * 0.12 + (isHovered ? 0.2 : 0);
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

    if (this.corridorStrip) {
      (this.corridorStrip.material as THREE.MeshBasicMaterial).opacity =
        0.28 + Math.sin(t * 1.6) * 0.12;
    }

    this.renderer.render(this.scene, this.camera);
  };
}
