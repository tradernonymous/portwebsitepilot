import { useEffect, useRef } from 'react';
import { contact, googleMapEmbedUrl, partners, type Station } from '../content';

type Props = {
  station: Station;
  onClose: () => void;
};

export function StationPanel({ station, onClose }: Props) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [station.id]);

  return (
    <>
      <div className="panel-scrim" onClick={onClose} role="presentation" />
      <section
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-label={station.label}
        style={{ borderLeftColor: station.accent }}
      >
        <div className="panel-top">
          <div className="panel-title">
            <p className="panel-kicker" style={{ color: station.accent }}>
              Stesen
            </p>
            <h2>{station.label}</h2>
          </div>
          <button
            type="button"
            className="icon-btn close-btn"
            onClick={onClose}
            aria-label="Tutup"
            title="Tutup"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3Z"
              />
            </svg>
          </button>
        </div>

        <div className="panel-body" ref={scroller}>
          <StationContent station={station} />
        </div>
      </section>
    </>
  );
}

/**
 * Shared between the slide-over panel and the flat (non-3D) view, so the same markup
 * serves the spatial experience and the plain document.
 *
 * Exhibit entries are real anchors to `#/s/<station>/<index>`: they deep-link, they
 * open in a new tab, and they work without any pointer at all.
 */
export function StationContent({ station }: { station: Station }) {
  return (
    <>
      {station.intro.map((para, i) => (
        <p key={i} style={{ color: 'var(--ink-dim)', maxWidth: '74ch' }}>
          {para}
        </p>
      ))}

      {station.sections?.map((section) => (
        <div className="section" key={section.heading}>
          <h3>{section.heading}</h3>
          {section.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {section.bullets?.length ? (
            <ul className="bullets">
              {section.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}

      {station.kind === 'contact' ? <ContactContent /> : null}

      {station.exhibits.length > 0 ? (
        <div className="section">
          <h3>{station.kind === 'list' ? 'Senarai' : 'Karya'}</h3>
          <div className="exhibit-cards">
            {station.exhibits.map((ex, i) => (
              <a
                key={ex.id}
                className="exhibit-card"
                href={`#/s/${station.id}/${i}`}
                style={{ textDecoration: 'none' }}
              >
                {ex.images[0] ? (
                  <img src={ex.images[0].small} alt="" loading="lazy" />
                ) : (
                  <span className="noimg" aria-hidden="true">
                    —
                  </span>
                )}
                <span style={{ display: 'block' }}>
                  <span className="meta">{ex.meta}</span>
                  <h4>{ex.title}</h4>
                  <p>{ex.tagline}</p>
                </span>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function ContactContent() {
  const mapsQuery = encodeURIComponent(
    'PORT Ipoh, Jalan Sultan Azlan Shah, 31400 Ipoh, Perak',
  );

  return (
    <>
      <div className="section">
        <h3>Lokasi</h3>
        <div className="contact-grid">
          <div className="contact-card">
            <h4>Alamat</h4>
            <p>{contact.name}</p>
            {contact.addressLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="contact-card">
            <h4>Telefon</h4>
            <a href={contact.phoneHref}>{contact.phone}</a>
            <p style={{ color: 'var(--muted)', marginTop: '0.4rem' }}>Faks {contact.fax}</p>
          </div>
          <div className="contact-card">
            <h4>E-mel</h4>
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
          </div>
          <div className="contact-card">
            <h4>Arah</h4>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              Buka dalam Google Maps →
            </a>
          </div>
        </div>

        <div className="map-frame">
          {googleMapEmbedUrl ? (
            <iframe
              src={googleMapEmbedUrl}
              title="Peta lokasi PORT Ipoh"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          ) : (
            <>
              <div className="map-grid" aria-hidden="true" />
              <div className="map-note">
                <p>PORT Ipoh — No 09, Jalan Sultan Azlan Shah, 31400 Ipoh, Perak.</p>
                <a
                  className="btn btn-ghost"
                  href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Lihat peta sebenar
                </a>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="section">
        <h3>Rakan Strategik</h3>
        <div className="partner-strip">
          {partners.map((p) => (
            <img key={p.small} src={p.small} alt={p.caption} loading="lazy" />
          ))}
        </div>
      </div>
    </>
  );
}
