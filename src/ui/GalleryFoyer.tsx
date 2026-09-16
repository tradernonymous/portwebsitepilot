import type { Station } from '../content';
import { deckCovers } from '../content';
import { Glyph } from './Glyph';

type Props = {
  station: Station;
  index: number;
  total: number;
  language?: 'ms' | 'en';
  onPrevious: () => void;
  onNext: () => void;
  onEnter: () => void;
};

/**
 * The deck's editorial foyer. The 3D room stays present as atmosphere, while this keeps
 * the visitor oriented around one room and one work at a time — closer to entering a
 * gallery than selecting a node in a diagram.
 */
export function GalleryFoyer({ station, index, total, language = 'ms', onPrevious, onNext, onEnter }: Props) {
  const cover = deckCovers.get(station.id) ?? station.heroImage;
  const english = language === 'en';

  return (
    <section className="gallery-foyer immersive" aria-label={english ? `Selected room: ${station.label}` : `Ruang pilihan: ${station.label}`}>
      <div className="gallery-foyer-art">
        {cover ? <img src={cover.large} alt="" /> : <div className="gallery-foyer-empty" aria-hidden="true" />}
        <span className="gallery-foyer-index">{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
      </div>
      <div className="gallery-foyer-copy">
        <span className="gallery-foyer-kicker">
          <Glyph glyph={station.glyph} size={13} /> {english ? 'PORT / SELECTED ROOM' : 'PORT / BILIK PILIHAN'}
        </span>
        <h1>{station.label}</h1>
        <p>{station.tagline}</p>
        <div className="gallery-foyer-actions">
          <button type="button" className="btn btn-primary" onClick={onEnter}>
            {english ? 'Enter room' : 'Masuk ke ruang'} <span aria-hidden="true">↗</span>
          </button>
          <div className="gallery-foyer-pager" aria-label={english ? 'Choose another room' : 'Pilih ruang lain'}>
            <button type="button" className="foyer-arrow" onClick={onPrevious} aria-label="Ruang sebelumnya">
              ←
            </button>
            <button type="button" className="foyer-arrow" onClick={onNext} aria-label={english ? 'Next room' : 'Ruang seterusnya'}>
              →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
