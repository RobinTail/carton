import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * Catches render-time failures in a subtree. Used around the 3D canvas, where a
 * renderer can still fail after the WebGL probe passes — a driver reset, an
 * exhausted context pool, or the lazy chunk failing to download.
 *
 * State resets naturally: the boundary is only mounted while the 3D tab is
 * open, so switching away and back gives the canvas a fresh attempt.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
