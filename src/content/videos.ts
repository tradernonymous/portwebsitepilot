/**
 * PORT's video catalogue, curated for the space.
 *
 * Every entry is a real upload from the channel, taken from
 * https://www.youtube.com/@portipoh/videos — nothing is invented, and nothing is
 * embedded twice. The channel hands YouTube a flat reverse-chronological list; what a
 * visitor wants is a shelf, so the uploads are grouped by the programme they belong to
 * and each card carries the shelf's own metadata rather than the raw YouTube title
 * (which repeats the artist, the festival and the year in every single one).
 *
 * To add an upload: append it to the playlist it belongs to. That is the only edit
 * needed — the room, the playlist rail, the deck and the plain list view all read from
 * here.
 */

export type PortVideo = {
  /** YouTube id — the 11 characters after `watch?v=`. */
  id: string;
  title: string;
  /** Who it is by, or what it is part of. Shown under the title. */
  meta: string;
  duration: string;
  /** Optional one-line note, shown when a work is opened. */
  note?: string;
};

export type VideoPlaylist = {
  id: string;
  /** The full name, used as the playlist heading. */
  label: string;
  short: string;
  tagline: string;
  videos: PortVideo[];
};

export const channel = {
  name: 'Port Ipoh',
  handle: '@portipoh',
  url: 'https://www.youtube.com/@portipoh',
  videosUrl: 'https://www.youtube.com/@portipoh/videos',
} as const;

/**
 * The film that plays behind the entry screen and leads the highlight playlist: PORT's
 * own cut of the 2023 Ipoh International Art Festival.
 */
export const featuredVideo: PortVideo = {
  id: 'XcU9A6YpuyI',
  title: 'HIGHLIGHT IIAF 2023: MARCAPADA',
  meta: 'Ipoh International Art Festival · Highlight',
  duration: '3:07',
  note: 'Sorotan Ipoh International Art Festival 2023, festival seni antarabangsa yang dianjurkan PORT di Ipoh.',
};

/** YouTube's own poster frames — one request per card, and no artwork to maintain. */
export function thumbUrl(id: string, size: 'mq' | 'hq' | 'sd' = 'hq'): string {
  return `https://i.ytimg.com/vi/${id}/${size}default.jpg`;
}

/**
 * An embed URL for one video. Autoplay is muted by necessity — every browser blocks a
 * soundtrack the visitor did not ask for — and `playlist` is what makes a single-video
 * loop actually loop.
 */
export function embedUrl(
  id: string,
  opts: {
    autoplay?: boolean;
    loop?: boolean;
    controls?: boolean;
    start?: number;
    /**
     * Ask the player to report its own state back over `postMessage`. Needed wherever the
     * page has to wait for the film to genuinely be playing before revealing it — a
     * player that refuses (an embed the owner has switched off, a blocked request, no
     * network) loads and renders YouTube's own "unavailable" card, so `onload` is not a
     * sign that there is any film to show.
     */
    api?: boolean;
  } = {},
): string {
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    iv_load_policy: '3',
  });
  if (opts.api) {
    params.set('enablejsapi', '1');
    // The player only posts to `parent` when the origin it was told to expect matches.
    if (typeof window !== 'undefined') params.set('origin', window.location.origin);
  }
  if (opts.autoplay) {
    params.set('autoplay', '1');
    // Muted is the only autoplay browsers allow, and it is also the polite default here.
    params.set('mute', '1');
  }
  if (opts.loop) {
    params.set('loop', '1');
    params.set('playlist', id);
  }
  if (opts.controls === false) {
    params.set('controls', '0');
    params.set('disablekb', '1');
    params.set('fs', '0');
  }
  if (opts.start) params.set('start', String(opts.start));
  // The regular player is more reliable on phones and on embedded browsers than the
  // privacy wrapper, while the site still sends no tracking data of its own.
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

export const videoCount = (): number =>
  videoPlaylists.reduce((total, playlist) => total + playlist.videos.length, 0);

/**
 * The shelf itself. Four programmes, largest first by how much there is to see:
 * the performances, the symposium, the interview series, and the festival highlights.
 */
export const videoPlaylists: VideoPlaylist[] = [
  {
    id: 'persembahan',
    label: 'PERSEMBAHAN',
    short: 'Persembahan',
    tagline: 'Persembahan langsung di pentas PORT dan di luar.',
    videos: [
      {
        id: 'TYvgjuWyZwg',
        title: 'Sekadar Di Pinggiran',
        meta: 'Francissca Peter',
        duration: '4:02',
      },
      {
        id: 'YxSqdjdFLME',
        title: 'Ku Ke Udara Lagi',
        meta: 'Francissca Peter',
        duration: '3:17',
      },
      {
        id: 'aKgAmhGI4vg',
        title: 'Siapa Dia Sebelum Daku',
        meta: 'Francissca Peter',
        duration: '3:03',
      },
      {
        id: 'Y4KxGjQJkWc',
        title: 'Tentang Siang, Tentang Malam dan Romantis',
        meta: 'Teman Lelaki ft. Ainina Hasnul',
        duration: '4:53',
      },
      {
        id: 'XUL4pArPZIA',
        title: 'Serba Salah',
        meta: 'Teman Lelaki',
        duration: '5:16',
      },
      {
        id: 'MtR-FAP7lA4',
        title: 'Tulisan Nasib Kita',
        meta: 'Teman Lelaki ft. Ainina Hasnul & Syiqin Azlan',
        duration: '6:10',
      },
      {
        id: 'Lj1txMf9BPQ',
        title: 'Kota Ini Tak Sama Tanpamu',
        meta: 'Teman Lelaki ft. Ainina Hasnul & Syiqin Azlan · Cover',
        duration: '4:23',
      },
      {
        id: '8umdW6F4FC4',
        title: 'Puisi Keras Seorang Lelaki',
        meta: 'Teman Lelaki',
        duration: '4:48',
      },
      {
        id: '6HMUKHBet_0',
        title: 'Dengan Nama Tuhan',
        meta: 'Teman Lelaki',
        duration: '5:51',
      },
      {
        id: 'NeiZZQRvPoo',
        title: 'Makan Sirih',
        meta: 'Sekolah Seni Malaysia Perak, Sungai Siput (U)',
        duration: '4:50',
      },
      {
        id: '-OnXaFG5Ksk',
        title: 'Inang Cemara',
        meta: 'Sekolah Seni Malaysia Perak, Sungai Siput (U)',
        duration: '3:10',
      },
      {
        id: '-xTI9fAo-EA',
        title: 'Tarian Selamat Datang',
        meta: 'Sekolah Seni Malaysia Perak, Sungai Siput (U)',
        duration: '3:15',
      },
    ],
  },
  {
    id: 'simposium',
    label: 'SIMPOSIUM MUZIK IPOH 2025',
    short: 'Simposium',
    tagline: 'Nasyid: dari tradisional ke kontemporari — kertas kerja penuh, sesi demi sesi.',
    videos: [
      {
        id: 'O70HCqlIpqU',
        title: 'Highlight Simposium ke-7 — Nasyid',
        meta: 'Sorotan · 3 minit',
        duration: '3:37',
        note: 'Ringkasan tiga minit seluruh simposium — tempat yang baik untuk bermula.',
      },
      {
        id: 'wzwRXg02BLc',
        title: 'Ucaptama — Nasyid: Dari Tradisional ke Kontemporari',
        meta: 'Ucaptama',
        duration: '58:31',
      },
      {
        id: '5ycJkWUPjsw',
        title: 'Sesi 1 — Dakwah Digital, Produksi Skrin dan Komunikasi Visual',
        meta: 'Simposium · Sesi 1',
        duration: '57:44',
      },
      {
        id: 'x7vjsYjO1gQ',
        title: 'Sesi 2 — Evolusi Nasyid, Politik dan Isu Sosial',
        meta: 'Simposium · Sesi 2',
        duration: '1:17:25',
      },
      {
        id: 'H7rYjihw60I',
        title: 'Sesi 3 — Evolusi Nasyid, Politik dan Isu Sosial',
        meta: 'Simposium · Sesi 3',
        duration: '57:23',
      },
      {
        id: 'wnuGj21tugI',
        title: 'Sesi 4 — Analisis Muzik, Lirik dan Gaya Nasyid',
        meta: 'Simposium · Sesi 4',
        duration: '55:58',
      },
      {
        id: 'QV9NGdWnJUI',
        title: 'Sesi 5 — Analisis Muzik, Lirik dan Gaya Nasyid',
        meta: 'Simposium · Sesi 5',
        duration: '1:13:02',
      },
      {
        id: '39y19vXF9WA',
        title: 'Sesi 6 — Pendidikan, Industri dan Komuniti',
        meta: 'Simposium · Sesi 6',
        duration: '1:27:03',
      },
      {
        id: 'hrRdfYZU4GE',
        title: 'Forum — Dari Mimbar ke Metaverse: Etika, Media Sosial dan AI',
        meta: 'Forum',
        duration: '1:30:15',
      },
      {
        id: 'agAm7OGB1s8',
        title: 'Sesi Perkongsian — "Rindu Kasih, Rindu Kekasih"',
        meta: 'Bersama Isman Isam (Hijjaz)',
        duration: '1:08:32',
      },
    ],
  },
  {
    id: 'portcast',
    label: 'PORTCAST',
    short: 'PORTCAST',
    tagline: 'Temu bual panjang dengan pengkarya — satu jam, satu suara.',
    videos: [
      {
        id: 'Gkv1nfMaZM8',
        title: 'NONNA (Freshies)',
        meta: 'PORTCAST 2026',
        duration: '1:00:32',
      },
      { id: '2ZjBCRkS730', title: 'S.O.G', meta: 'PORTCAST 2026', duration: '1:25:20' },
      {
        id: 'i18cWhI2z88',
        title: "D' PUJANGGAS",
        meta: 'PORTCAST 2026',
        duration: '48:22',
      },
      {
        id: 'ndjhNjECElA',
        title: 'Faris Fuad',
        meta: 'PORTCAST 2026',
        duration: '49:38',
      },
      {
        id: 'izjA1eP_i6A',
        title: 'Datin Ezlynn Ariffin',
        meta: 'PORTCAST 2026',
        duration: '1:14:30',
      },
      {
        id: "IJBOuv1BMx8",
        title: "D'RIYADH — Bahagian 1",
        meta: 'PORTCAST 2026',
        duration: '1:25:25',
      },
      {
        id: 'Mt5MnrZbr-c',
        title: "D'RIYADH — Bahagian 2",
        meta: 'PORTCAST 2026',
        duration: '43:27',
      },
    ],
  },
  {
    id: 'highlight',
    label: 'HIGHLIGHT & ACARA',
    short: 'Highlight',
    tagline: 'Sorotan festival dan perayaan — PORT dalam tiga minit.',
    videos: [
      {
        id: featuredVideo.id,
        title: featuredVideo.title,
        meta: 'IIAF 2023 · Marcapada',
        duration: featuredVideo.duration,
        note: featuredVideo.note,
      },
      {
        id: 'ExaqqYa9lKo',
        title: 'PORT IPOH RAYA 2026 — CHAOS RAYA!',
        meta: 'Perayaan · 2026',
        duration: '2:35',
      },
    ],
  },
];

export function playlistById(id: string): VideoPlaylist | undefined {
  return videoPlaylists.find((p) => p.id === id);
}

/** Every video in the catalogue, in shelf order — used to resolve a shared link. */
export const allVideos: PortVideo[] = videoPlaylists.flatMap((p) => p.videos);

export function videoById(id: string): PortVideo | undefined {
  return allVideos.find((v) => v.id === id);
}
