/**
 * The English edition of PORT's content.
 *
 * `index.ts` and `videos.ts` hold the house copy in Bahasa Melayu. This file lays English
 * over it, field by field, keyed by id — so a station, work or film that has no entry here
 * simply stays in Malay rather than disappearing. Paragraphs synced from portipoh.com are
 * left in their original language (the reader says so); everything written for this site
 * is translated here.
 */

import type { Exhibit, Station, StationSection } from './index';
import type { PortVideo, VideoPlaylist } from './videos';
import type { Lang } from './i18n';

type StationEn = Partial<Pick<Station, 'label' | 'short' | 'tagline' | 'intro'>> & {
  /** Keyed by the Malay heading, so the synced paragraphs under it stay attached. */
  sections?: Record<string, Partial<StationSection>>;
};

type ExhibitEn = Partial<Pick<Exhibit, 'title' | 'meta' | 'tagline' | 'body' | 'bullets'>>;

const stationsEn: Record<string, StationEn> = {
  tentang: {
    label: 'ABOUT US',
    short: 'About',
    tagline: 'Who we are, and why we exist.',
    intro: [
      'PORT (People Of Remarkable Talents) is the brand of Kampung Karyawan Amanjaya, a cultural agency fully funded by the Perak State Government.',
      "Founded in 2011, PORT's core mission is to bring the arts to the public through programmes featuring artists and cultural figures from Malaysia and abroad.",
    ],
    sections: {
      Objektif: {
        heading: 'Our Mission',
        bullets: [
          'Give young people in Perak the chance to develop their talent in visual art, performing arts, literature and film.',
          'Deepen public knowledge through art talks and forums.',
          'Establish Ipoh as a hub of intellectual culture.',
        ],
      },
      'Motto — “Unity Thru Arts”': {
        heading: 'Motto — “Unity Thru Arts”',
        paragraphs: [
          '“Unity Thru Arts” holds that art and culture are a vital platform for celebrating — and bridging — the many practices and ways of thinking that cut across race and background.',
        ],
      },
      'Black House': {
        heading: 'The Black House',
        bullets: [
          'Portdistro — crafts and merchandise',
          'Common Room — performances, exhibitions and workshops',
          'Dark Room — photography and printmaking',
          'Music Studio',
          'Artist Residency',
        ],
      },
      'Lembaga Pengarah': {
        heading: 'Board of Directors',
        bullets: [
          "YB Dato' Khairuddin b. Abu Hanipah — Director",
          'Encik Mohamad Hamidi b. Baharuddin — Director',
          'YB Puan Salina bt. Samsudin — Director',
          'Assoc. Prof. Dr. Nur Hisham Ibrahim — Director',
        ],
      },
    },
  },
  program: {
    label: 'FLAGSHIP PROGRAMMES',
    short: 'Programmes',
    tagline: "Seven programmes shaping Perak's arts ecosystem.",
    intro: [
      "From a music archive to an international festival — these are PORT's core programmes, running all year round.",
    ],
  },
  residensi: {
    label: 'ARTIST RESIDENCY',
    short: 'Residency',
    tagline: 'Studios and living quarters for emerging artists.',
    intro: [
      'Twice a year, the Artist Residency invites visual artists from Malaysia and abroad to live and work at the Black House, PORT.',
      'At the end of the three-month residency, each artist presents a work-in-progress exhibition or open studio to the public.',
    ],
  },
  pameran: {
    label: 'EXHIBITIONS & DIGITAL BOOKS',
    short: 'Exhibitions',
    tagline: 'Past exhibitions, preserved as digital books.',
    intro: [
      'Every PORT exhibition is documented as a digital book, so it can be revisited at any time.',
    ],
  },
  arca: {
    label: 'SCULPTURE',
    short: 'Sculpture',
    tagline: 'Forms that stand on their own, to be walked around rather than looked at.',
    intro: [
      'PORT\u2019s sculpture court. Each work stands on its own plinth, built out of basic form and light \u2014 not a copy of anyone\u2019s piece, but a language borrowed from seventy years of modern sculpture.',
    ],
  },
  arkib: {
    label: 'ARCHIVE & MEDIA',
    short: 'Archive',
    tagline: 'Reference material, press coverage and digital books.',
    intro: [
      "PORT archives the arts and culture of Perak — a resource for researchers, policymakers, students and anyone curious about the state's culture.",
    ],
  },
  video: {
    label: 'PORTCAST & VIDEO',
    short: 'Video',
    tagline: "Interviews, symposia and performances — PORT's video archive.",
    intro: [
      'PORT records its work: long-form conversations with artists, symposium papers and live performances from our own stage — all kept on the official PORT YouTube channel.',
      'The recordings below are grouped by the programme they come from rather than by upload date: choose a programme, then choose a recording.',
    ],
  },
  terkini: {
    label: "WHAT'S ON",
    short: "What's On",
    tagline: "What's happening right now.",
    intro: ['Open calls, event schedules and the latest announcements from PORT.'],
  },
  hubungi: {
    label: 'CONTACT & VISIT',
    short: 'Contact',
    tagline: 'Visit the Black House, or get in touch directly.',
    intro: [
      'PORT IPOH, No 09, Jalan Sultan Azlan Shah, 31400 Ipoh, Perak.',
      'We welcome visits, collaborations, programme participation and funding applications.',
    ],
  },
};

const exhibitsEn: Record<string, ExhibitEn> = {
  // Flagship programmes
  amp: {
    title: 'Perak Music Archive',
    meta: 'Archival Initiative · Ongoing',
    tagline: "Collecting, documenting and preserving Perak's musical heritage.",
  },
  iiaf: {
    meta: 'International Festival · 2019 — present',
    tagline: 'A multidisciplinary festival bringing together artists from Malaysia and around the world.',
  },
  ims: {
    meta: 'Music Symposium · 2019 — present',
    tagline: 'Opening up the conversation on how music shapes society.',
    bullets: [
      '2019 — Independent Music',
      '2020 — Rock Kapak',
      '2021 — Nusantara',
      '2022 — 60s Pop',
    ],
  },
  panggung: {
    title: 'Projek Panggung',
    meta: 'Live Music Stage · Twice a month',
    tagline: 'A stage for musicians of every genre and every age.',
  },
  dana: {
    title: 'Perak Creative Fund',
    meta: 'Funding Scheme · @PORT',
    tagline:
      "A first in Malaysia's creative arts: a creative fund awarded in the name of the Menteri Besar.",
  },
  folio: {
    meta: 'Talks, Forums & Workshops',
    tagline: 'A people-first programme for sharing knowledge of art, culture and heritage.',
  },
  portcast: {
    meta: 'Conversations · Video',
    tagline: "Relaxed conversations with Perak's music figures, artists and practitioners.",
  },

  // Residency
  'residensi-2021': {
    title: 'Residency 2021',
    meta: 'Session 1 · 17 March — 17 June 2021',
    tagline: 'Izzat Aziz and Khalil Muhsain.',
  },
  'residensi-2022': {
    title: 'Residency 2022',
    meta: 'Session 2 · 23 May — 19 August 2022',
    tagline: 'Fadhli Ariffin and Hafizuddin Azman.',
  },
  amir: {
    meta: 'Artist & Curator · 10 February — 24 March 2022',
    tagline: 'A Malaysian artist-curator based in Denmark since 2002.',
  },
  khalil: {
    meta: 'Resident 2021',
    tagline: 'Clay and rock surfaces from Gunung Lang, Ipoh.',
  },
  izzat: {
    meta: 'Resident 2021',
    tagline: 'Plastic waste from Pasir Bogak Beach, reworked into a new narrative.',
  },
  fadhli: {
    meta: 'Resident 2022',
    tagline: 'An installation-performance on the healing bath rituals of Kuala Kangsar.',
  },
  hafizuddin: {
    meta: 'Resident 2022',
    tagline: 'Twelve oil paintings interwoven with audio fragments from the public.',
  },

  // Exhibitions
  'kembali-pulang': {
    meta: 'Tin Alley · 26 August — 1 October 2023',
    tagline: 'Aw Boon Xin and Abdul Shakir (Grashopper) — the urgent pull of returning to one’s roots.',
  },
  bentukan: {
    meta: 'Residency Exhibition',
    tagline: 'Fadhli Ariffin and Hafizuddin Azman — new ideas drawn from Perak’s customs and social life.',
  },
  semesta: {
    meta: 'Group Exhibition',
    tagline: 'Space and time, holding every layer of what life means.',
  },
  direktori: {
    title: 'Perak Creative Directory',
    meta: 'Database · Ongoing',
    tagline: 'Registration is required for every state arts nomination and programme.',
    body: [
      'Registration in the Perak Creative Arts Database is required for all nominations to programmes PORT runs on behalf of the Perak State Government.',
    ],
  },

  // Sculpture court
  tindanan: {
    title: 'Stack',
    meta: 'Minimalism · Primary Form',
    tagline: 'Slabs piled until balance itself becomes the form.',
    body: [
      'How much can be taken away before a thing stops being sculpture? The answer here is layers: each slab smaller than the one below it, the whole held by the single point where weight meets position.',
    ],
  },
  celah: {
    title: 'Slit',
    meta: 'Light and Space · Light as Material',
    tagline: 'A lit cut in a dark monolith — space made by light.',
    body: [
      'Light here is not a way of explaining the form, it is the material. Without the light through that cut there is no sculpture, only a block. Which is what makes this room part of the work.',
    ],
  },
  pintal: {
    title: 'Twist',
    meta: 'Kinetic Art · Continuous Movement',
    tagline: 'A ribbon turning on its own axis, never stopping in the same place twice.',
    body: [
      'A turning form cannot be seen in one look. You have to stand there a while — and the decision to stand there is part of the work.',
    ],
  },
  tabir: {
    title: 'Veil',
    meta: 'Installation · Suspended Light',
    tagline: 'A curtain of lit strands you can walk into and stand inside.',
    body: [
      'A room inside a room. Standing at its centre, the walls of the hall disappear behind the veil of light, and what is left is light moving slowly around you.',
    ],
  },
  serpih: {
    title: 'Shard',
    meta: 'Broken Form · Ordinary Materials',
    tagline: 'Plates leaning against one another, glued to nothing.',
    body: [
      'These plates stand only because of each other. Pull any one away and the whole thing comes down. It is built from materials worth nothing, and worth no more once shaped — which is the entire argument.',
    ],
  },
  pusaran: {
    title: 'Vortex',
    meta: 'Op Art · Turning Rings',
    tagline: 'Rings turning at different rates, and your eye trying to join them up.',
    body: [
      'Each ring turns at its own speed, so the form you are looking at is never the form of a moment ago. This sculpture happens in time, not in space.',
    ],
  },

  // Archive & media
  'amp-arkib': {
    title: 'Perak Music Archive (AMP)',
    meta: 'Archive · Music',
    tagline: 'A reference to the many genres of music from Perak.',
    body: [
      "AMP's archive holds recordings, posters, album sleeves, press cuttings and documents gathered from musicians and their families across Perak.",
      'The material is catalogued so researchers, students and policymakers can use it — and part of it is now available through the Perak Music Archive website.',
    ],
  },
  'media-liputan': {
    title: 'Press Coverage',
    meta: 'Media · External',
    tagline: 'Writing and coverage about PORT and the artists of Perak.',
    body: [
      "PORT's work and programmes have been covered by local and international media, including features on Malaysian artists taking the global stage.",
    ],
  },
  'buku-digital': {
    title: 'Digital Books',
    meta: 'Publications · Online',
    tagline: 'Exhibitions documented as digital reading.',
    body: [
      "PORT's digital books preserve exhibition records, artworks and curatorial notes, so the state's arts ecosystem stays open to future generations.",
    ],
  },
  'portcast-arkib': {
    meta: 'Video · Interviews',
    tagline: 'Video documentation built on the holdings of the Perak Music Archive.',
    body: [
      "Every PORTCAST episode is kept as part of the Perak Music Archive — an oral history of Perak's musicians, recorded in their own voices.",
      "Full recordings can be watched in PORT's Screening Room and on the official @portipoh YouTube channel.",
    ],
  },

  // What's on
  hsdr9: {
    title: 'The 9th Darul Ridzuan Literary Award',
    meta: 'Nominations open until 13 April 2026',
    tagline: "The Perak State Government's biennial award honouring Perak's writers.",
    body: [
      'The Hadiah Sastera Darul Ridzuan (HSDR) returns for its ninth edition — a biennial award from the Perak State Government honouring writers born in or living in Perak.',
      'Categories include poetry, short stories, novels, drama and essays. The award plays a vital role in upholding the literary tradition and nurturing new talent.',
      'Registration in the Perak Creative Arts Database is required for all nominations. Scan the QR code on the official poster to register.',
      'Organised by PORT on behalf of the Perak State Government, in collaboration with Dewan Bahasa dan Pustaka.',
    ],
  },
  'ims-2023': {
    meta: 'Event Schedule',
    tagline: 'The annual music symposium with invited panellists.',
    body: [
      'IMS gathers insight and perspectives on music through papers presented by invited panellists — opening up the conversation on how music shapes society.',
    ],
  },
  praktikal: {
    title: 'Internships & Industrial Training',
    meta: 'Opportunity · Open',
    tagline: 'For students seeking an internship or industrial placement.',
    body: [
      'Send your CV and portfolio to portipoh9@gmail.com, or call 05-241 2287 (Puan Dayana).',
    ],
    bullets: [
      'Graphic Design',
      'Multimedia',
      'Broadcasting & Documentation (Video & Film)',
      'Human Resources',
    ],
  },
};

const playlistsEn: Record<string, Partial<Pick<VideoPlaylist, 'label' | 'short' | 'tagline'>>> = {
  persembahan: {
    label: 'PERFORMANCES',
    short: 'Performances',
    tagline: 'Live performances on the PORT stage and beyond.',
  },
  simposium: {
    label: 'IPOH MUSIC SYMPOSIUM 2025',
    short: 'Symposium',
    tagline: 'Nasyid: from traditional to contemporary — every paper, session by session.',
  },
  portcast: {
    tagline: 'Long-form conversations with artists — one hour, one voice.',
  },
  highlight: {
    label: 'HIGHLIGHTS & EVENTS',
    short: 'Highlights',
    tagline: 'Festivals and celebrations — PORT in three minutes.',
  },
};

const videosEn: Record<string, Partial<Pick<PortVideo, 'title' | 'meta' | 'note'>>> = {
  XcU9A6YpuyI: {
    note: 'Highlights from the 2023 Ipoh International Art Festival, organised by PORT in Ipoh.',
  },
  O70HCqlIpqU: {
    title: '7th Symposium Highlights — Nasyid',
    meta: 'Highlights · 3 minutes',
    note: 'A three-minute summary of the whole symposium — a good place to start.',
  },
  wzwRXg02BLc: { title: 'Keynote — Nasyid: From Traditional to Contemporary', meta: 'Keynote' },
  '5ycJkWUPjsw': {
    title: 'Session 1 — Digital Dakwah, Screen Production and Visual Communication',
    meta: 'Symposium · Session 1',
  },
  x7vjsYjO1gQ: {
    title: 'Session 2 — The Evolution of Nasyid, Politics and Social Issues',
    meta: 'Symposium · Session 2',
  },
  H7rYjihw60I: {
    title: 'Session 3 — The Evolution of Nasyid, Politics and Social Issues',
    meta: 'Symposium · Session 3',
  },
  wnuGj21tugI: {
    title: 'Session 4 — Nasyid Music, Lyrics and Style',
    meta: 'Symposium · Session 4',
  },
  QV9NGdWnJUI: {
    title: 'Session 5 — Nasyid Music, Lyrics and Style',
    meta: 'Symposium · Session 5',
  },
  '39y19vXF9WA': {
    title: 'Session 6 — Education, Industry and Community',
    meta: 'Symposium · Session 6',
  },
  hrRdfYZU4GE: {
    title: 'Forum — From Pulpit to Metaverse: Ethics, Social Media and AI',
    meta: 'Forum',
  },
  agAm7OGB1s8: {
    title: 'Sharing Session — "Rindu Kasih, Rindu Kekasih"',
    meta: 'With Isman Isam (Hijjaz)',
  },
  IJBOuv1BMx8: { title: "D'RIYADH — Part 1" },
  'Mt5MnrZbr-c': { title: "D'RIYADH — Part 2" },
  ExaqqYa9lKo: { meta: 'Celebration · 2026' },
  NeiZZQRvPoo: { meta: 'Sekolah Seni Malaysia Perak, Sungai Siput (U)' },
};

/* ------------------------------------------------------------------ apply */

function localizeVideo(video: PortVideo): PortVideo {
  const over = videosEn[video.id];
  return over ? { ...video, ...over } : video;
}

function localizePlaylist(list: VideoPlaylist): VideoPlaylist {
  return {
    ...list,
    ...playlistsEn[list.id],
    videos: list.videos.map(localizeVideo),
  };
}

function localizeExhibit(exhibit: Exhibit): Exhibit {
  const over = exhibitsEn[exhibit.id];
  return over ? { ...exhibit, ...over } : exhibit;
}

function localizeSections(sections: StationSection[] | undefined, over: StationEn['sections']) {
  if (!sections || !over) return sections;
  return sections.map((section) => {
    const patch = over[section.heading];
    if (!patch) return section;
    return {
      heading: patch.heading ?? section.heading,
      // Synced paragraphs stay as they are unless a translation was written for them.
      paragraphs: patch.paragraphs ?? section.paragraphs,
      bullets: patch.bullets ?? section.bullets,
    };
  });
}

export function localizeStation(station: Station, lang: Lang): Station {
  if (lang === 'ms') return station;
  const over = stationsEn[station.id] ?? {};
  return {
    ...station,
    label: over.label ?? station.label,
    short: over.short ?? station.short,
    tagline: over.tagline ?? station.tagline,
    intro: over.intro ?? station.intro,
    sections: localizeSections(station.sections, over.sections),
    exhibits: station.exhibits.map(localizeExhibit),
    videoShelves: station.videoShelves?.map(localizePlaylist),
  };
}

export function localizeFeatured(video: PortVideo, lang: Lang): PortVideo {
  return lang === 'ms' ? video : localizeVideo(video);
}

/**
 * True when an English reader is looking at a work whose long text was only ever written
 * in Malay — the reader flags it rather than pretending otherwise.
 */
export function bodyIsOriginal(exhibitId: string, lang: Lang): boolean {
  return lang === 'en' && !exhibitsEn[exhibitId]?.body;
}
