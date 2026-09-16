import { entranceImage } from '../content';

type Props = {
  /** The 3D space has finished building and is waiting. */
  ready: boolean;
  reducedMotion: boolean;
  onEnter: () => void;
  onSkipToDeck: () => void;
  onFlat: () => void;
};

/**
 * The threshold. Held on screen until the visitor chooses to walk in, so the
 * flythrough is always something they asked for rather than something that
 * happened to them.
 */
export function EntryGate({ ready, reducedMotion, onEnter, onSkipToDeck, onFlat }: Props) {
  return (
    <div className="gate" role="dialog" aria-modal="true" aria-label="Masuk ke ruang PORT">
      {entranceImage ? (
        <div
          className="gate-photo"
          style={{ backgroundImage: `url("${entranceImage.large}")` }}
          aria-hidden="true"
        />
      ) : null}
      <div className="gate-inner">
        <p className="gate-kicker">Est. 2011 · Ipoh, Perak</p>
        <h1 className="gate-mark">PORT</h1>
        <p className="gate-sub">People Of Remarkable Talents</p>

        <p className="gate-welcome">
          Sedia nak terokai dunia <em>SENI</em>?
        </p>
        <p className="gate-line">Jemput masuk, pintu kami sentiasa terbuka...</p>

        <div className="gate-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onEnter}
            disabled={!ready}
          >
            {!ready
              ? 'Menyediakan ruang…'
              : reducedMotion
                ? 'Masuk ke dek'
                : 'Masuk ke PORT'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onSkipToDeck}
            disabled={!ready}
          >
            Langkau animasi
          </button>
          <button type="button" className="btn btn-ghost" onClick={onFlat}>
            Senarai biasa
          </button>
        </div>
      </div>
    </div>
  );
}
