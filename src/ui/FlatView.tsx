import { contentMeta, stations } from '../content';
import { Glyph } from './Glyph';
import { StationContent } from './StationPanel';

/**
 * The whole space as a plain document. This is what search engines, screen readers,
 * very old devices and anyone who simply prefers reading get — same content, no 3D.
 */
export function FlatView() {
  return (
    <main className="flat">
      <header className="flat-hero">
        <h1>PORT</h1>
        <p style={{ letterSpacing: '0.32em', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--accent)' }}>
          People Of Remarkable Talents
        </p>
        <p>
          Kampung Karyawan Amanjaya — agensi kebudayaan yang didanai sepenuhnya oleh Kerajaan
          Negeri Perak. Diasaskan pada tahun 2011 untuk mengetengahkan bidang seni ke mata
          masyarakat.
        </p>
      </header>

      <nav className="flat-nav" aria-label="Stesen">
        {stations.map((s) => (
          <a key={s.id} href={`#${s.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <Glyph glyph={s.glyph} size={14} />
            {s.label}
          </a>
        ))}
      </nav>

      {stations.map((station) => (
        <section
          className="flat-station"
          id={station.id}
          key={station.id}
          style={{ ['--station-accent' as string]: station.accent }}
        >
          <header>
            <Glyph glyph={station.glyph} size={22} />
            <h2>{station.label}</h2>
            <span>
              {station.exhibits.length > 0
                ? `${station.exhibits.length} karya`
                : 'Profil'}
            </span>
          </header>
          <StationContent station={station} />
        </section>
      ))}

      <footer style={{ color: 'var(--muted)', fontSize: '0.78rem', paddingTop: '2rem' }}>
        <p>
          {contentMeta.counts.pages} halaman dan {contentMeta.counts.images} imej diselaraskan
          daripada{' '}
          <a href={contentMeta.source} target="_blank" rel="noreferrer noopener">
            portipoh.com
          </a>
          . PORT (People Of Remarkable Talents), Ipoh, Perak.
        </p>
      </footer>
    </main>
  );
}
