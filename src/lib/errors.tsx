import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** What this boundary stands in front of — the console line and the report say its name. */
  name: string;
  /** The plain list needs no WebGL, no lazy chunks and no motion, so it is always offered. */
  flat?: boolean;
};

type State = { error: Error | null };

/**
 * One boundary between the visitor and a broken page.
 *
 * A gallery that shows nothing is worse than a gallery that shows less. Whatever dies inside
 * a boundary — a lazy chunk that never arrived, a WebGL context that would not start — is
 * contained here, named in the console so it can be fixed, and answered with a way onward:
 * reload the page, or continue in the plain list, which by construction cannot fail this way.
 *
 * The copy is bilingual inline rather than through `t()`: a boundary is the one place the
 * language provider itself may not have survived, so it must not depend on it.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[port:${this.props.name}]`, error, info.componentStack);
  }

  render() {
    const error = this.state.error;
    if (!error) return this.props.children;

    return (
      <div className="crash" role="alert">
        <p className="crash-title">The light faltered here</p>
        <p className="crash-title crash-title-ms">Cahaya terpadam di sini</p>
        <p className="crash-body">
          This part of the gallery could not be opened. Reload to try again, or continue in the
          plain list.{' '}
          <span lang="ms">
            Bahagian ini tidak dapat dibuka. Muat semula untuk cuba lagi, atau teruskan dalam
            senarai biasa.
          </span>
        </p>
        <div className="crash-actions">
          <button className="crash-retry" type="button" onClick={() => window.location.reload()}>
            Reload · Muat semula
          </button>
          {this.props.flat ? (
            <a className="crash-flat" href="#/flat">
              Plain list · Senarai biasa
            </a>
          ) : null}
        </div>
      </div>
    );
  }
}
