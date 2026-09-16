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

export type Phase = 'entry' | 'hub' | 'warp' | 'corridor';

export type WorldOptions = {
  stations: Station[];
  reducedMotion?: boolean;
  onPhase?: (phase: Phase) => void;
  /** 0..1 progress through the entry flythrough. */
  onEntryProgress?: (progress: number) => void;
  /** Which monolith the pointer is over, or null. */
  onHover?: (stationId: string | null) => void;
  /**
   * The station the visitor is looking at, as they turn. On the deck the naming lives in
   * the chrome rather than floating over the works, so this is what keeps the room named.
   */
  onFacing?: (stationId: string | null) => void;
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
 * One painted band of light: a sliver of translucent colour that hangs in the black and is
 * drawn additively, the way a coated shard of glass throws its own spectrum onto a wall.
 * Never a sprite and never a dot — a broad, soft-edged streak, which is what reads as paint.
 */
type LightShard = {
  mesh: THREE.Object3D;
  material: THREE.MeshBasicMaterial;
  /**
   * The hot centre of the band. A soft additive glow rather than a drawn outline: an
   * outline on a translucent rectangle is what made the field read as a wireframe, and
   * light never has an edge.
   */
  core: THREE.MeshBasicMaterial;
  /** Its own copy of the streak, so the highlight can travel along the band. */
  flow: THREE.Texture;
  /** Where it sits when nothing stirs it, and how far it is allowed to wander. */
  origin: THREE.Vector3;
  drift: THREE.Vector3;
  rate: number;
  phase: number;
  baseOpacity: number;
  /** How fast the highlight slides along the band. */
  scroll: number;
  /** Local axis the shard leans on when the pointer sweeps close to it. */
  lean: THREE.Vector3;
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

/**
 * The deck's chrome, in one place.
 *
 * Colour used to be spent on the stations — every monolith carried its own tint — which
 * left the room busy and the work competing with its own label. The deck is now black,
 * champagne and nothing else, so the only colour in it comes off the hung pieces and the
 * light behind them. Station accents still exist, but only where they are information: in
 * the panels and the list view.
 */
const GOLD = 0x1a1a1a;
const GOLD_LEAF = 0x0f0f0f;

/**
 * The light paintings' palette. Four pigments, held back with low opacity so the wall
 * reads as coloured light rather than as a rainbow.
 */
const PIGMENTS = [0x63738a, 0x8b7180, 0x9b875f, 0x668b8a];

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

/**
 * One band of painted light.
 *
 * Plain white on transparent — the pigment comes from the material's own colour, so three
 * of these textures cover the whole field. `core` moves the bright line off centre, which
 * is what stops eighteen bands from looking like eighteen copies of one shape.
 */
function streakTexture(core: number) {
  const w = 512;
  const h = 128;
  return canvasTexture(w, h, (ctx) => {
    // A shard, not a smear: the pigment fills its shape and stops. Only the two ends
    // dissolve, so a band fades out of the dark rather than ending on a cut line.
    const across = ctx.createLinearGradient(0, 0, w, 0);
    across.addColorStop(0, 'rgba(255,255,255,0)');
    across.addColorStop(0.16, 'rgba(255,255,255,0.9)');
    across.addColorStop(0.84, 'rgba(255,255,255,0.9)');
    across.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = across;
    ctx.fillRect(0, 0, w, h);

    // Across the band's width: a broad, mostly even body with a soft shoulder at each
    // edge — the give of glass, not the falloff of a glow.
    ctx.globalCompositeOperation = 'destination-in';
    const along = ctx.createLinearGradient(0, 0, 0, h);
    along.addColorStop(0, 'rgba(255,255,255,0.06)');
    along.addColorStop(Math.max(0.06, core - 0.3), 'rgba(255,255,255,0.96)');
    along.addColorStop(Math.min(0.94, core + 0.3), 'rgba(255,255,255,0.96)');
    along.addColorStop(1, 'rgba(255,255,255,0.06)');
    ctx.fillStyle = along;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
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
  private focusedStationId: string | null = null;
  private deckTurnAt = 0;
  /**
   * Covers hung on the deck keep their own textures rather than joining `textureCache`:
   * leaving a wing releases every photograph in that cache, and the deck is still standing.
   */
  private deckCoverTextures: THREE.Texture[] = [];
  private font: DisplayFont | null = null;
  private frames: FrameRef[] = [];
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
  private disposed = false;
  /** Textures for the works hung in the approach — owned by the entry scene, not the corridor. */
  private entryArtTextures: THREE.Texture[] = [];

  /* the deck's own light: a pool under the room and a ring turning in it */
  private deckPool: THREE.Mesh | null = null;
  private deckRing: THREE.Mesh | null = null;

  /* the ambient light field */
  private readonly paintings = new THREE.Group();
  private shards: LightShard[] = [];
  private paintingTextures: THREE.Texture[] = [];
  private hasPointer = false;
  private readonly cursorWorld = new THREE.Vector3();
  private readonly cursorLocal = new THREE.Vector3();
  /** The station the visitor is looking at; only changes are reported to React. */
  private facing: string | null = null;

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

    // White gallery haze: distance should soften the walls without turning the space into
    // a black tunnel.
    this.scene.fog = new THREE.FogExp2(0xf7f7f4, 0.0045);

    this.font = loadDisplayFont();

    this.scene.add(this.entryGroup, this.hubGroup, this.corridorGroup);
    this.buildEnvironment();
    this.buildPaintings();
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
    this.paintings.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
    for (const tex of this.paintingTextures) tex.dispose();
    this.paintingTextures = [];
    for (const tex of this.textureCache.values()) tex.dispose();
    this.textureCache.clear();
    this.glowTexture.dispose();
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
    // Keep the architectural field explicitly white; photographs and black frames provide
    // the contrast, while the lightpaintings remain a restrained atmospheric layer.
    this.scene.background = new THREE.Color(0xf7f7f4);

    // White gallery lighting: black frames and real work carry the contrast.
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.25);
    key.position.set(6, 12, 8);
    this.scene.add(key);
    const rim = new THREE.PointLight(0xffffff, 10, 60, 2);
    rim.position.set(0, 7, 0);
    this.scene.add(rim);

    // There was a starfield here. It is the single strongest reason the room read as
    // outer space rather than as a gallery, so the ambient field is now only the light
    // paintings — see `buildPaintings`.
  }

  /**
   * The ambient field: light paintings.
   *
   * The room used to be filled with a particle constellation — twinkling points and
   * hairlines drawn between them — and it read as outer space, which is exactly what a
   * gallery must not read as. A light painting is the opposite idea: no dots, no lines,
   * just broad soft-edged bands of colour hanging in the dark, lit from nowhere, the way
   * coated glass throws its own spectrum onto a wall.
   *
   * They are made here from three canvas gradients and no image files at all, so the whole
   * field costs a few kilobytes and nothing has to be licensed or credited.
   */
  private buildPaintings() {
    // Three streak shapes, reused across every band: one long and thin like a thrown
    // highlight, one broad wash, one short and bright.
    const streaks = [
      streakTexture(1.0),
      streakTexture(0.55),
      streakTexture(0.34),
    ];
    this.paintingTextures = streaks;

    /*
     * Hung as compositions rather than as a scatter of bands.
     *
     * A real light painting is a fan of angled shards that overlap, so each piece holds
     * together as one composition when you turn to face it. Six of them are arranged
     * around the room at eye level and above, and the visitor meets one at a time.
     */
    const clusters = this.reduced ? 3 : 5;
    const barsPerCluster = this.reduced ? 2 : 3;
    const geometry = new THREE.PlaneGeometry(1, 1);

    for (let c = 0; c < clusters; c++) {
      const bearing = (c / clusters) * Math.PI * 2 + 0.35;
      const distance = 22 + Math.random() * 16;
      // Kept above the horizon line on purpose: the floor stays black, so the works sit in
      // a lit room rather than in a tank of colour.
      const centreY = 3.5 + Math.random() * 11;
      const tilt = Math.random() * Math.PI;
      // Staggered along the piece's own long axis too, so the cluster spreads out.
      const span = 14 + Math.random() * 12;

      for (let b = 0; b < barsPerCluster; b++) {
        const angle = tilt + b * 0.14 - barsPerCluster * 0.07;
        // Offsets run along the piece's short axis, which is what makes the bars overlap.
        const offset = (b - (barsPerCluster - 1) / 2) * 3.4;
        const along = (b - (barsPerCluster - 1) / 2) * span * 0.24;
        const origin = new THREE.Vector3(
          Math.cos(bearing) * distance + Math.cos(tilt) * along,
          centreY + Math.sin(angle) * offset + Math.sin(tilt) * along * 0.4,
          Math.sin(bearing) * distance + Math.sin(tilt) * along,
        );

        const shape = (c + b) % streaks.length;
        const length = (16 + Math.random() * 26) * (shape === 1 ? 1.5 : shape === 2 ? 0.7 : 1);
        const breadth = length * (shape === 1 ? 0.34 : shape === 2 ? 0.5 : 0.16);

        const material = new THREE.MeshBasicMaterial({
          map: streaks[shape],
          color: PIGMENTS[(c + b) % PIGMENTS.length],
          transparent: true,
          opacity: 0,
          blending: THREE.NormalBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });

        /*
         * Its own copy of the streak so its highlight can slide independently of the
         * others. Sharing one texture would move every band in lockstep, which reads as a
         * scrolling pattern rather than as light travelling through glass — and the copy
         * shares the same pixels, so it costs a texture upload and no new art.
         */
        const flow = streaks[shape].clone();
        flow.needsUpdate = true;
        // The band no longer fills its plate: it occupies part of it and slides back and
        // forth inside the remainder, which is what a highlight travelling along glass
        // looks like. Clamped edges keep the ends dissolving rather than tiling.
        flow.repeat.x = 0.68 + Math.random() * 0.24;
        this.paintingTextures.push(flow);
        material.map = flow;

        const core = new THREE.MeshBasicMaterial({
          map: this.glowTexture,
          color: PIGMENTS[(c + b) % PIGMENTS.length],
          transparent: true,
          opacity: 0,
          blending: THREE.NormalBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });

        /*
         * Each shard is a band of pigment with a hot core inside it. Where two bands cross
         * their brightness adds, exactly as it would on a wall — and because the core is a
         * radial falloff and not an outline, nothing in the field has a hard edge to read
         * as a grid.
         */
        const shard = new THREE.Group();
        const plate = new THREE.Mesh(geometry, material);
        plate.scale.set(length, breadth, 1);
        shard.add(plate);
        const heart = new THREE.Mesh(geometry, core);
        // Set inside the band, and short enough that the pigment still runs past it.
        heart.scale.set(length * 0.62, breadth * 0.74, 1);
        shard.add(heart);
        shard.position.copy(origin);
        // Held at the piece's own tilt and turned to face the room, never lying flat.
        shard.rotation.z = angle;
        this.paintings.add(shard);

        this.shards.push({
          mesh: shard,
          material,
          core,
          flow,
          origin,
          drift: new THREE.Vector3(
            THREE.MathUtils.randFloatSpread(1.6),
            THREE.MathUtils.randFloatSpread(2.4),
            THREE.MathUtils.randFloatSpread(1.6),
          ),
          rate: 0.03 + Math.random() * 0.05,
          phase: Math.random() * Math.PI * 2,
          baseOpacity: 0.24 + Math.random() * 0.14,
          scroll: 0.04 + Math.random() * 0.1,
          lean: new THREE.Vector3(
            THREE.MathUtils.randFloatSpread(1),
            THREE.MathUtils.randFloatSpread(1),
            THREE.MathUtils.randFloatSpread(1),
          ).normalize(),
        });
      }
    }

    // Wide, very faint colour washes in every direction, so the black is tinted rather
    // than merely empty — this is what makes the wall behind the work feel lit.
    const washes: [number, number, number][] = [
      [PIGMENTS[0], 0.045, 0],
      [PIGMENTS[1], 0.035, Math.PI * 0.66],
      [PIGMENTS[3], 0.03, Math.PI * 1.33],
    ];
    // The washes sit at head height so their glow lands behind the cards, not across them.
    for (const [pigment, opacity, angle] of washes) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(120, 70),
        new THREE.MeshBasicMaterial({
          map: this.glowTexture,
          color: pigment,
          transparent: true,
          opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      mesh.position.set(Math.cos(angle) * 42, 4, Math.sin(angle) * 42);
      mesh.rotation.y = -angle + Math.PI / 2;
      this.paintings.add(mesh);
    }

    this.scene.add(this.paintings);
  }

  /**
   * Advance the field. The paintings ride with the visitor, so they fill the approach, the
   * deck and a wing without any special casing — and each band turns to keep facing the
   * room, so it is never caught edge-on and never blinks out.
   */
  private updatePaintings(delta: number, t: number) {
    const total = this.shards.length;
    if (!total) return;

    this.paintings.position.copy(this.rig.position);

    let reaching = false;
    if (this.hasPointer) {
      this.ray.setFromCamera(this.ndc.set(this.pointer.x, this.pointer.y), this.camera);
      // Far enough out to sit among the bands rather than in front of the glass.
      this.ray.ray.at(26, this.cursorWorld);
      this.cursorLocal.copy(this.cursorWorld).sub(this.paintings.position);
      reaching = true;
    }

    const camX = this.camera.getWorldPosition(new THREE.Vector3()).x;
    const camZ = this.camera.getWorldPosition(new THREE.Vector3()).z;
    const lean = Math.min(1, delta * 1.6);

    for (const shard of this.shards) {
      const { mesh, material, core, flow, origin, drift, rate, phase, baseOpacity } = shard;
      const sway = Math.sin(t * rate + phase);
      const lift = Math.cos(t * rate * 0.7 + phase);

      mesh.position.set(
        origin.x + drift.x * sway,
        origin.y + drift.y * lift,
        origin.z + drift.z * sway,
      );

      // Face the room from wherever the visitor is standing, keeping the shard's own tilt.
      // The field's own yaw is subtracted because this rotation is local to it.
      mesh.rotation.y =
        Math.atan2(camX - mesh.position.x, camZ - mesh.position.z) - this.paintings.rotation.y;

      // The highlight walks along the band and back, so the field is never a still image.
      flow.offset.x = (1 - flow.repeat.x) * (0.5 + 0.5 * Math.sin(t * shard.scroll + phase * 1.7));

      // A slow breath in size, so the bands open and close like lit glass turning.
      const breath = 1 + 0.05 * lift;
      mesh.scale.set(breath, 1 + 0.08 * sway, 1);

      let brightness = baseOpacity + baseOpacity * 0.35 * sway;
      // A lit heart even when nothing is near, so every band has a hot centre.
      let coreTarget = brightness * 0.5;

      if (reaching) {
        const distance = mesh.position.distanceTo(this.cursorLocal);
        if (distance < 30) {
          const near = 1 - distance / 30;
          // The pigment closest to the pointer lifts, as if the light gathered there.
          brightness += near * 0.16;
          mesh.position.addScaledVector(shard.lean, near * 1.2 * lean * 6);
          // Only the bands the pointer is near get the full glare; near-squared keeps the
          // rest of the field from turning into one wall of light.
          coreTarget += near * near * 0.5;
        }
      }

      material.opacity += (brightness - material.opacity) * Math.min(1, delta * 1.1);
      core.opacity += (coreTarget - core.opacity) * Math.min(1, delta * 1.2);
    }

    // The whole field turns, very slowly. Standing still should still feel like being in a
    // room with light moving through it.
    this.paintings.rotation.y = t * 0.008;
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
        new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.82, roughness: 0.34 }),
      );
      piece.add(frame);

      const leaf = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(width + 0.2, height + 0.2, 0.1)),
        new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.72 }),
      );
      piece.add(leaf);

      const texture = this.loader.load(image.small, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
      });
      this.entryArtTextures.push(texture);

      const art = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({ map: texture, color: 0xffffff, side: THREE.DoubleSide }),
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
      new THREE.MeshBasicMaterial({
        color: 0xf7f7f4,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    group.add(floor);

    /*
     * The deck's own light.
     *
     * A hard black floor with a grid on it reads as a technical drawing. A warm pool
     * lying on the deck, with one slow gold ring turning inside it, is what makes the
     * room feel lit and occupied — and it is the same light the paintings are made of,
     * so the deck and the field agree.
     */
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(30, 64),
      new THREE.MeshBasicMaterial({
        map: radialGlowTexture('rgba(17,17,17,0.16)', 'rgba(17,17,17,0.02)'),
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.02;
    group.add(pool);
    this.deckPool = pool;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(9.2, 9.5, 96),
      new THREE.MeshBasicMaterial({
        color: GOLD_LEAF,
        transparent: true,
        opacity: 0.18,
        blending: THREE.NormalBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    group.add(ring);
    this.deckRing = ring;

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
          color: 0x161616,
          transparent: true,
          opacity: 0.16,
          blending: THREE.NormalBlending,
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
      mg.userData.homePosition = mg.position.clone();
      mg.userData.homeRotationY = mg.rotation.y;

      /*
       * One card, one size, every station — a landscape board the work fills.
       *
       * The board used to be a tall slab with a small picture inside it, its edges tinted
       * with the station's own colour, and a floating name plate in front of the whole
       * thing. The plate covered the art, the tint made a mixed wall look busy, and the
       * slab said nothing the work was not already saying. What is left is the card, the
       * gold leaf around it, and the piece.
       */
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(4.9, 3.65, 0.26),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(ACCENT_DIM),
          emissive: new THREE.Color(GOLD).multiplyScalar(0.03),
          roughness: 0.52,
          metalness: 0.55,
        }),
      );
      body.position.y = 2.05;
      body.userData.stationId = station.id;
      mg.add(body);

      const edgeMaterial = new THREE.LineBasicMaterial({
        color: GOLD_LEAF,
        transparent: true,
        opacity: 0.42,
      });
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(body.geometry),
        edgeMaterial,
      );
      edges.position.copy(body.position);
      mg.add(edges);

      const pedestal = new THREE.Mesh(
        new THREE.BoxGeometry(4.35, 0.24, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x121110, metalness: 0.9, roughness: 0.3 }),
      );
      pedestal.position.y = 0.12;
      mg.add(pedestal);

      // The pool of light the card stands in, which the work lifts when it is hovered.
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.5, 1.6, 40),
        new THREE.MeshBasicMaterial({
          color: GOLD,
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
        edgeMaterial,
        hot: 0,
      });
    });

    // Start on the first substantial gallery programme rather than the institutional
    // profile, so the visitor enters on an artwork instead of an empty-looking frontage.
    this.setFocusedMonolith(stations[1]?.id ?? stations[0]?.id ?? null);
  }

  /** Keep one room in view at a time; changing rooms is an intentional arrival. */
  private setFocusedMonolith(stationId: string | null) {
    this.focusedStationId = stationId;
    for (const monolith of this.monoliths) {
      const homePosition = monolith.group.userData.homePosition as THREE.Vector3 | undefined;
      const homeRotationY = monolith.group.userData.homeRotationY as number | undefined;
      const selected = stationId === null || monolith.station.id === stationId;
      if (selected && stationId !== null) {
        // Bring the chosen work to the visitor instead of making them search a ring.
        monolith.group.position.set(0, 0, -HUB_RADIUS);
        monolith.group.rotation.y = 0;
      } else if (homePosition) {
        monolith.group.position.copy(homePosition);
        if (homeRotationY !== undefined) monolith.group.rotation.y = homeRotationY;
      }
      monolith.group.visible = selected;
    }
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
   * Mount one work on a station's card: the piece, its true shape, and the light it sits in.
   *
   * The card itself is the monolith's own board, so the deck has one frame design and the
   * wings share it. The work is mounted, not cropped — it keeps its true proportions and is
   * centred in the same opening on every station, because stretching a poster of one shape
   * into a frame of another is the one thing that would give the whole wall away as a
   * mock-up. Uniform cards, unique works.
   */
  private hangDeckCover(station: Station, parent: THREE.Group) {
    const image = deckCovers.get(station.id);
    if (!image) return;

    const width = 4.42;
    const height = 3.18;
    const openingWidth = 4.08;
    const openingHeight = 2.76;
    const centreY = 2.8;

    /*
     * The monolith group is turned so that its local +Z points radially *outward* — away
     * from the visitor standing on the deck. A flat work mounted at +Z would therefore face
     * the dark, and read mirrored from behind. Everything hangs on a mounting turned to face
     * the deck, so the piece and its frame are built the obvious way round.
     */
    const mount = new THREE.Group();
    mount.rotation.y = Math.PI;
    parent.add(mount);

    // A soft champagne spill around the board, so each work reads as lit rather than
    // pasted on — the station's own colour no longer touches the deck.
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: GOLD,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });      const halo = new THREE.Mesh(new THREE.PlaneGeometry(width + 0.8, height + 0.86), haloMaterial);
    halo.position.set(0, centreY, 0.16);
    mount.add(halo);

    // A unit plane, scaled once the piece's real shape is known. It sits just proud of the
    // board's front face, which is at +0.13 once the mount is turned to face the deck.
    const artMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const art = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), artMaterial);
    art.position.set(0, centreY, 0.23);
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

    return { art, haloMaterial };
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
      color: 0xe8e8e4,
      roughness: 0.42,
      metalness: 0.18,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, length + 20), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -length / 2 + 6);
    group.add(floor);

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(9, length + 20),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0.08 }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 4.4, -length / 2 + 6);
    group.add(ceiling);

    // side walls (dim, so the frames read)
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(length + 20, 4.6),
        new THREE.MeshStandardMaterial({
          color: 0xf5f5f2,
          roughness: 0.84,
          metalness: 0.08,
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
            color: 0x151515,
            transparent: true,
            opacity: detail.opacity * 0.75,
          }),
        ),
      );
    }

    // ceiling lights
    for (let i = 0; i < Math.ceil(length / 6); i++) {
      const lamp = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.12),
        new THREE.MeshBasicMaterial({
          color: 0x111111,
          transparent: true,
          opacity: 0.22,
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
        new THREE.MeshStandardMaterial({ color: 0x121212, metalness: 0.72, roughness: 0.38 }),
      );
      fg.add(plate);

      // gold leaf around the frame
      const border = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(3.56, 2.56, 0.2)),
        new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.72 }),
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
    if (this.focusedStationId) this.aimAtStation(this.focusedStationId);
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
      visibleMonoliths: this.monoliths.filter((monolith) => monolith.group.visible).length,
      paintings: {
        shards: this.shards.length,
        visible: this.shards.filter((s) => s.material.opacity > 0.001).length,
        opacity: this.shards.length
          ? +(this.shards.reduce((sum, s) => sum + s.material.opacity, 0) / this.shards.length).toFixed(3)
          : 0,
      },
      facing: this.facing,
      focusedStation: this.focusedStationId,
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
    this.setFocusedMonolith(stationId);
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
    if (this.phase === 'hub') {
      if (Math.abs(event.deltaY) < 10) return;
      const now = performance.now();
      if (now - this.deckTurnAt < 420) return;
      this.deckTurnAt = now;
      const current = this.opts.stations.findIndex((station) => station.id === this.focusedStationId);
      const step = event.deltaY > 0 ? 1 : -1;
      const next = (current + step + this.opts.stations.length) % this.opts.stations.length;
      const station = this.opts.stations[next];
      if (station) {
        this.aimAtStation(station.id);
        this.opts.onStationSelect?.(station.id);
      }
      return;
    }
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
      const bodies = this.monoliths.filter((m) => m.group.visible).map((m) => m.body);
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
        this.monoliths.filter((m) => m.group.visible).map((m) => m.body),
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
    this.updatePaintings(delta, t);
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

    // The deck's light: one ring turning slowly, and a pool that breathes and leans
    // towards the pointer, so standing still on the deck is never standing in a still
    // image.
    if (this.deckRing) {
      this.deckRing.rotation.z = t * 0.045;
      const ringMat = this.deckRing.material as THREE.MeshBasicMaterial;
      ringMat.opacity = 0.12 + 0.06 * Math.sin(t * 0.22);
    }
    if (this.deckPool) {
      const poolMat = this.deckPool.material as THREE.MeshBasicMaterial;
      let target = 0.42 + 0.1 * Math.sin(t * 0.16);
      if (this.hasPointer && (this.phase === 'hub' || this.phase === 'warp')) {
        // The pool drifts a little towards wherever the visitor is looking.
        this.deckPool.position.x = THREE.MathUtils.damp(this.deckPool.position.x, this.pointer.x * 3.2, 1.6, delta);
        this.deckPool.position.z = THREE.MathUtils.damp(this.deckPool.position.z, -this.pointer.y * 3.2, 1.6, delta);
        target += 0.1;
      }
      poolMat.opacity = THREE.MathUtils.damp(poolMat.opacity, target, 2, delta);
    }

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

    // Which station is in front of the visitor, reported only when it changes: this is
    // what names the room now that the naming is not written across the artworks.
    if (this.phase === 'hub' || this.phase === 'warp') {
      const forward = this.camera.getWorldDirection(new THREE.Vector3());
      let bestId: string | null = null;
      let bestDot = -Infinity;
      for (const monolith of this.monoliths) {
        if (!monolith.group.visible) continue;
        const dx = monolith.group.position.x - this.rig.position.x;
        const dz = monolith.group.position.z - this.rig.position.z;
        const length = Math.hypot(dx, dz) || 1;
        const dot = (dx / length) * forward.x + (dz / length) * forward.z;
        if (dot > bestDot) {
          bestDot = dot;
          bestId = monolith.station.id;
        }
      }
      if (bestId !== this.facing) {
        this.facing = bestId;
        this.opts.onFacing?.(bestId);
      }
    } else if (this.facing) {
      this.facing = null;
      this.opts.onFacing?.(null);
    }

    // The hung works answer the pointer the same way the lettering does: a still, dim wall
    // that lifts the one you are pointing at, so the deck tells you what you are about to open.
    if (this.phase === 'hub' || this.phase === 'warp') {
      for (const monolith of this.monoliths) {
        if (!monolith.group.visible) continue;
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
