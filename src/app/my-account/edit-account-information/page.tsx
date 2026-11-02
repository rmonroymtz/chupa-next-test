import type { Metadata } from 'next';
import { EditAccountInformationForm } from '@/modules/account/ui/edit-account-information-form';

export const metadata: Metadata = { title: 'Editar datos' };

export default function EditAccountInformationRoute() {
  return <EditAccountInformationForm />;
}
