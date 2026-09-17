import type { Route } from '../lib/hooks';

type TrailCopy = {
  title: string;
  lede: string;
};

type LocalizedText = {
  ms: string;
  en: string;
};

export type CuratedTrail = {
  id: string;
  minutes: number;
  copy: { ms: TrailCopy; en: TrailCopy };
  stops: { route: Route; label: LocalizedText; note: LocalizedText }[];
};

export const curatedTrails: CuratedTrail[] = [
  {
    id: 'meet-port',
    minutes: 8,
    copy: {
      ms: { title: 'Kenali PORT', lede: 'Dari siapa kami kepada apa yang kami jaga.' },
      en: { title: 'Meet PORT', lede: 'From who we are to what we choose to keep.' },
    },
    stops: [
      {
        route: { kind: 'station', stationId: 'tentang' },
        label: { ms: 'Tentang kami', en: 'About PORT' },
        note: {
          ms: 'Mula dengan rumahnya: sebuah agensi budaya yang menggunakan seni untuk mendekatkan manusia.',
          en: 'Begin with the house: a cultural agency using art to bring people closer together.',
        },
      },
      {
        route: { kind: 'station', stationId: 'program' },
        label: { ms: 'Program utama', en: 'Core programmes' },
        note: {
          ms: 'Lihat bagaimana sebuah rumah kecil boleh memegang muzik, festival, forum dan bakat muda serentak.',
          en: 'See how one small house can hold music, festivals, forums, and young talent at once.',
        },
      },
      {
        route: { kind: 'station', stationId: 'hubungi' },
        label: { ms: 'Kunjungi', en: 'Visit' },
        note: {
          ms: 'Lawatan sebenar bermula di sini — pintu PORT terbuka untuk anda datang dan tinggal seketika.',
          en: 'The real visit begins here — PORT’s doors are open for you to come and stay awhile.',
        },
      },
    ],
  },
  {
    id: 'artists-in-residence',
    minutes: 10,
    copy: {
      ms: { title: 'Artis di PORT', lede: 'Ikuti bahan, studio dan suara para residen.' },
      en: { title: 'Artists at PORT', lede: 'Follow the materials, studios, and voices of the residents.' },
    },
    stops: [
      {
        route: { kind: 'station', stationId: 'residensi' },
        label: { ms: 'Ruang residensi', en: 'The residency room' },
        note: {
          ms: 'Residensi memberi masa kepada pengkarya untuk tinggal, mencuba dan membiarkan kerja berubah.',
          en: 'Residency gives artists time to stay, experiment, and let the work change shape.',
        },
      },
      {
        route: { kind: 'exhibit', stationId: 'residensi', index: 0 },
        label: { ms: 'Residensi 2021', en: 'Residency 2021' },
        note: {
          ms: 'Baca catatan kerja yang bermula daripada sebuah tempat dan dua pengkarya yang berkongsi masa.',
          en: 'Read a work that begins with a place and two artists sharing time inside it.',
        },
      },
      {
        route: { kind: 'exhibit', stationId: 'residensi', index: 6 },
        label: { ms: 'Memoranda Jiwa', en: 'Memoranda Jiwa' },
        note: {
          ms: 'Dekati catan, suara dan ingatan — kerja yang meminta masa lebih panjang daripada satu pandangan.',
          en: 'Come closer to paint, voices, and memory—a work that asks for more than one glance.',
        },
      },
      {
        route: { kind: 'station', stationId: 'pameran' },
        label: { ms: 'Pameran selepas studio', en: 'Exhibition after the studio' },
        note: {
          ms: 'Akhirnya, kerja meninggalkan studio dan masuk ke ruang awam, untuk dilihat bersama orang lain.',
          en: 'Eventually the work leaves the studio and enters a public room, to be seen with others.',
        },
      },
    ],
  },
  {
    id: 'moving-image',
    minutes: 9,
    copy: {
      ms: { title: 'PORT dalam gerak', lede: 'Satu laluan melalui suara, muzik dan imej bergerak.' },
      en: { title: 'PORT in motion', lede: 'A route through voices, music, and moving images.' },
    },
    stops: [
      {
        route: { kind: 'station', stationId: 'video' },
        label: { ms: 'Bilik tayangan', en: 'Screening room' },
        note: {
          ms: 'Mulakan dengan arkib bergerak PORT — rakaman ialah cara rumah ini terus bercakap.',
          en: 'Begin with PORT’s moving archive—recordings are how this house keeps speaking.',
        },
      },
      {
        route: { kind: 'station', stationId: 'program', shelf: 'panggung' },
        label: { ms: 'Projek Panggung', en: 'Projek Panggung' },
        note: {
          ms: 'Dari skrin kembali ke pentas: muzik hadir sebagai pertemuan, bukan hanya rakaman.',
          en: 'From screen back to stage: music becomes a meeting, not only a recording.',
        },
      },
      {
        route: { kind: 'exhibit', stationId: 'arkib', index: 3 },
        label: { ms: 'PORTCAST', en: 'PORTCAST' },
        note: {
          ms: 'Suara lisan menjadi arkib — sejarah yang disimpan dalam nada, jeda dan cerita.',
          en: 'The spoken voice becomes an archive—history held in tone, pauses, and stories.',
        },
      },
    ],
  },
];
