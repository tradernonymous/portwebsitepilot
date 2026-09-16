import { useEffect } from 'react';

type Props = {
  onClose: () => void;
  reducedMotion: boolean;
};

export function HelpPanel({ onClose, reducedMotion }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="panel-scrim" onClick={onClose} role="presentation" />
      <section
        className="panel centered"
        role="dialog"
        aria-modal="true"
        aria-label="Cara menerokai ruang ini"
      >
        <div className="panel-top">
          <div className="panel-title">
            <p className="panel-kicker">Panduan</p>
            <h2>Cara menerokai ruang ini</h2>
            <p className="lede">
              Ruang ini direka seperti sebuah bangunan: anda berdiri di dek, memilih pintu,
              dan berjalan di dalam galeri.
            </p>
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

        <div className="panel-body">
          <div className="help-grid">
            <div>
              <h4>Dek utama</h4>
              <p style={{ color: 'var(--ink-dim)', fontSize: '0.88rem' }}>
                <span className="kbd">Seret</span> untuk memandang sekeliling. Klik mana-mana
                monolit untuk memasuki stesennya. Dock di bawah juga membawa anda ke stesen
                yang sama.
              </p>
            </div>
            <div>
              <h4>Di dalam galeri</h4>
              <p style={{ color: 'var(--ink-dim)', fontSize: '0.88rem' }}>
                <span className="kbd">Scroll</span> atau <span className="kbd">↑</span>
                <span className="kbd">↓</span> untuk berjalan. Klik mana-mana bingkai karya
                untuk membacanya. Panel kiri memecutkan perjalanan anda.
              </p>
            </div>
            <div>
              <h4>Pintu keluar</h4>
              <p style={{ color: 'var(--ink-dim)', fontSize: '0.88rem' }}>
                Berjalan ke hujung koridor dan klik portal bercahaya, atau tekan{' '}
                <span className="kbd">Esc</span> untuk kembali ke dek.
              </p>
            </div>
            <div>
              <h4>Kebolehcapaian</h4>
              <p style={{ color: 'var(--ink-dim)', fontSize: '0.88rem' }}>
                Gunakan ikon di kanan atas untuk membaca laman ini sebagai senarai biasa.
                {reducedMotion
                  ? ' Mod gerakan minimum dikesan — animasi dilangkau secara automatik.'
                  : ''}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
