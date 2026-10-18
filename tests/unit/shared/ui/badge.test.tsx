// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Badge } from '@/shared/ui/badge';

afterEach(cleanup);

describe('Badge', () => {
  it.each([
    ['new', 'bg-ds-green'],
    ['sale', 'bg-ds-accent'],
    ['featured', 'bg-ds-amber'],
    ['soldout', 'bg-ds-text-tertiary'],
    ['shipping', 'bg-ds-teal'],
    ['lastunits', 'bg-ds-orange'],
    ['neutral', 'bg-ds-surface-muted'],
  ] as const)('maps variant %s to %s', (variant, fill) => {
    render(<Badge variant={variant}>Etiqueta</Badge>);
    expect(screen.getByText('Etiqueta').className).toContain(fill);
  });

  it('defaults to neutral, uses radius xs and keeps extra props', () => {
    render(
      <Badge className="ml-2" data-testid="badge">
        Nuevo
      </Badge>,
    );
    const badge = screen.getByTestId('badge');
    expect(badge.tagName).toBe('SPAN');
    expect(badge.className).toContain('bg-ds-surface-muted');
    expect(badge.className).toContain('rounded-xs');
    expect(badge.className).toContain('ml-2');
  });
});
