'use client';

import Image from 'next/image';
import {
  avatarInitials,
  DASHBOARD_CARDS,
  dashboardGreeting,
} from '@/modules/account/domain/account-pages';
import { useAccountProfile } from '@/modules/account/ui/account-profile';

/**
 * Legacy `Dashboard` (`/my-account`): greeting with the avatar (social profile
 * photo or initials), the intro and the six cards. The cards for pages that
 * are still PWA Studio's are plain anchors, like the header account menu.
 */
export function AccountDashboard() {
  const { profile } = useAccountProfile();
  const name = [profile.firstName, profile.lastName].filter((part) => part.trim()).join(' ');

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <h1 className="text-sm font-bold tracking-wide text-ds-text-secondary">MI CUENTA</h1>
        <div className="flex items-center gap-4">
          {profile.photoUrl ? (
            <Image
              src={profile.photoUrl}
              alt={`Foto de perfil de ${name}`}
              width={64}
              height={64}
              unoptimized
              className="size-16 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-16 place-items-center rounded-full bg-ds-cta text-xl font-bold text-ds-text-on-cta"
            >
              {avatarInitials(profile)}
            </span>
          )}
          <p className="text-2xl font-bold text-ds-text">{dashboardGreeting(profile)}</p>
        </div>
        <p className="max-w-2xl text-ds-text-secondary">
          Desde aquí puedes gestionar tu perfil, ver el estado de tus pedidos, y mantener tus
          direcciones al día.
        </p>
      </header>
      <ul aria-label="Secciones de tu cuenta" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DASHBOARD_CARDS.map((card) => (
          <li key={card.href}>
            <a
              href={card.href}
              className="flex h-full flex-col gap-2 rounded-lg border border-ds-border-subtle bg-ds-surface p-5 hover:border-ds-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus"
            >
              <span className="text-lg font-semibold text-ds-text">{card.title}</span>
              <span className="text-sm text-ds-text-secondary">{card.description}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
