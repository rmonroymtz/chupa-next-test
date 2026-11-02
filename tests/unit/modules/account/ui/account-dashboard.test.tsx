// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AccountDashboard } from '@/modules/account/ui/account-dashboard';
import { AccountProfileProvider } from '@/modules/account/ui/account-profile';
import type { CustomerProfile } from '@/modules/customer/application/ports';

const PROFILE: CustomerProfile = {
  firstName: 'Ana',
  middleName: '',
  lastName: 'Pérez',
  email: 'ana@example.mx',
  phone: null,
  photoUrl: null,
};

function renderDashboard(profile: CustomerProfile = PROFILE) {
  return render(
    <AccountProfileProvider profile={profile}>
      <AccountDashboard />
    </AccountProfileProvider>,
  );
}

afterEach(cleanup);

describe('AccountDashboard', () => {
  it('shows the heading, the greeting, the avatar initials and the intro', () => {
    renderDashboard();
    expect(screen.getByRole('heading', { level: 1, name: 'MI CUENTA' })).toBeTruthy();
    expect(screen.getByText('Hola, Ana Pérez')).toBeTruthy();
    expect(screen.getByText('AP')).toBeTruthy();
    expect(
      screen.getByText(
        'Desde aquí puedes gestionar tu perfil, ver el estado de tus pedidos, y mantener tus direcciones al día.',
      ),
    ).toBeTruthy();
  });

  it('shows the six cards as links, in order, with their descriptions', () => {
    renderDashboard();
    const links = within(screen.getByRole('list', { name: 'Secciones de tu cuenta' })).getAllByRole(
      'link',
    );
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/my-account/order-history',
      '/my-account/quotes',
      '/my-account/address-book',
      '/my-account/saved-payments',
      '/my-account/support',
      '/my-account/account-information',
    ]);
    expect(within(links[2] as HTMLElement).getByText('Direcciones')).toBeTruthy();
    expect(
      within(links[2] as HTMLElement).getByText(
        'Administra fácilmente todas tus direcciones guardadas para envíos.',
      ),
    ).toBeTruthy();
  });

  it('uses the social profile photo when there is one', () => {
    renderDashboard({ ...PROFILE, photoUrl: 'https://cdn.example/ana.jpg' });
    const photo = screen.getByRole('img', { name: 'Foto de perfil de Ana Pérez' });
    expect(photo.getAttribute('src')).toContain('ana.jpg');
    expect(screen.queryByText('AP')).toBeNull();
  });

  it('falls back to "Usuario" and "U" without a name', () => {
    renderDashboard({ ...PROFILE, firstName: '', lastName: '' });
    expect(screen.getByText('Hola, Usuario')).toBeTruthy();
    expect(screen.getByText('U')).toBeTruthy();
  });
});
