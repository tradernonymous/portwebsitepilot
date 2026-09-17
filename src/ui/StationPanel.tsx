import { contact, googleMapEmbedUrl, partners, type Station } from '../content';
import { useLang } from '../lib/lang';
import { VideoRoom } from './VideoRoom';

/**
 * Shared between the slide-over panel and the flat (non-3D) view, so the same markup
 * serves the spatial experience and the plain document.
 *
 * Exhibit entries are real anchors to `#/s/<station>/<index>`: they deep-link, they
 * open in a new tab, and they work without any pointer at all.
 */
export function StationContent({ station }: { station: Station }) {
  const { t } = useLang();
  // A shelf of films is not a list of cards, so the plain view hands the whole section
  // over to the room rather than rendering a stub of it.
  if (station.kind === 'video') return <VideoRoom station={station} />;

  return (
    <>
      {station.intro.map((para, i) => (
        <p key={i} className="station-intro">
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
          <h3>{station.kind === 'list' ? t('list') : t('collection')}</h3>
          <div className="exhibit-cards">
            {station.exhibits.map((ex, i) => (
              <a
                key={ex.id}
                className="exhibit-card lit"
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

export function ContactContent() {
  const { t } = useLang();
  const mapsQuery = encodeURIComponent(
    'PORT Ipoh, Jalan Sultan Azlan Shah, 31400 Ipoh, Perak',
  );

  return (
    <>
      <div className="section">
        <h3>{t('location')}</h3>
        <div className="contact-grid">
          <div className="contact-card">
            <h4>{t('address')}</h4>
            <p>{contact.name}</p>
            {contact.addressLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="contact-card">
            <h4>{t('phone')}</h4>
            <a href={contact.phoneHref}>{contact.phone}</a>
            <p className="contact-fax">
              {t('fax')} {contact.fax}
            </p>
          </div>
          <div className="contact-card">
            <h4>{t('email')}</h4>
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
          </div>
          <div className="contact-card">
            <h4>{t('directionsShort')}</h4>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              {t('directions')} →
            </a>
          </div>
        </div>

        <div className="map-frame">
          {googleMapEmbedUrl ? (
            <iframe
              src={googleMapEmbedUrl}
              title={t('mapTitle')}
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
                  {t('viewMap')}
                </a>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="section">
        <h3>{t('partners')}</h3>
        <div className="partner-strip">
          {partners.map((p) => (
            <img key={p.small} src={p.small} alt={p.caption} loading="lazy" />
          ))}
        </div>
      </div>
    </>
  );
}
