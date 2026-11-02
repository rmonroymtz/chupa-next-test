// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupportPage } from '@/modules/account/ui/support-page';

afterEach(() => {
  cleanup();
  delete (window as { ChupaChat?: unknown }).ChupaChat;
});

describe('SupportPage', () => {
  it('shows the phone, WhatsApp and chat cards with the legacy copy', () => {
    render(<SupportPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'ATENCIÓN A CLIENTES' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'TELÉFONO' })).toBeTruthy();
    expect(screen.getByText('Lunes a sábados: 09:00hs a 18:00hs')).toBeTruthy();
    expect(screen.getByText('Domingos: 10:00hs a 16:00hs')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'WHATSAPP' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'CHAT EN LÍNEA' })).toBeTruthy();
    expect(screen.getAllByText('(+52) 664 311 9682').length).toBeGreaterThanOrEqual(2);
  });

  it('links to WhatsApp web in a new tab', () => {
    render(<SupportPage />);
    const link = screen.getByRole('link', { name: 'Click para ir a Whatsapp web' });
    expect(link.getAttribute('href')).toBe('https://wa.me/526643119682');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('opens the chat widget from both buttons', () => {
    const open = vi.fn();
    (window as { ChupaChat?: unknown }).ChupaChat = { open };
    render(<SupportPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Chupaprecios' }));
    fireEvent.click(screen.getByRole('button', { name: 'Click para abrir el chat' }));
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('does not fail when the chat widget has not loaded', () => {
    render(<SupportPage />);
    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Chupaprecios' })),
    ).not.toThrow();
  });
});
