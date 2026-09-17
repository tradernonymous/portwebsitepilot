import { contentMeta } from '../content';
import { useLang } from '../lib/lang';
import { videoCount } from '../content/videos';
import { Glyph } from './Glyph';
import { StationContent } from './StationPanel';

/**
 * The whole space as a plain document. This is what search engines, screen readers,
 * very old devices and anyone who simply prefers reading get — same content, no 3D.
 */
export function FlatView() {
  const { t, stations } = useLang();
  return (
    <main className="flat">
      <header className="flat-hero">
        <h1>PORT</h1>
        <p className="flat-sub">{t('subtitle')}</p>
        <p className="serif-lede">{t('flatIntro')}</p>
      </header>

      <nav className="flat-nav" aria-label={t('stationsNav')}>
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
              {station.kind === 'video'
                ? `${videoCount()} ${t('films_count')}`
                : station.exhibits.length > 0
                  ? `${station.exhibits.length} ${t('works')}`
                  : t('profile')}
            </span>
          </header>
          <StationContent station={station} />
        </section>
      ))}

      <footer className="flat-footer">
        <p>
          {contentMeta.counts.pages} {t('flatFooterPages')} {contentMeta.counts.images}{' '}
          {t('flatFooterImages')}{' '}
          <a href={contentMeta.source} target="_blank" rel="noreferrer noopener">
            portipoh.com
          </a>
          . PORT (People Of Remarkable Talents), Ipoh, Perak.
        </p>
      </footer>
    </main>
  );
}
