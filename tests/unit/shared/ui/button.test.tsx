// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/shared/ui/button';

afterEach(cleanup);

describe('Button', () => {
  it('renders a native button that defaults to type="button"', () => {
    render(<Button>Guardar</Button>);
    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveProperty('type', 'button');
  });

  it('forwards type and click handlers', () => {
    const onClick = vi.fn();
    render(
      <Button type="submit" onClick={onClick}>
        Enviar
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Enviar' });
    expect(button).toHaveProperty('type', 'submit');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies the primary CTA fill and the md size by default', () => {
    render(<Button>Comprar</Button>);
    const button = screen.getByRole('button', { name: 'Comprar' });
    expect(button.className).toContain('bg-ds-cta');
    expect(button.className).toContain('hover:bg-ds-cta-hover');
    expect(button.className).toContain('active:bg-ds-cta-pressed');
    expect(button.className).toContain('rounded-pill');
    expect(button.className).toContain('h-10');
    expect(button.className).toContain('focus-visible:outline-ds-focus');
    expect(button.className).toContain('focus-visible:outline-offset-2');
  });

  it.each([
    ['xs', 'h-6'],
    ['sm', 'h-8'],
    ['md', 'h-10'],
    ['lg', 'h-12'],
    ['xl', 'h-14'],
  ] as const)('maps size %s to %s', (size, height) => {
    render(<Button size={size}>Tamaño</Button>);
    expect(screen.getByRole('button').className).toContain(height);
  });

  it('renders the secondary outline and the tertiary text variants', () => {
    render(
      <>
        <Button variant="secondary">Contorno</Button>
        <Button variant="tertiary">Texto</Button>
      </>,
    );
    const secondary = screen.getByRole('button', { name: 'Contorno' });
    expect(secondary.className).toContain('border-ds-link');
    expect(secondary.className).not.toContain('bg-ds-cta');
    const tertiary = screen.getByRole('button', { name: 'Texto' });
    expect(tertiary.className).toContain('text-ds-link');
    expect(tertiary.className).toContain('bg-transparent');
  });

  it('keeps the caller className', () => {
    render(<Button className="min-w-48 flex-1">Extra</Button>);
    expect(screen.getByRole('button').className).toContain('min-w-48 flex-1');
  });

  it('disables the button and uses the disabled fill', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        No disponible
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'No disponible' });
    expect(button).toHaveProperty('disabled', true);
    expect(button.className).toContain('bg-ds-disabled');
    expect(button.className).not.toContain('hover:bg-ds-cta-hover');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('loading sets aria-busy, shows a spinner, keeps the label and blocks clicks', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Agregando...
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Agregando...' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button).toHaveProperty('disabled', true);
    expect(button.querySelector('[data-slot="spinner"]')).not.toBeNull();
    // The label stays in the layout (keeps the width) and in the accessibility tree.
    expect(button.querySelector('[data-slot="label"]')?.className).toContain('opacity-0');
    // Loading keeps the variant colour instead of the disabled fill.
    expect(button.className).toContain('bg-ds-cta');
    expect(button.className).not.toContain('bg-ds-disabled');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('has no aria-busy when not loading', () => {
    render(<Button>Listo</Button>);
    expect(screen.getByRole('button').hasAttribute('aria-busy')).toBe(false);
  });

  it('renders an internal link when given an href', () => {
    render(<Button href="/cart">Ver carrito</Button>);
    const link = screen.getByRole('link', { name: 'Ver carrito' });
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/cart');
    expect(link.className).toContain('bg-ds-cta');
    expect(link.hasAttribute('type')).toBe(false);
  });

  it('renders a plain anchor for external urls and for nativeAnchor', () => {
    render(
      <>
        <Button href="https://example.com/">Externo</Button>
        <Button href="/checkout" nativeAnchor>
          Pagar
        </Button>
      </>,
    );
    expect(screen.getByRole('link', { name: 'Externo' }).getAttribute('href')).toBe(
      'https://example.com/',
    );
    expect(screen.getByRole('link', { name: 'Pagar' }).getAttribute('href')).toBe('/checkout');
  });

  it('a disabled link loses its href and is marked aria-disabled', () => {
    render(
      <Button href="/cart" disabled>
        Ver carrito
      </Button>,
    );
    const link = screen.getByText('Ver carrito').closest('a');
    expect(link).not.toBeNull();
    expect(link?.hasAttribute('href')).toBe(false);
    expect(link?.getAttribute('aria-disabled')).toBe('true');
  });
});
