// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NodeErrorBoundary } from '@/modules/page-builder/ui/node-error-boundary.client';

afterEach(cleanup);

function Boom(): never {
  throw new Error('node exploded');
}

describe('NodeErrorBoundary (client side of per-node isolation)', () => {
  it('renders nothing for a failing node and keeps its siblings', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <>
        <NodeErrorBoundary>
          <p>antes</p>
        </NodeErrorBoundary>
        <NodeErrorBoundary>
          <Boom />
        </NodeErrorBoundary>
        <NodeErrorBoundary>
          <p>después</p>
        </NodeErrorBoundary>
      </>,
    );
    expect(container.innerHTML).toBe('<p>antes</p><p>después</p>');
  });
});
