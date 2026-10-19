// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SiteFooter } from '@/modules/layout/ui/site-footer';

afterEach(cleanup);

const footer = () => {
  render(<SiteFooter />);
  return screen.getByRole('contentinfo');
};

describe('SiteFooter', () => {
  it('is the contentinfo landmark with the PWA footer section headings', () => {
    const headings = within(footer())
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      'Centro de ayuda',
      'Redes sociales',
      'Conócenos',
      'Atención a clientes',
      'Oficina central',
      'Centro de desarrollo tecnológico',
      'Formas de pago',
    ]);
  });

  it('titles the payment logos "Formas de pago" right above them, as the PWA footer', () => {
    const list = within(footer()).getByRole('list', { name: 'Métodos de pago' });
    const heading = list.previousElementSibling;
    // PWA `.col`: column title (16px bold inverse, 8px bottom margin) then the logos, 8px gap.
    expect(heading?.tagName).toBe('H2');
    expect(heading?.textContent).toBe('Formas de pago');
    expect(heading?.className.split(' ')).toEqual(
      expect.arrayContaining(['text-body-lg', 'font-bold', 'text-ds-text-inverse', 'mb-2']),
    );
    expect(heading?.parentElement?.className.split(' ')).toEqual(
      expect.arrayContaining(['flex', 'flex-col', 'gap-2']),
    );
  });

  it('links the legacy pages with plain relative anchors', () => {
    const root = footer();
    const href = (name: string) => within(root).getByRole('link', { name }).getAttribute('href');

    expect(href('Preguntas Frecuentes (FAQ)')).toBe('/preguntas-frecuentes');
    expect(href('Acerca de Chupaprecios')).toBe('/acerca-de-chupaprecios');
    expect(href('Términos y Condiciones')).toBe('/terminos-y-condiciones');
    expect(href('Política de Privacidad')).toBe('/aviso-privacidad');
    expect(href('Propiedad Intelectual')).toBe('/propiedad-intelectual');
    expect(href('(+52) 664 311 9682')).toBe('tel:+526643119682');
  });

  it('lists only the PWA footer links (no "Facturación"), and keeps the phone in regular weight', () => {
    const root = footer();
    const help = within(root).getByRole('heading', { name: 'Centro de ayuda' }).nextElementSibling;
    expect(
      within(help as HTMLElement)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Preguntas Frecuentes (FAQ)']);
    expect(within(root).queryByRole('link', { name: 'Facturación' })).toBeNull();
    const phone = within(root).getByRole('link', { name: '(+52) 664 311 9682' });
    expect(phone.className).not.toContain('font-semibold');
    expect(phone.className).not.toContain('font-bold');
  });

  it.each([
    ['Facebook', 'https://www.facebook.com/p/Chupaprecios-100070557248938/'],
    ['Instagram', 'https://www.instagram.com/chupaprecios/'],
  ])('%s links open in a new tab safely and say so', (network, url) => {
    const links = within(footer()).getAllByRole('link', { name: new RegExp(network) });
    // The round icon button next to the wordmark and the text link of the column.
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link.getAttribute('href')).toBe(url);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.textContent + (link.getAttribute('aria-label') ?? '')).toContain(
        'se abre en una pestaña nueva',
      );
    }
  });

  it('draws the social glyphs with the decorative DS Icon', () => {
    const button = within(footer()).getByRole('link', {
      name: 'Facebook (se abre en una pestaña nueva)',
    });
    const glyph = button.querySelector('svg');
    expect(glyph?.getAttribute('aria-hidden')).toBe('true');
    expect(glyph?.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('keeps the customer service hours (no "Horario:" label) and both office addresses as the PWA', () => {
    const root = footer();
    const service = within(root).getByRole('heading', { name: 'Atención a clientes' })
      .nextElementSibling as HTMLElement;
    expect([...service.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'Atención telefónica: (+52) 664 311 9682',
      'Lunes a Sábados: 08:00 a 17:00 (hora del Pacífico)',
      'Domingo: Cerrado',
    ]);
    expect(root.textContent).not.toContain('Horario');
    const addresses = Array.from(root.querySelectorAll('address')).map((address) =>
      [...address.querySelectorAll('li')].map((li) => li.textContent),
    );
    expect(addresses).toEqual([
      ['Calle Centro Comercial 17206', 'Col. Otay Constituyentes', 'C.P. 22457 Tijuana, BC.'],
      [
        'Calle Montes Urales - Virreyes 424, Oficina 01A-129',
        'Lomas de Chapultepec V Sección, Miguel Hidalgo',
        'C.P. 11000, Ciudad de México, CDMX.',
      ],
    ]);
  });

  it('shows the wordmark and the AMVO seal with text alternatives', () => {
    const root = footer();
    expect(within(root).getByRole('img', { name: 'Chupaprecios' }).getAttribute('src')).toContain(
      'logo-white.svg',
    );
    expect(
      within(root).getByRole('img', { name: 'Sello de confianza AMVO' }).getAttribute('src'),
    ).toContain('amvo-white.svg');
  });

  it('lists the PWA payment methods in its order with text alternatives, greyed out as in the DS', () => {
    const list = within(footer()).getByRole('list', { name: 'Métodos de pago' });
    const logos = within(list).getAllByRole('img');
    expect(logos.map((img) => img.getAttribute('alt'))).toEqual([
      'Visa',
      'Mastercard',
      'PayPal',
      'OXXO',
      'American Express',
      'SPEI',
    ]);
    for (const logo of logos) {
      // DS `filter: brightness(0) invert(0.72)`: one light-grey silhouette on the dark surface.
      expect(logo.className).toContain('brightness-0');
      expect(logo.className).toContain('invert-[0.72]');
    }
  });

  it('lays out 1 → 2 → 4 columns inside the 1260 site container', () => {
    const grid = footer().querySelector('[data-slot="footer-grid"]');
    expect(grid?.className).toContain('container-padded');
    expect(grid?.className).toContain('grid-cols-1');
    expect(grid?.className).toContain('md:grid-cols-2');
    expect(grid?.className).toContain('lg:grid-cols-[1.1fr_1fr_1fr_1.2fr]');
  });

  it('keeps every footer image lazy (always below the fold)', () => {
    const images = within(footer()).getAllByRole('img');
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      if (image.tagName === 'IMG') expect(image.getAttribute('loading')).toBe('lazy');
    }
  });

  it('ends with the copyright line for the current year', () => {
    expect(footer().textContent).toContain(
      `Copyright © Chupaprecios todos los derechos reservados. Powered by Chupaprecios ${new Date().getFullYear()}`,
    );
  });
});
