// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SiteFooter } from '@/modules/layout/ui/site-footer';

afterEach(cleanup);

describe('SiteFooter', () => {
  it('is the contentinfo landmark with the legacy section headings', () => {
    render(<SiteFooter />);
    const footer = screen.getByRole('contentinfo');
    const headings = within(footer)
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      'Centro de ayuda',
      'Redes Sociales',
      'Conócenos',
      'Atención a clientes',
      'Oficina central:',
      'Centro de desarrollo tecnológico:',
    ]);
  });

  it('links the legacy pages with plain relative anchors', () => {
    render(<SiteFooter />);
    const footer = screen.getByRole('contentinfo');
    const href = (name: string) => within(footer).getByRole('link', { name }).getAttribute('href');

    expect(href('Preguntas Frecuentes FAQ')).toBe('/preguntas-frecuentes');
    expect(href('Facturación')).toBe('/facturacion');
    expect(href('Acerca de Chupaprecios')).toBe('/acerca-de-chupaprecios');
    expect(href('Términos y Condiciones')).toBe('/terminos-y-condiciones');
    expect(href('Política de Privacidad')).toBe('/aviso-privacidad');
    expect(href('Propiedad Intelectual')).toBe('/propiedad-intelectual');
    expect(href('(+52) 664 311 9682')).toBe('tel:+526643119682');
  });

  it('social links open in a new tab safely and say so', () => {
    render(<SiteFooter />);
    const links = screen.getAllByRole('link', { name: /Instagram/ });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).toBe('https://www.instagram.com/chupaprecios/');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.textContent + (link.getAttribute('aria-label') ?? '')).toContain(
        'se abre en una pestaña nueva',
      );
    }
  });

  it('lists the payment methods with text alternatives', () => {
    render(<SiteFooter />);
    const list = screen.getByRole('list', { name: 'Métodos de pago' });
    expect(
      within(list)
        .getAllByRole('img')
        .map((img) => img.getAttribute('alt')),
    ).toEqual([
      'Visa',
      'Mastercard',
      'PayPal',
      'American Express',
      'Mercado Pago',
      'Kueski Pay',
      'OXXO',
      'SPEI',
    ]);
  });
});
