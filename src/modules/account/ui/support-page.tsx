import Image from 'next/image';
import type { ReactNode } from 'react';
import whatsappQr from '@/modules/account/ui/assets/whatsapp-qr.png';
import { ChatButtons } from '@/modules/account/ui/chat-buttons.client';

const PHONE = '(+52) 664 311 9682';
const WHATSAPP_URL = 'https://wa.me/526643119682';

/**
 * Legacy `Contact` (`/my-account/support`): a static page with the phone,
 * WhatsApp and online chat cards. No form, no request.
 */
export function SupportPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-sm font-bold tracking-wide text-ds-text-secondary">
        ATENCIÓN A CLIENTES
      </h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="TELÉFONO">
          <p className="text-lg font-semibold text-ds-text">{PHONE}</p>
          <p>Lunes a sábados: 09:00hs a 18:00hs</p>
          <p>Domingos: 10:00hs a 16:00hs</p>
        </Card>
        <Card title="WHATSAPP">
          <p className="text-lg font-semibold text-ds-text">{PHONE}</p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xs font-semibold text-ds-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus"
          >
            Click para ir a Whatsapp web
          </a>
          <Image
            src={whatsappQr}
            alt="Código QR para abrir el chat de WhatsApp"
            width={160}
            height={160}
            className="size-40"
          />
        </Card>
        <Card title="CHAT EN LÍNEA">
          <ChatButtons />
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-ds-border-subtle bg-ds-surface p-5 text-sm text-ds-text-secondary">
      <h2 className="text-sm font-bold tracking-wide text-ds-text">{title}</h2>
      {children}
    </section>
  );
}
