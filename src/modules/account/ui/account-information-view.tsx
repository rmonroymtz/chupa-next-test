'use client';

import Image from 'next/image';
import { avatarInitials } from '@/modules/account/domain/account-pages';
import { phoneDisplay, profileFullName } from '@/modules/account/domain/profile-form';
import { useAccountProfile } from '@/modules/account/ui/account-profile';
import { Button } from '@/shared/ui/button';

export const EDIT_PROFILE_PATH = '/my-account/edit-account-information';

/** Legacy `AccountInformationPage` (`/my-account/account-information`): the profile, read only. */
export function AccountInformationView() {
  const { profile } = useAccountProfile();
  const name = profileFullName(profile);
  const phone = phoneDisplay(profile.phone);

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-sm font-bold tracking-wide text-ds-text-secondary">MI PERFIL</h1>
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
        <p className="text-2xl font-bold text-ds-text">{name}</p>
      </div>
      <dl className="flex flex-col gap-4 text-ds-text">
        <div className="flex flex-col gap-1">
          <dt className="text-sm text-ds-text-secondary">Correo electrónico</dt>
          <dd>{profile.email}</dd>
        </div>
        {phone ? (
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-ds-text-secondary">Teléfono</dt>
            <dd>{phone}</dd>
          </div>
        ) : null}
      </dl>
      <div>
        <Button href={EDIT_PROFILE_PATH} nativeAnchor>
          EDITAR DATOS
        </Button>
      </div>
    </div>
  );
}
