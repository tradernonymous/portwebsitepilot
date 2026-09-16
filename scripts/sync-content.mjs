#!/usr/bin/env node
/**
 * PORT content sync.
 *
 * Pulls the live content of https://portipoh.com (WordPress REST API) and bakes it
 * into this repo so the 3D experience stays fast, static and API-key free:
 *
 *   src/content/site.json   -> structured text (pages, programs, staff, images index)
 *   public/media/*.jpg|png  -> downloaded photographs used as gallery textures
 *
 * Usage:  npm run sync:content            (incremental - keeps files already downloaded)
 *         npm run sync:content -- --fresh  (re-download everything)
 *
 * Safe to re-run at any time: the site never reads portipoh.com at runtime.
 */

import { mkdir, writeFile, access, stat, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MEDIA_DIR = path.join(ROOT, 'public', 'media');
const RAW_DIR = path.join(ROOT, '.cache', 'media');
const CONTENT_DIR = path.join(ROOT, 'src', 'content');

/** Master size kept for the gallery corridor + exhibit heroes. */
const LG_WIDTH = 1400;
/** Small size for grids, thumbnails and HUD previews. */
const SM_WIDTH = 560;

const API = 'https://portipoh.com/wp-json/wp/v2';
const ORIGIN = 'https://portipoh.com';
const FRESH = process.argv.includes('--fresh');

/** Soft ceilings so the repo (and the Railway build) stays small. */
const MAX_PAGE_IMAGES = 150;
const MIN_WIDTH = 700;
/** Portraits / posters are legitimately small, so they get their own, lower bar. */
const MIN_WIDTH_SMALL = 340;
const MAX_LIBRARY_EXTRAS = 45;
/** Library items we want even though no page embeds them directly. */
const LIBRARY_KEYWORDS = /(bod|pengarah|kakitangan|jawatankuasa|carta|organisasi|staf|poster|ims|hsdr|buku|direktori|pameran|logo|tourism|visitperak|port_white)/i;
const MAX_BYTES = 6 * 1024 * 1024;
const CONCURRENCY = 6;

const log = (...a) => console.log('[sync]', ...a);

async function api(pathname) {
  const url = pathname.startsWith('http') ? pathname : `${API}${pathname}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'portwebsitepilot-content-sync/1.0' },
      });
      if (res.status === 400 && res.headers.get('x-wp-totalpages')) return [];
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === 3) throw new Error(`${url} -> ${err.message}`);
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
}

async function apiAll(pathname, perPage = 100, maxPages = 12) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const joined = pathname.includes('?') ? '&' : '?';
    const batch = await api(`${pathname}${joined}per_page=${perPage}&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < perPage) break;
  }
  return out;
}

/* ------------------------------------------------------------------ text utils */

const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#039;': "'", '&#39;': "'",
  '&nbsp;': ' ', '&hellip;': '…', '&mdash;': '—', '&ndash;': '–', '&rsquo;': '’',
  '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”', '&minus;': '─', '&oacute;': 'ó',
};

function decodeEntities(input = '') {
  let s = input;
  for (const [k, v] of Object.entries(ENTITIES)) s = s.split(k).join(v);
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
  s = s.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
  return s;
}

/** Strip Elementor markup / inline CSS down to readable paragraphs. */
function toPlainText(html = '') {
  let s = html;
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  // keep block boundaries readable
  s = s.replace(/<\/(p|div|h[1-6]|li|section|br)>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  s = s.replace(/[ \t\u00a0]+/g, ' ');
  s = s
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
  // drop Elementor CSS leakage / duplicate boilerplate lines
  s = s
    .split('\n')
    .filter((line) => !/^[.#@][\w\-.:,>\s()\[\]{}="'*+~$#%]*$/.test(line))
    .join('\n');
  return s.trim();
}

function toParagraphs(plain) {
  return plain
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p.length > 2 && !/^https?:\/\/\S+$/.test(p));
}

/** All <img src> inside Elementor content, in document order, de-duplicated. */
function extractImages(html = '') {
  const urls = [];
  const re = /<img[^>]+?(?:data-src|src)=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = decodeEntities(m[1]);
    if (!raw || raw.startsWith('data:')) continue;
    if (!/\.(jpe?g|png|webp|gif)(\?|$)/i.test(raw)) continue;
    urls.push(raw.startsWith('http') ? raw : `${ORIGIN}${raw}`);
  }
  return [...new Set(urls)];
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}

function basename(url) {
  try {
    return path.basename(new URL(url).pathname);
  } catch {
    return url.split('/').pop() ?? 'image';
  }
}

function slugify(s = '') {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

function isLogoish(name = '', title = '') {
  const hay = `${name} ${title}`.toLowerCase();
  return /(logo|icon|favicon|cropped|placeholder|avatar|badge|watermark|banner-ad|spinner|sprite)/.test(
    hay,
  );
}

function pickSize(media, prefer = [1600, 1200, 1024, 768], minWidth = MIN_WIDTH) {
  const details = media?.media_details;
  if (!details) return null;
  const sizes = details.sizes ?? {};
  const candidates = Object.values(sizes)
    .filter((s) => s && s.source_url && typeof s.width === 'number')
    .sort((a, b) => b.width - a.width);

  for (const target of prefer) {
    const match = candidates.find((c) => c.width <= target && c.width >= minWidth);
    if (match) return { url: match.source_url, width: match.width, height: match.height };
  }
  // fall back to the untouched original when it is big enough
  if (typeof details.width === 'number' && details.width >= minWidth) {
    return {
      url: details.source_url ?? media.source_url,
      width: details.width,
      height: details.height,
    };
  }
  // last resort: the widest variant we do have (icons etc. are filtered earlier)
  const widest = candidates.find((c) => c.width >= minWidth) ?? candidates[0];
  return widest ? { url: widest.source_url, width: widest.width, height: widest.height } : null;
}

/* ------------------------------------------------------------------ downloader */

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function downloadRaw(url, dest) {
  if (!FRESH && (await exists(dest))) {
    const s = await stat(dest);
    if (s.size > 0) return;
  }
  const res = await fetch(url, {
    headers: { 'user-agent': 'portwebsitepilot-content-sync/1.0', referer: `${ORIGIN}/` },
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len && len > MAX_BYTES) throw new Error(`too large (${Math.round(len / 1024)}KB)`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) throw new Error(`too large (${Math.round(buf.byteLength / 1024)}KB)`);
  await writeFile(dest, buf);
}

/**
 * Turn one downloaded original into the two WebP derivatives the site actually uses.
 * Keeps `public/media` around ~10x smaller than the raw WordPress uploads.
 */
async function processImage(rawPath, outBase) {
  const lgPath = path.join(MEDIA_DIR, `${outBase}-lg.webp`);
  const smPath = path.join(MEDIA_DIR, `${outBase}-sm.webp`);

  const lg = await sharp(rawPath, { failOn: 'none' })
    .rotate()
    .resize({ width: LG_WIDTH, height: LG_WIDTH, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 76, effort: 5 })
    .toFile(lgPath);

  const sm = await sharp(rawPath, { failOn: 'none' })
    .rotate()
    .resize({ width: SM_WIDTH, height: SM_WIDTH, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 72, effort: 5 })
    .toFile(smPath);

  return {
    large: `/media/${path.basename(lgPath)}`,
    small: `/media/${path.basename(smPath)}`,
    width: lg.width,
    height: lg.height,
    bytes: lg.size + sm.size,
  };
}

/* ------------------------------------------------------------------ main */

async function main() {
  await mkdir(MEDIA_DIR, { recursive: true });
  await mkdir(CONTENT_DIR, { recursive: true });

  log('fetching pages …');
  const rawPages = await apiAll(
    '/pages?_fields=id,slug,title,content,excerpt,parent,menu_order,date,modified,featured_media,link',
  );
  log(`  ${rawPages.length} pages`);

  log('fetching media library …');
  const rawMedia = await apiAll('/media?_fields=id,title,source_url,media_details,alt_text,caption');
  log(`  ${rawMedia.length} media items`);

  log('fetching custom post types …');
  const [terkini, portfolio] = await Promise.all([
    apiAll('/programterkini?_fields=id,slug,title,content,excerpt,date,link').catch(() => []),
    apiAll('/portfolio?_fields=id,slug,title,content,excerpt,date,link').catch(() => []),
  ]);
  log(`  ${terkini.length} program-terkini, ${portfolio.length} portfolio`);

  /* ---- index the media library by filename so we can map content <img> -> best size ---- */
  const mediaById = new Map(rawMedia.map((m) => [m.id, m]));
  const mediaByBasename = new Map();
  for (const m of rawMedia) {
    const bn = basename(m.source_url);
    if (!mediaByBasename.has(bn)) mediaByBasename.set(bn, m);
  }

  /* ---- normalise pages ---- */
  const pages = rawPages.map((p) => {
    const html = p.content?.rendered ?? '';
    const plain = toPlainText(html);
    const paras = toParagraphs(plain);
    return {
      id: p.id,
      slug: p.slug,
      title: decodeEntities(p.title?.rendered ?? ''),
      parent: p.parent ?? 0,
      order: p.menu_order ?? 0,
      date: (p.date ?? '').slice(0, 10),
      modified: (p.modified ?? '').slice(0, 10),
      link: p.link,
      featuredMedia: p.featured_media ?? 0,
      excerpt: toParagraphs(toPlainText(p.excerpt?.rendered ?? ''))[0] ?? '',
      paragraphs: paras,
      contentImages: extractImages(html),
    };
  });

  const pageById = new Map(pages.map((p) => [p.id, p]));
  const childrenOf = (id) =>
    pages.filter((p) => p.parent === id).sort((a, b) => a.order - b.order || a.id - b.id);

  /* ---- build the candidate image list, in priority order ---- */
  /** @type {{sourceUrl:string, pageIds:number[], title:string, width:number, height:number, kind:string}[]} */
  const candidates = [];
  const seen = new Set();

  const pushCandidate = (sourceUrl, { title = '', width = 0, height = 0, kind, pageId } = {}) => {
    const key = normalizeUrl(sourceUrl);
    if (seen.has(key)) {
      if (pageId) candidates.find((c) => c.key === key)?.pageIds.push(pageId);
      return;
    }
    seen.add(key);
    const entry = {
      key,
      sourceUrl,
      title: decodeEntities(title) || basename(sourceUrl),
      width,
      height,
      kind: kind ?? 'content',
      pageIds: pageId ? [pageId] : [],
    };
    candidates.push(entry);
  };

  // 1. images actually used on a page, resolved to the best available size
  for (const page of pages) {
    for (const url of page.contentImages) {
      const lib = mediaByBasename.get(basename(url));
      const size = lib ? pickSize(lib) : null;
      const chosen = size ?? { url, width: 0, height: 0 };
      if (isLogoish(basename(chosen.url), lib?.title?.rendered ?? '')) continue;
      if (chosen.width && chosen.width < MIN_WIDTH) continue;
      pushCandidate(chosen.url, {
        title: lib?.title?.rendered ?? page.title,
        width: chosen.width,
        height: chosen.height,
        kind: 'page',
        pageId: page.id,
      });
    }
  }

  // 2. featured images
  for (const page of pages) {
    const media = mediaById.get(page.featuredMedia);
    if (!media) continue;
    const size = pickSize(media);
    if (!size || isLogoish(basename(size.url), media.title?.rendered ?? '')) continue;
    pushCandidate(size.url, {
      title: media.title?.rendered ?? page.title,
      width: size.width,
      height: size.height,
      kind: 'featured',
      pageId: page.id,
    });
  }

  // 3. library items no page embeds (board portraits, posters, partner logos)
  const libraryPool = rawMedia
    .filter((m) => !isLogoish(basename(m.source_url), m.title?.rendered ?? ''))
    .filter((m) => {
      const title = m.title?.rendered ?? '';
      const isNamed = LIBRARY_KEYWORDS.test(`${basename(m.source_url)} ${title}`);
      const width = m.media_details?.width ?? 0;
      return isNamed || width >= MIN_WIDTH;
    })
    .sort((a, b) => b.id - a.id);

  let libraryExtras = 0;
  for (const m of libraryPool) {
    if (libraryExtras >= MAX_LIBRARY_EXTRAS) break;
    const wide = (m.media_details?.width ?? 0) >= MIN_WIDTH;
    const named = LIBRARY_KEYWORDS.test(`${basename(m.source_url)} ${m.title?.rendered ?? ''}`);
    if (!wide && !named) continue;
    const size = pickSize(m, [1600, 1200, 1024, 768], MIN_WIDTH_SMALL);
    if (!size || size.width < MIN_WIDTH_SMALL) continue;
    const before = candidates.length;
    pushCandidate(size.url, {
      title: m.title?.rendered ?? '',
      width: size.width,
      height: size.height,
      kind: 'library',
    });
    if (candidates.length > before) libraryExtras++;
  }

  // de-duplicate the "key" lookup used above
  for (const c of candidates) c.key = normalizeUrl(c.sourceUrl);
  const unique = [];
  const seenFinal = new Set();
  for (const c of candidates) {
    if (seenFinal.has(c.key)) continue;
    seenFinal.add(c.key);
    unique.push(c);
  }

  // Page photography takes the bulk of the budget; library extras get their own reserved
  // slots so they can never be crowded out by the page images that come first.
  const selected = [
    ...unique.filter((c) => c.kind !== 'library').slice(0, MAX_PAGE_IMAGES),
    ...unique.filter((c) => c.kind === 'library').slice(0, MAX_LIBRARY_EXTRAS),
  ];
  if (FRESH) await rm(RAW_DIR, { recursive: true, force: true });
  await mkdir(RAW_DIR, { recursive: true });
  log(`processing ${selected.length} images …`);

  const images = [];
  let failures = 0;
  const queue = [...selected.entries()];

  async function worker() {
    while (queue.length) {
      const [index, c] = queue.shift();
      const ext = (basename(c.sourceUrl).match(/\.(jpe?g|png|webp)$/i)?.[1] ?? 'jpg').toLowerCase();
      const outBase = `port-${String(index + 1).padStart(3, '0')}-${slugify(c.title) || 'karya'}`;
      const rawPath = path.join(RAW_DIR, `${outBase}.${ext}`);
      try {
        await downloadRaw(c.sourceUrl, rawPath);
        const out = await processImage(rawPath, outBase);
        images.push({
          large: out.large,
          small: out.small,
          width: out.width,
          height: out.height,
          bytes: out.bytes,
          caption: c.title,
          kind: c.kind,
          sourceUrl: c.sourceUrl,
          pageIds: [...new Set(c.pageIds)],
        });
        if (images.length % 25 === 0) log(`  ${images.length}/${selected.length}`);
      } catch (err) {
        failures++;
        log(`  skipped ${basename(c.sourceUrl)}: ${err.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const totalMb = (images.reduce((n, i) => n + i.bytes, 0) / 1024 / 1024).toFixed(1);
  log(`  done: ${images.length} images (${totalMb} MB total), ${failures} skipped`);

  images.sort((a, b) => a.large.localeCompare(b.large));

  /* ---- attach image references back onto pages ---- */
  const imagesByPage = new Map();
  for (const img of images) {
    for (const pid of img.pageIds) {
      if (!imagesByPage.has(pid)) imagesByPage.set(pid, []);
      imagesByPage.get(pid).push({ small: img.small, large: img.large, caption: img.caption });
    }
  }
  for (const page of pages) {
    page.images = imagesByPage.get(page.id) ?? [];
    delete page.contentImages;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: ORIGIN,
    counts: { pages: pages.length, media: rawMedia.length, images: images.length },
    pages: pages.map((p) => ({
      ...p,
      children: childrenOf(p.id).map((c) => ({ id: c.id, slug: c.slug, title: c.title })),
    })),
    terkini: terkini.map((t) => ({
      id: t.id,
      slug: t.slug,
      title: decodeEntities(t.title?.rendered ?? ''),
      date: (t.date ?? '').slice(0, 10),
      link: t.link,
      paragraphs: toParagraphs(toPlainText(t.content?.rendered ?? '')).slice(0, 6),
      images: extractImages(t.content?.rendered ?? '')
        .map((u) => images.find((i) => normalizeUrl(i.sourceUrl) === normalizeUrl(u)))
        .filter(Boolean)
        .map((i) => ({ small: i.small, large: i.large, caption: i.caption })),
    })),
    portfolio: portfolio.map((t) => ({
      id: t.id,
      slug: t.slug,
      title: decodeEntities(t.title?.rendered ?? ''),
      date: (t.date ?? '').slice(0, 10),
      paragraphs: toParagraphs(toPlainText(t.content?.rendered ?? '')).slice(0, 4),
    })),
    images,
  };

  await writeFile(path.join(CONTENT_DIR, 'site.json'), `${JSON.stringify(payload, null, 2)}\n`);
  log(`wrote src/content/site.json (${pages.length} pages, ${images.length} images)`);

  /* ---- prune derivatives left behind by earlier runs ----
     Image filenames are index-based, so if the selection order ever shifts, a re-run
     writes the same slot under a new name and the old file becomes dead weight in the
     repo and the deploy. Only files matching our own naming pattern are ever removed,
     so anything placed in public/media by hand is safe. */
  const produced = new Set(
    images.flatMap((i) => [path.basename(i.large), path.basename(i.small)]),
  );
  const OWNED_BY_SYNC = /^port-\d{3}-.*-(lg|sm)\.webp$/;
  let pruned = 0;
  let prunedBytes = 0;
  for (const file of await readdir(MEDIA_DIR)) {
    if (!OWNED_BY_SYNC.test(file) || produced.has(file)) continue;
    try {
      const info = await stat(path.join(MEDIA_DIR, file));
      await rm(path.join(MEDIA_DIR, file), { force: true });
      prunedBytes += info.size;
      pruned++;
    } catch {
      // already gone; nothing to do
    }
  }
  if (pruned) {
    log(`pruned ${pruned} stale derivatives (${(prunedBytes / 1024 / 1024).toFixed(2)} MB)`);
  }

  // A short index so a human can eyeball what came through.
  const report = pages
    .map(
      (p) =>
        `#${p.id} parent=${p.parent} ${p.title}\n    imgs=${p.images.length} paras=${p.paragraphs.length} :: ${p.paragraphs[0]?.slice(0, 110) ?? ''}`,
    )
    .join('\n');
  await writeFile(path.join(CONTENT_DIR, 'site-index.txt'), `${report}\n`);
  log('wrote src/content/site-index.txt');
}

main().catch((err) => {
  console.error('[sync] FAILED:', err);
  process.exit(1);
});
