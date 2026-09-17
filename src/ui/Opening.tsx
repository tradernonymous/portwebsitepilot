import { useLang } from '../lib/lang';

/**
 * What shows while a lazy surface's chunk arrives.
 *
 * The room that is already on screen stays exactly where it is — this is a quiet
 * `Opening…` in the corner, not a panel that shoves the page around. If a chunk is slow
 * the visitor sees that the gallery heard them, not a frozen page.
 */
export function Opening() {
  const { t } = useLang();
  return (
    <div className="opening" role="status" aria-live="polite">
      <span className="opening-dot" aria-hidden="true" />
      {t('opening')}
    </div>
  );
}
