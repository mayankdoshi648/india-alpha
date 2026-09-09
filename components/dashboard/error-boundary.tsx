"use client";

import { Component, type ReactNode } from "react";

export class DeskErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { err: Error | null }
> {
  state: { err: Error | null } = { err: null };

  static getDerivedStateFromError(err: Error) {
    return { err };
  }

  render() {
    if (this.state.err) {
      return (
        this.props.fallback ?? (
          <div className="rounded-xl border border-rose-400/30 bg-rose-950/40 p-4 text-sm text-rose-200">
            <p className="font-medium">This panel failed to render.</p>
            <p className="mt-1 text-rose-300/80">{this.state.err.message}</p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
