// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AccountInformationView } from '@/modules/account/ui/account-information-view';
import { AccountProfileProvider } from '@/modules/account/ui/account-profile';
import type { CustomerProfile } from '@/modules/customer/application/ports';

const PROFILE: CustomerProfile = {
  firstName: 'Ana',
  middleName: 'María',
  lastName: 'Pérez',
  email: 'ana@example.mx',
  phone: '6643119682',
  photoUrl: null,
};

const renderView = (profile: CustomerProfile = PROFILE) =>
  render(
    <AccountProfileProvider profile={profile}>
      <AccountInformationView />
    </AccountProfileProvider>,
  );

afterEach(cleanup);

describe('AccountInformationView', () => {
  it('shows the heading, the full name, the email and the phone with the prefix', () => {
    renderView();
    expect(screen.getByRole('heading', { level: 1, name: 'MI PERFIL' })).toBeTruthy();
    expect(screen.getByText('Ana María Pérez')).toBeTruthy();
    expect(screen.getByText('Correo electrónico')).toBeTruthy();
    expect(screen.getByText('ana@example.mx')).toBeTruthy();
    expect(screen.getByText('Teléfono')).toBeTruthy();
    expect(screen.getByText('+52 6643119682')).toBeTruthy();
    expect(screen.getByText('AP')).toBeTruthy();
  });

  it('leaves the phone out when there is none', () => {
    renderView({ ...PROFILE, phone: null });
    expect(screen.queryByText('Teléfono')).toBeNull();
  });

  it('links "EDITAR DATOS" to the edit page', () => {
    renderView();
    expect(screen.getByRole('link', { name: 'EDITAR DATOS' }).getAttribute('href')).toBe(
      '/my-account/edit-account-information',
    );
  });
});
