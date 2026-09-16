# PORT — People Of Remarkable Talents

An explore-instead-of-scroll website for **PORT (People Of Remarkable Talents)**, the brand of
Kampung Karyawan Amanjaya, Perak's state-funded cultural agency.

Instead of scrolling a page, a visitor walks in: a first-person approach to the PORT front,
then a circular deck where seven illuminated stations stand around you. Choose one and you
either step into a walkable gallery hung with PORT's real photographs, or a station panel
opens over the space.

Everything here is original artwork built from PORT's own material — the programmes,
photographs, artist texts and contact details are synced from `portipoh.com`.

---

## What a visitor actually does

1. **The gate.** PORT's frontage, blended into the dark, with the wordmark over it. Two ways
   in: *Masuk ke PORT* (plays the approach) or *Langkau animasi* (straight to the deck).
2. **The approach.** You fly along a lit corridor of rings, the building resolving ahead of
   you, and step through the doorway into the space.
3. **The deck.** Seven monoliths stand in a ring. Drag to look around, click one to enter, or
   use the dock along the bottom.
4. **The gallery wings.** *Program Utama*, *Residensi Seni* and *Pameran* open into a corridor
   with real photographs framed on the walls. Scroll or press ↑ ↓ to walk. Click a frame to
   read the whole work.
5. **Station panels.** *Tentang Kami*, *Arkib & Media*, *Program Terkini* and *Hubungi &
   Kunjungi* open as panels over the deck, with the space dimmed behind.
6. **The plain list.** The icon at the top right shows the entire site as an ordinary
   document — same content, no 3D. This is what phones-with-no-WebGL, screen readers and
   search engines get, and it is one click away at all times.

Every station and every work has its own web address (`#/s/program/2`), so a specific
programme can be shared on WhatsApp and opens straight into the reader.

---

## Running it on your own machine

You need **Node.js 20 or newer** ([nodejs.org](https://nodejs.org) — the LTS button).

```bash
npm install        # once, to fetch the libraries
npm run dev        # start it, then open the link it prints
```

Press `Ctrl + C` in that terminal to stop it.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Live preview while you work. Changes appear instantly. |
| `npm run build` | Makes the production version into `dist/`. |
| `npm start` | Runs the production version locally (run `build` first). |
| `npm run sync:content` | Re-reads portipoh.com and refreshes content + photos. |
| `npm run typecheck` | Checks for mistakes without building. |

---

## Changing things

### The words

Open **`src/content/index.ts`**. Each station is one block in the `stations` array:
`label`, `tagline`, `intro`, and an `exhibits` list. Edit the text and save — the space
updates immediately.

Text pulled from the live site stays authentic as long as you leave the `body(71, 0, 2)`
style calls alone. Those mean *"page #71, from paragraph 0, take 2"*. If you would rather
write your own copy, replace them with plain text in a list, like:

```ts
body: ['Ayat pertama anda di sini.', 'Ayat kedua.'],
```

### The photographs

All photos live in `public/media/` as `.webp`, produced by the sync. To swap in your own,
either replace a file with the same name, or drop a new one in and point at it:

```ts
images: [{ small: '/media/your-photo.webp', large: '/media/your-photo.webp', caption: 'Keterangan' }],
```

### The PORT frontage

This is the one image worth getting right. Drop a wide photo of the building into
**`src/assets/`** named `entrance.jpg` (or `.png` / `.webp`) — it is picked up automatically,
with no code change, and used both behind the opening screen and at the end of the approach.
See `src/assets/README.md` for details.

Until you do, it falls back to the site's programme banner.

### The artwork on the deck

Every station's monolith on the deck carries a real work, so the first space you stand in
reads as a gallery rather than seven blank slabs. You do not have to choose anything: the deck
gives each station a different piece automatically — the station's own gallery pieces first,
then whatever cover the sync recorded for it, then the wider library — and it makes sure no two
stations hang the same picture.

To pin a specific work to a station, set `deckCover` on it:

```ts
{
  id: 'pameran',
  deckCover: images[3],   // or any GalleryImage, or a /media/... path you wrote by hand
  ...
}
```

The work is shown at its true proportions inside a uniform frame, so a tall poster and a wide
photograph both sit correctly rather than being stretched to fit. Nothing needs cropping.

### Colours, and how much of each station there is

Each station has an `accent` colour in `src/content/index.ts` that drives its monolith, its
glyph and its panel. Change the hex value and everything follows.

To add or remove a station, add or remove a block in `stations` — the deck re-arranges the
ring by itself, and the dock picks it up automatically.

### The Google Map

The contact station shows a styled placeholder. To show the real map, open
[Google Maps](https://maps.google.com), find PORT Ipoh, choose **Share → Embed a map**, copy
the `src="..."` address out of the code it gives you, and paste it at the bottom of
`src/content/index.ts`:

```ts
export const googleMapEmbedUrl: string | undefined = 'https://www.google.com/maps/embed?pb=...';
```

A real Street View of the premises can go in the same slot. Note that Google's old
key-free embed address no longer works, which is why this is a paste-in step.

---

## Refreshing content from portipoh.com

PORT staff add programmes to WordPress. To pull those into the site:

```bash
npm run sync:content      # fetches pages + images, converts photos to .webp
```

Then edit `src/content/index.ts` to surface anything new as a station or exhibit. The sync
is polite to the server, safe to re-run, and never runs on the live site — the visitor's
browser only ever talks to your own deployment.

Add `-- --fresh` to force re-downloading every image:

```bash
npm run sync:content -- --fresh
```

---

## Putting it online on Railway

The repo is already configured for Railway (`railway.json` plus a `Dockerfile`). You only
need to do the account steps — everything technical is done.

1. **Make sure the code is on GitHub.** It lives at
   `https://github.com/tradernonymous/portwebsitepilot`. Pushing to `main` is all it takes to
   trigger a fresh deploy once the project exists.
2. **Create the Railway project.** Go to [railway.app](https://railway.app) and sign in with
   GitHub.
3. **New Project → Deploy from GitHub repo →** choose `portwebsitepilot`. Railway finds the
   `Dockerfile`, runs one `npm ci` and one `npm run build`, then serves the result with
   `node server.mjs`.
4. **Wait for the build** (a couple of minutes the first time). The health check at `/healthz`
   must answer before Railway marks it live.
5. **Settings → Networking → Generate Domain.** That gives you a public
   `*.up.railway.app` address. Open it.
6. **Point the real domain at it.** In the same Networking panel choose *Custom Domain* and
   enter `portipoh.com`. Railway shows a CNAME record — add that at whoever manages the
   domain. Do this on a quiet day, as DNS changes take a little while to spread.

### About the cost

Railway has no permanent free tier any more: new accounts get a one-off trial credit, then
usage is billed, which for a small static site like this is roughly **US$5/month** (it idles
cheap, but the service must stay running). Set a spend limit under *Account → Usage limits* so
there are no surprises.

If that ever becomes a problem, the same repo deploys unchanged to Cloudflare Pages or Netlify
free of charge — the build command is `npm run build` and the output folder is `dist`. Nothing
in the code is Railway-specific.

---

## Things worth knowing

- **Nothing is paid and no API keys are needed.** No map key, no font subscription, no
  analytics, no tracking. Fonts come from Google Fonts (free); everything else is local.
- **Accessibility.** If a visitor's device has no WebGL, or they have asked their system to
  reduce motion, the site adapts: the animation is skipped and the plain list view is offered.
  The dock, the rail and every gallery link work from the keyboard alone. Opening a work moves
  focus into the panel, so it can be read and scrolled with the keyboard, and `←` `→` page
  between works — matching the reader's own buttons. Walking the space with `↑` `↓` is
  suspended while a panel is open, so reading never moves the camera behind it.
- **Guidance.** A one-line hint above the dock teaches the gesture for the space you are in,
  worded for the device (`Ketuk`/`Klik`, `Undur / Maju`/`Scroll`) and shown at every screen
  size. Once you have dragged or tapped, it retires — learn the deck and the wing still
  teaches itself when you step into it.
- **Search engines.** The plain list view carries the full text of every station.
- **Mobile.** Drag to look, tap to enter. The station dock along the bottom is a single row
  that scrolls sideways, with a soft fade on whichever side still has stations beyond it —
  there is no scrollbar. Below 860px it switches to each station's short name so more tabs
  fit at once; a portrait phone shows about three of the seven, and the list button in the top
  bar opens the full plain-text version of everything.
- **Landscape phones.** The rail for the wing you are in moves to a left-hand column and the
  chrome compresses, and the top bar and dock respect the notch insets.
- **Performance.** three.js is loaded in the background while the gate is on screen, so the
  opening paints immediately. Gallery photographs load only for the station you are in, and
  are released when you leave.
- **`window.__PORT__`** exists in development builds only, and lets you inspect the live scene
  from the browser console (`window.__PORT__.debug()`).

## Where things live

```
src/content/index.ts        the editorial layer — all station copy and exhibits
src/content/site.json       generated by the sync; do not hand-edit
src/content/glyphs.ts       the station icons, shared by the HUD and the 3D space
src/experience/PortWorld.ts the three.js space: approach, deck, gallery corridor
src/ui/                     the HUD, the entry gate, the panels and the plain list
src/assets/                 drop your PORT frontage photo here
public/media/               synced photographs (webp)
scripts/sync-content.mjs    the portipoh.com sync
server.mjs                  the production web server
Dockerfile                  how the site is built and packaged for Railway
.dockerignore               keeps node_modules and dist out of the build context
railway.json                Railway build and deploy settings
```

## Troubleshooting

**The page is blank.** Run `npm run dev` and read the terminal; if it mentions a port already
in use, another dev server is running — stop it, or change `server.port` in `vite.config.ts`.

**No 3D, just the list.** The browser has no WebGL, or hardware acceleration is switched off.
The site is designed to still work; try another browser.

**The photos are missing after a clone.** They are committed, so this should not happen. If it
does, run `npm run sync:content -- --fresh`.

**A build fails on Railway but works locally.** The Dockerfile pins Node 22, so the version
should match. If the failure line mentions `npm ci` and `EBUSY` on `node_modules/.cache`, that
is the platform's auto-generated build running a second install over a mounted cache — the
Dockerfile exists precisely to avoid it, so make sure `railway.json` still says
`"builder": "DOCKERFILE"`. To reproduce the build locally, run the same two commands the
image runs, in a folder with no `node_modules`: `npm ci --include=dev && npm run build`.

---

PORT (People Of Remarkable Talents) · No 09, Jalan Sultan Azlan Shah, 31400 Ipoh, Perak ·
+605-241 2287 · portipoh9@gmail.com
