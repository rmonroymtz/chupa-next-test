'use client';

import { Component, type ReactNode } from 'react';

interface NodeErrorBoundaryProps {
  readonly children: ReactNode;
}

interface NodeErrorBoundaryState {
  readonly failed: boolean;
}

/**
 * Client half of the per-node isolation of Page Builder content. During server
 * rendering a failing node is caught by its `<Suspense>` (React renders the
 * empty fallback and retries on the client); on the client the error is
 * rethrown and lands here, so only that node disappears. React reports the
 * error itself (server `onError`, client `onCaughtError`).
 */
export class NodeErrorBoundary extends Component<NodeErrorBoundaryProps, NodeErrorBoundaryState> {
  override state: NodeErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): NodeErrorBoundaryState {
    return { failed: true };
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
