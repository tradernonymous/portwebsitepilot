/**
 * Interface copy in both of PORT's languages.
 *
 * Bahasa Melayu is the house language and the default; English is a considered
 * translation, not a word-for-word one. Content (stations, works, films) is translated
 * separately in `en.ts`, so this file only holds the words the chrome itself speaks.
 */

export type Lang = 'ms' | 'en';

const ms = {
  // ---------------------------------------------------------------- cursor
  cursorEnter: 'MASUK',
  cursorOpen: 'BUKA',
  cursorClose: 'TUTUP',
  cursorPrev: '←',
  cursorNext: '→',
  cursorWalk: 'JALAN',
  cursorRead: 'BACA',
  cursorDrag: 'SERET',
  cursorEsc: 'ESC',
  cursorZoom: 'LIHAT',
  cursorView: 'LIHAT',

  // ---------------------------------------------------------------- gate
  gateLabel: 'Masuk ke ruang PORT',
  est: 'Est. 2011 · Ipoh, Perak',
  subtitle: 'People Of Remarkable Talents',
  welcomeBefore: 'Sedia nak terokai dunia',
  welcomeArt: 'SENI',
  welcomeAfter: '?',
  line: 'Jemput masuk, pintu kami sentiasa terbuka...',
  enter: 'Masuk ke PORT',
  listView: 'Senarai biasa',
  watchWithSound: 'tonton dengan bunyi',
  switchLang: 'Switch to English',
  nowShowing: 'Sedang ditayangkan',

  // ---------------------------------------------------------------- chrome
  brandLine: 'People Of Remarkable Talents · Perak',
  home: 'Laman utama',
  rooms: 'Ruang',
  films: 'Filem',
  contact: 'Hubungi',
  toList: 'Lihat sebagai senarai biasa',
  toGallery: 'Kembali ke galeri',
  help: 'Panduan',
  helpTitle: 'Cara menerokai galeri ini',
  close: 'Tutup',
  back: 'Kembali',
  skipToContent: 'Langkau ke kandungan',

  // ---------------------------------------------------------------- hall
  hallKicker: 'Galeri Cahaya · Ipoh, Perak',
  hallTitleA: 'Seni yang',
  hallTitleB: 'bercahaya',
  hallLede:
    'PORT ialah rumah bagi pengkarya Perak — program, residensi, pameran dan arkib, kini dipamerkan sebagai sebuah galeri yang boleh anda jelajahi.',
  beginTour: 'Mulakan lawatan',
  scrollHint: 'Tatal untuk berjalan',
  corridorKicker: 'Koridor Utama',
  corridorTitle: 'Lapan ruang, satu perjalanan',
  corridorLede: 'Setiap ruang menyimpan satu bahagian kisah PORT. Pilih pintu, dan melangkah masuk.',
  chapterWelcome: 'Selamat datang',
  chapterOnView: 'Pameran',
  chapterRooms: 'Ruang',
  chapterFigures: 'Koleksi',
  chapterVisit: 'Kunjungi',
  exhibitionKicker: 'Pameran Semasa',
  exhibitionTitle: 'Yang sedang dipamerkan',
  exhibitionLede:
    'Tiga karya yang sedang dipamerkan di PORT — dipilih supaya dibaca, bukan sekadar ditatal. Setiap satu membuka ruangnya sendiri.',
  roomWord: 'Ruang',
  enterRoom: 'Masuk ruang',
  works: 'karya',
  films_count: 'rakaman',
  profile: 'Profil',
  statYears: 'Tahun berkarya',
  statRooms: 'Ruang galeri',
  statWorks: 'Karya & program',
  statFilms: 'Rakaman video',
  filmKicker: 'Bilik Tayangan',
  filmTitle: 'PORT dalam gerak',
  filmLede: 'Temu bual, simposium dan persembahan — arkib video PORT, disusun mengikut program.',
  openScreening: 'Buka bilik tayangan',
  visitKicker: 'Kunjungi',
  visitTitle: 'Datang ke Black House',
  visitNote: 'Kunjungan, kolaborasi dan penyertaan program — semuanya dialu-alukan.',
  directions: 'Buka dalam Google Maps',
  motto: 'Unity Thru Arts',
  footerSource: 'Kandungan diselaraskan daripada',

  // ---------------------------------------------------------------- gallery mode
  galleryMode: 'Mod galeri · papan kekunci',
  galleryKeys: '← → atau ↑ ↓ untuk berjalan · Enter untuk masuk · Esc untuk keluar',
  galleryKeysRoom: '← → atau ↑ ↓ untuk menatal karya · Enter untuk membuka · Esc untuk keluar',
  galleryKeysPlain: '← → atau ↑ ↓ untuk berjalan · Esc untuk keluar',
  galleryExit: 'Keluar',
  galleryStop: 'Hentian',
  galleryWork: 'Karya',

  // --------------------------------------------------------------- curator's eye
  curatorMode: 'Mata Kurator · tur berpandu',
  curatorOn: 'Tur dimulakan — duduk dan biarkan galeri bergerak.',
  curatorPause: 'Rehat',
  curatorResume: 'Sambung',
  curatorNote: 'Catatan kurator',
  curatorWelcome: 'Selamat datang ke PORT. Koridor ini membentang dari muka masuk ke bilik tayangan — lapan bilik, satu lagu cahaya.',
  curatorThreshold: 'Mula di sini: filem PORT sendiri di atas dinding, cahaya dicat secara langsung di udara. Ini adalah kepulangan mereka yang melihat.',
  curatorOnview: 'Sedang dipamerkan — kerja yang dipilih dari seluruh amalan PORT, digantung satu demi satu.',
  curatorRooms: 'Setiap bilik memakai bahasa seni yang menjadi miliknya. Melangkah ke dalam mana-mana satu.',
  curatorFigures: 'Koleksi dalam nombor: karya, artis, residensi, arkib — sebuah rumah yang dikira dengan apa yang dijaganya.',
  curatorVisit: 'Cara masuk. PORT berada di Kampung Karyawan Amanjaya, Ipoh — datanglah untuk tayangan, tinggal untuk bilik-bilik itu.',
  curatorWorkNote: 'Dikurasi untuk dilihat dari dekat — dekati bila sedia.',
  curatorDone: 'Tamat tur — koridor berterusan tanpa anda.',

  // ---------------------------------------------------------------- room
  room: 'Ruang',
  roomOf: 'daripada',
  intro: 'Pengenalan',
  collection: 'Koleksi',
  walk3d: 'Jalan dalam 3D',
  walk3dNote: 'Berjalan di koridor galeri maya',
  prevRoom: 'Ruang sebelumnya',
  nextRoom: 'Ruang seterusnya',
  backToHall: 'Kembali ke koridor',
  openWork: 'Buka karya',
  list: 'Senarai',

  // ---------------------------------------------------------------- reader
  category: 'Kategori',
  period: 'Tempoh',
  details: 'Butiran',
  gallery: 'Galeri',
  originalSource: 'Sumber asal',
  previous: 'Sebelum',
  next: 'Seterusnya',
  originalLanguage: '',
  imageOf: 'Imej',

  // ---------------------------------------------------------------- walk (3D)
  walkKicker: 'Galeri',
  backToRoom: 'Keluar dari 3D',
  walkBack: 'Undur',
  walkFwd: 'Maju',
  hintWalkCoarse: 'Leret atas / bawah untuk berjalan · Ketuk bingkai untuk membaca',
  hintWalkFine: 'Tatal atau ↑ ↓ untuk berjalan · Klik bingkai untuk membaca',
  worksIn: 'Karya dalam',
  loading3d: 'Menyediakan ruang 3D…',
  opening: 'Membuka…',
  no3d: 'Peranti ini tidak menyokong grafik 3D.',

  // ---------------------------------------------------------------- contact
  location: 'Lokasi',
  address: 'Alamat',
  phone: 'Telefon',
  fax: 'Faks',
  email: 'E-mel',
  directionsShort: 'Arah',
  partners: 'Rakan Strategik',
  mapTitle: 'Peta lokasi PORT Ipoh',
  viewMap: 'Lihat peta sebenar',

  // ---------------------------------------------------------------- video
  screeningMark: 'PORT / BILIK TAYANGAN',
  movingArchive: 'Arkib bergerak',
  selectedRecordings: 'rakaman pilihan · pilih satu untuk ditonton',
  connecting: 'Menyambung ke filem…',
  opensOnYoutube: 'Filem ini dibuka di YouTube',
  watchOnYoutube: 'Tonton di YouTube',
  openOnYoutube: 'Buka di YouTube',
  nowPlaying: 'Sedang dimainkan',
  play: 'Main',
  videoProgrammes: 'Program video',
  allRecordingsFrom: 'Semua rakaman dimuatkan dari',
  onYoutube: 'di YouTube.',
  videoEmptyA: 'Rakaman sedang disusun. Sementara itu, seluruh arkib video PORT boleh ditonton di',
  videoEmptyLink: 'saluran YouTube kami',

  // ---------------------------------------------------------------- flat list
  flatIntro:
    'Kampung Karyawan Amanjaya — agensi kebudayaan yang didanai sepenuhnya oleh Kerajaan Negeri Perak. Diasaskan pada tahun 2011 untuk mendekatkan seni kepada masyarakat.',
  stationsNav: 'Ruang',
  flatFooterPages: 'halaman dan',
  flatFooterImages: 'imej diselaraskan daripada',

  // ---------------------------------------------------------------- help
  helpLede:
    'Galeri ini disusun seperti sebuah bangunan: anda melalui koridor utama, memilih pintu, dan melangkah ke dalam setiap ruang.',
  helpCorridorTitle: 'Koridor utama',
  helpCorridorBody:
    'Tatal ke bawah untuk bergerak di sepanjang koridor. Setiap pintu ialah satu ruang — klik atau ketuk untuk masuk.',
  helpRoomTitle: 'Di dalam ruang',
  helpRoomBody:
    'Setiap karya digantung pada dinding ruang. Buka mana-mana karya untuk membaca kisahnya; gunakan ← → untuk beralih antara karya.',
  help3dTitle: 'Jalan dalam 3D',
  help3dBody:
    'Ruang galeri tertentu boleh dijelajahi sebagai koridor 3D. Tatal atau tekan ↑ ↓ untuk berjalan, dan Esc untuk keluar.',
  helpGalleryTitle: 'Mod galeri',
  helpGalleryBody:
    'Hidupkan mod galeri pada bar atas, kemudian gunakan anak panah untuk berjalan dari ruang ke ruang dan dari karya ke karya. Bacaan kedudukan menunjukkan di mana anda berada.',
  helpA11yTitle: 'Kebolehcapaian',
  helpA11yBody:
    'Ikon senarai di kanan atas memaparkan seluruh laman sebagai dokumen biasa. Semua ruang boleh dicapai dengan papan kekunci.',
  reducedMotionOn: 'Mod gerakan minimum dikesan — animasi dikurangkan secara automatik.',
};

type Dict = typeof ms;

const en: Dict = {
  gateLabel: 'Enter PORT',
  est: 'Est. 2011 · Ipoh, Perak',
  subtitle: 'People Of Remarkable Talents',
  welcomeBefore: 'Ready to explore the world of',
  welcomeArt: 'ART',
  welcomeAfter: '?',
  line: 'Come on in, our doors are always open...',
  enter: 'Enter PORT',
  listView: 'Text-only view',
  watchWithSound: 'watch with sound',
  switchLang: 'Tukar ke Bahasa Melayu',
  nowShowing: 'Now showing',

  cursorEnter: 'ENTER',
  cursorOpen: 'OPEN',
  cursorClose: 'CLOSE',
  cursorPrev: '←',
  cursorNext: '→',
  cursorWalk: 'WALK',
  cursorRead: 'READ',
  cursorDrag: 'DRAG',
  cursorEsc: 'ESC',
  cursorZoom: 'VIEW',
  cursorView: 'VIEW',

  brandLine: 'People Of Remarkable Talents · Perak',
  home: 'Home',
  rooms: 'Rooms',
  films: 'Films',
  contact: 'Contact',
  toList: 'View as a text-only page',
  toGallery: 'Back to the gallery',
  help: 'Guide',
  helpTitle: 'How to explore the gallery',
  close: 'Close',
  back: 'Back',
  skipToContent: 'Skip to content',

  hallKicker: 'A Gallery of Light · Ipoh, Perak',
  hallTitleA: 'Art that',
  hallTitleB: 'glows',
  hallLede:
    "PORT is home to Perak's creative community — programmes, residencies, exhibitions and archives, now presented as a gallery you can walk through.",
  beginTour: 'Begin the tour',
  scrollHint: 'Scroll to walk',
  corridorKicker: 'The Main Corridor',
  corridorTitle: 'Eight rooms, one journey',
  corridorLede: "Each room holds one chapter of PORT's story. Choose a door and step inside.",
  chapterWelcome: 'Welcome',
  chapterOnView: 'On view',
  chapterRooms: 'Rooms',
  chapterFigures: 'The collection',
  chapterVisit: 'Visit',
  exhibitionKicker: 'Current Exhibition',
  exhibitionTitle: 'Now on view',
  exhibitionLede:
    'Three works currently on at PORT — chosen to be read, not just scrolled past. Each one opens its own room.',
  roomWord: 'Room',
  enterRoom: 'Enter room',
  works: 'works',
  films_count: 'recordings',
  profile: 'Profile',
  statYears: 'Years of practice',
  statRooms: 'Gallery rooms',
  statWorks: 'Works & programmes',
  statFilms: 'Video recordings',
  filmKicker: 'Screening Room',
  filmTitle: 'PORT in motion',
  filmLede: "Interviews, symposia and performances — PORT's video archive, arranged by programme.",
  openScreening: 'Open the screening room',
  visitKicker: 'Visit',
  visitTitle: 'Come to the Black House',
  visitNote: 'Visits, collaborations and programme entries — all are welcome.',
  directions: 'Open in Google Maps',
  motto: 'Unity Thru Arts',
  footerSource: 'Content synced from',

  galleryMode: 'Gallery mode · keyboard',
  galleryKeys: '← → or ↑ ↓ to walk · Enter to open · Esc to exit',
  galleryKeysRoom: '← → or ↑ ↓ to step through works · Enter to open · Esc to exit',
  galleryKeysPlain: '← → or ↑ ↓ to walk · Esc to exit',
  galleryExit: 'Exit',
  galleryStop: 'Stop',
  galleryWork: 'Work',

  // --------------------------------------------------------------- curator's eye
  curatorMode: "Curator's Eye · guided tour",
  curatorOn: 'Tour begun — sit back and let the gallery move.',
  curatorPause: 'Pause',
  curatorResume: 'Resume',
  curatorNote: "Curator's note",
  curatorWelcome: 'Welcome to PORT. This corridor runs from the threshold to the screening room — eight rooms, one song of light.',
  curatorThreshold: 'It begins here: PORT\u2019s own film on the wall, light painted live in the air. This is the room returning your gaze.',
  curatorOnview: 'Now on view — works chosen from across PORT\u2019s practice, hung one by one.',
  curatorRooms: 'Each room wears the language of the art it holds. Step into any one of them.',
  curatorFigures: 'The collection in numbers: works, artists, residencies, archives — a house measured by what it keeps.',
  curatorVisit: 'The way in. PORT lives at Kampung Karyawan Amanjaya, Ipoh — come for a screening, stay for the rooms.',
  curatorWorkNote: 'Curated to be seen up close — approach when ready.',
  curatorDone: 'The tour ends — the corridor carries on without you.',

  room: 'Room',
  roomOf: 'of',
  intro: 'Introduction',
  collection: 'Collection',
  walk3d: 'Walk in 3D',
  walk3dNote: 'Stroll through a virtual gallery corridor',
  prevRoom: 'Previous room',
  nextRoom: 'Next room',
  backToHall: 'Back to the corridor',
  openWork: 'View work',
  list: 'Listings',

  category: 'Category',
  period: 'Date',
  details: 'Details',
  gallery: 'Gallery',
  originalSource: 'Original source',
  previous: 'Previous',
  next: 'Next',
  originalLanguage: 'The full text below is in its original Bahasa Melayu.',
  imageOf: 'Image',

  walkKicker: 'Gallery',
  backToRoom: 'Exit 3D',
  walkBack: 'Back',
  walkFwd: 'Forward',
  hintWalkCoarse: 'Swipe up / down to walk · Tap a frame to read',
  hintWalkFine: 'Scroll or ↑ ↓ to walk · Click a frame to read',
  worksIn: 'Works in',
  loading3d: 'Preparing the 3D space…',
  opening: 'Opening…',
  no3d: 'This device does not support 3D graphics.',

  location: 'Location',
  address: 'Address',
  phone: 'Phone',
  fax: 'Fax',
  email: 'Email',
  directionsShort: 'Directions',
  partners: 'Strategic Partners',
  mapTitle: 'Map of PORT Ipoh',
  viewMap: 'View the map',

  screeningMark: 'PORT / SCREENING ROOM',
  movingArchive: 'The moving archive',
  selectedRecordings: 'selected recordings · choose one to watch',
  connecting: 'Loading the film…',
  opensOnYoutube: 'This film plays on YouTube',
  watchOnYoutube: 'Watch on YouTube',
  openOnYoutube: 'Open on YouTube',
  nowPlaying: 'Now playing',
  play: 'Play',
  videoProgrammes: 'Video programmes',
  allRecordingsFrom: 'All recordings are streamed from',
  onYoutube: 'on YouTube.',
  videoEmptyA: "We're still arranging the recordings. In the meantime, PORT's full video archive is on",
  videoEmptyLink: 'our YouTube channel',

  flatIntro:
    'Kampung Karyawan Amanjaya — a cultural agency fully funded by the Perak State Government, founded in 2011 to bring the arts closer to the public.',
  stationsNav: 'Rooms',
  flatFooterPages: 'pages and',
  flatFooterImages: 'images synced from',

  helpLede:
    'The gallery is laid out like a building: you move along a main corridor, choose a door, and step into each room.',
  helpCorridorTitle: 'The main corridor',
  helpCorridorBody:
    'Scroll down to move along the corridor. Every door is a room — click or tap to go in.',
  helpRoomTitle: 'Inside a room',
  helpRoomBody:
    'Works hang on the walls of each room. Open any work to read its story, and use ← → to move between works.',
  help3dTitle: 'Walk in 3D',
  help3dBody:
    'Some rooms can be explored as a 3D corridor. Scroll or press ↑ ↓ to walk, and Esc to leave.',
  helpGalleryTitle: 'Gallery mode',
  helpGalleryBody:
    'Switch on gallery mode in the top bar, then walk with the arrow keys from room to room and from work to work. The readout shows where you are.',
  helpA11yTitle: 'Accessibility',
  helpA11yBody:
    'The list icon at the top right shows the whole site as a plain document. Every room can be reached with the keyboard.',
  reducedMotionOn: 'Reduced motion detected — animation is toned down automatically.',
};

const dictionaries: Record<Lang, Dict> = { ms, en };

export type I18nKey = keyof Dict;

export function t(lang: Lang, key: I18nKey): string {
  return dictionaries[lang]?.[key] ?? ms[key] ?? key;
}
