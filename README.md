# PORT — People Of Remarkable Talents

A light gallery for **PORT (People Of Remarkable Talents)**, the brand of Kampung Karyawan
Amanjaya, Perak's state-funded cultural agency.

White walls, a black dark room, and light painted across both. A visitor comes through the
door of PORT's real building, walks a corridor of rooms joined by a single line of light, and
steps into each room to see its works. Everything shown is PORT's own material, synced from
`portipoh.com`; every effect — the light paintings, the prism shards, the plates — is
generated in code, so there is nothing borrowed and nothing to license.

Bahasa Melayu is the house language; the whole interface and all hand-written content also
read in English (the **BM / EN** switch, remembered per visitor).

---

## What a visitor does

1. **The gate.** A dark room with PORT's festival film on the wall, prism light across it and
   a light trail following the pointer. The wordmark is set in the logo's own lettering.
   *SENI* / *ART* and the **Masuk ke PORT** button glow through the spectrum.
2. **Walking in.** The camera moves into PORT's lobby towards its doorway, the prism light
   ignites, and the doorway opens in white onto the gallery.
3. **The screening room (hero).** *PORTCAST & VIDEO* leads the hall: its film plays full-bleed
   and its programmes — Performances, Symposium, PORTCAST, Highlights — are titles that open
   straight onto that shelf.
4. **The main corridor.** Scrolling walks along the other seven rooms, hung on one continuous
   line of light. The line lights up to where you are, and each room's node glows as you reach
   it. On a wide screen the corridor slides sideways; on a phone the rooms stack and the line
   runs down beside them. Click a room's title or picture to go in.
5. **A room.** Its name at a light-painted door, then the works on the wall, then the rooms on
   either side joined by light. Programme, residency and exhibition rooms also offer
   **Jalan dalam 3D / Walk in 3D** — a walkable gallery corridor, loaded only when asked for.
6. **A work.** Opens in a reader: the piece on the left (shown whole, never enlarged past its
   own size), the wall text on the right, thumbnails beneath, and the neighbouring works by
   name. `←` `→` move between works, `Esc` closes.
7. **The text-only view.** The list icon at the top right shows the entire site as a plain
   document — for screen readers, search engines and anyone who prefers reading.

Every room, work, shelf and 3D walk has its own address (`#/s/program/2`,
`#/s/video/filem/simposium`, `#/s/residensi/jalan`), so any of them can be shared on WhatsApp.
A shared link skips the gate; so does a reload once a visitor has come in.

---

## Running it on your own machine

You need **Node.js 20 or newer** ([nodejs.org](https://nodejs.org) — the LTS button).

```bash
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Live preview while you work. |
| `npm run build` | Builds the production version into `dist/`. |
| `npm start` | Serves the production build (run `build` first). |
| `npm run sync:content` | Re-reads portipoh.com and refreshes content + photos. |
| `npm run typecheck` | Checks for mistakes without building. |

---

## Changing things

### The words

- **Malay copy** — `src/content/index.ts`. Each room is one block in `rawStations`:
  `label`, `tagline`, `intro`, `sections` and `exhibits`. Calls like `body(71, 0, 2)` pull
  paragraphs from the synced site ("page 71, from paragraph 0, take 2"); replace them with a
  plain list of sentences to write your own.
- **English copy** — `src/content/en.ts`, keyed by the same ids. Anything without an English
  entry stays in Malay rather than disappearing; long synced texts are marked in the reader
  as original Bahasa Melayu.
- **Interface words** (buttons, labels, the guide) — `src/content/i18n.ts`, both languages
  side by side.

### The photographs, and why some works show a light plate

Photos live in `public/media/` as `.webp`, produced by the sync. The content layer enforces
three rules so the gallery never looks cheap:

1. A general event photograph is never presented as a specific work.
2. Each image hangs on one work only, across the whole site.
3. A file too small to hold a wall (under 480px) is left out rather than stretched.

A photo whose file name names a person or project (e.g. `hafizuddin_3`) only hangs on the work
that names them. A work left with no photograph gets its own **light plate** — a light painting
exposed once for that work, always the same picture. To give a work a real photograph, add it
to that work's `images` list in `src/content/index.ts`.

### The building photographs (the walk in)

See `src/assets/README.md`. In short: `src/assets/entrance.*` is the lobby the camera walks
through (already supplied), and a street-front photo dropped at `src/assets/building.*` is added
as the first stage of the walk automatically. **Use large photos (2400px wide or more)** — the
camera moves in close.

### The films

`src/content/videos.ts`. Append an upload to the programme it belongs to; the hero, the
screening room and the text-only view all read from there. `featuredVideo` is the film on the
gate and in the hero. Videos must have embedding allowed on YouTube.

### Colours and type

`src/styles/tokens.css` holds the palette: white walls, the black dark room, and the light
spectrum (cyan, violet, magenta, amber, lime) used only for strokes and glows. Each room's
`accent` in `src/content/index.ts` tints its door and nodes. Fonts: **Quicksand** for the PORT
wordmark (matching the logo), **Chakra Petch** for headings, **Sora** for text and
**JetBrains Mono** for the HUD labels — all free from Google Fonts.

### The Google Map

The contact room shows a styled placeholder. To show the real map, open Google Maps, find
PORT Ipoh, choose **Share → Embed a map**, copy the `src="..."` address and paste it at
`googleMapEmbedUrl` near the bottom of `src/content/index.ts`.

---

## Refreshing content from portipoh.com

```bash
npm run sync:content
npm run sync:content -- --fresh   # re-download every image
```

Then surface anything new in `src/content/index.ts` (and its English in `en.ts`).

---

## Putting it online (Railway)

The repo is configured for Railway (`railway.json` + `Dockerfile`). Pushing to `main`
redeploys an existing project. For a new project: **railway.app → New Project → Deploy from
GitHub repo → portwebsitepilot**, wait for the `/healthz` check, then **Settings → Networking →
Generate Domain** (and optionally add `portipoh.com` as a custom domain via the CNAME Railway
shows). Railway bills usage after the trial credit — roughly US$5/month for a site like this;
set a spend limit. The same repo deploys free to Cloudflare Pages or Netlify: build command
`npm run build`, output folder `dist`.

---

## Things worth knowing

- **No API keys, no tracking.** Fonts from Google Fonts; everything else is local.
- **Performance.** Effects are built to stay smooth: light paintings stop drawing when off
  screen; the prism light is painted once per layout and only its layers move; the corridor
  moves by transform alone; nothing animates inside the large corridor SVG or under the frosted
  top bar; three.js is only downloaded for a 3D walk and is torn down on exit.
- **Reduced motion.** With the system setting on, the walk-in becomes a fade, light paintings
  become still exposures, and the corridor stacks vertically.
- **Keyboard.** Every room and work is a real link; the reader and guide take focus; `←` `→`
  and `Esc` work in the reader; `↑` `↓` walk the 3D corridor.

## Where things live

```
src/content/index.ts      editorial layer (Malay) + image curation rules
src/content/en.ts         English edition of the content
src/content/i18n.ts       interface words in both languages
src/content/videos.ts     the film shelves
src/lib/lang.tsx          language switch (remembered per visitor)
src/ui/EntryGate.tsx      the gate
src/ui/fx/                light painting, prism shards, entrance walk, decipher text
src/ui/Hall.tsx           screening-room hero, corridor pipeline, figures, visit
src/ui/RoomView.tsx       a room page
src/ui/ExhibitReader.tsx  a work, up close
src/ui/ImmersiveWalk.tsx  the optional 3D corridor (src/experience/PortWorld.ts)
src/styles/               tokens, base, gate, hall, room, reader, video, walk, flat
src/assets/               the building photographs for the walk in
public/media/             synced photographs (webp)
```

---

PORT (People Of Remarkable Talents) · No 09, Jalan Sultan Azlan Shah, 31400 Ipoh, Perak ·
+605-241 2287 · portipoh9@gmail.com
