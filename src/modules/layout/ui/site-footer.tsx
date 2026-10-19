import Image from 'next/image';
import type { ReactNode } from 'react';
import { Icon } from '@/shared/ui/icon';
import {
  ABOUT_LINKS,
  CUSTOMER_SERVICE,
  HELP_LINKS,
  OFFICES,
  PAYMENT_LOGO_HEIGHT,
  PAYMENT_METHODS,
  SOCIAL_LINKS,
  type FooterLink,
} from './footer-content';

const NEW_TAB = ' (se abre en una pestaña nueva)';
/* `ds-focus` (#D84752) is under 3:1 on neutral-800, so the dark footer focuses in white. */
const FOCUS =
  'rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-neutral-0';
const TEXT = 'text-body-md text-ds-neutral-300';
const LINK = `${TEXT} ${FOCUS} transition-colors hover:text-ds-text-inverse hover:underline`;

/**
 * Site footer on the DS Footer organism (`designSystem/organisms/Footer`, as
 * integrated by the PWA `components/Footer/footer.js`): dark neutral-800
 * surface, brand + social, then link, contact and payment columns; 1 column,
 * 2 from 768 (brand spanning) and 4 from 1024. Content stays the real site
 * content (`footer-content.ts`); every internal link is a plain anchor because
 * PWA Studio or Magento CMS serve those pages. Images stay lazy: the footer is
 * always below the fold.
 */
export function SiteFooter() {
  return (
    <footer className="w-full bg-ds-neutral-800 pt-10 pb-6 font-sans text-ds-neutral-300 lg:pt-12 lg:pb-8">
      <div
        data-slot="footer-grid"
        className="container-padded grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-x-10 lg:grid-cols-[1.1fr_1fr_1fr_1.2fr] lg:gap-10"
      >
        <div className="flex flex-col gap-4 md:col-span-2 lg:col-span-1">
          <Image
            src="/images/layout/logo-white.svg"
            alt="Chupaprecios"
            width={366}
            height={34}
            className="h-[34px] w-auto max-w-full self-start object-contain object-left"
          />
          <ul className="flex gap-3">
            {SOCIAL_LINKS.map((link) => (
              <li key={link.network}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${link.label}${NEW_TAB}`}
                  className={`inline-flex size-[34px] items-center justify-center rounded-pill bg-ds-neutral-0 text-ds-neutral-800 transition-colors hover:bg-ds-neutral-200 ${FOCUS}`}
                >
                  <Icon name={link.network} size={18} />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-6">
          <FooterColumn title="Centro de ayuda">
            <LinkList links={HELP_LINKS} />
          </FooterColumn>
          <FooterColumn title="Redes Sociales">
            <ul className="flex flex-col gap-2">
              {SOCIAL_LINKS.map((link) => (
                <li key={link.network}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className={LINK}>
                    {link.label}
                    <span className="sr-only">{NEW_TAB}</span>
                  </a>
                </li>
              ))}
            </ul>
          </FooterColumn>
        </div>

        <div className="flex flex-col gap-6">
          <FooterColumn title="Conócenos">
            <LinkList links={ABOUT_LINKS} />
          </FooterColumn>
          <Image
            src="/images/layout/amvo-white.svg"
            alt="Sello de confianza AMVO"
            width={94}
            height={56}
            className="h-14 w-auto self-start opacity-90"
          />
        </div>

        <div className="flex flex-col gap-6">
          <FooterColumn title="Atención a clientes">
            <ul className={`flex flex-col gap-2 ${TEXT}`}>
              <li>
                Atención telefónica:{' '}
                <a href={CUSTOMER_SERVICE.phone.href} className={`font-semibold ${LINK}`}>
                  {CUSTOMER_SERVICE.phone.label}
                </a>
              </li>
              <li className="font-semibold text-ds-text-inverse">Horario:</li>
              {CUSTOMER_SERVICE.hours.map((entry) => (
                <li key={entry.days}>
                  {entry.days} {entry.time}
                  {entry.note ? ` ${entry.note}` : null}
                </li>
              ))}
            </ul>
          </FooterColumn>
          {OFFICES.map((office) => (
            <address key={office.title} className="not-italic">
              <FooterColumn title={office.title}>
                <ul className={`flex flex-col gap-2 ${TEXT}`}>
                  {office.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </FooterColumn>
            </address>
          ))}
          <ul aria-label="Métodos de pago" className="mt-1 flex flex-wrap items-center gap-3">
            {PAYMENT_METHODS.map((method) => (
              <li key={method.id}>
                {/* DS: every logo becomes one light-grey silhouette on the dark surface. */}
                <Image
                  src={`/images/layout/payments/${method.id}.svg`}
                  alt={method.label}
                  width={method.width}
                  height={PAYMENT_LOGO_HEIGHT}
                  className="h-[22px] w-auto max-w-[46px] object-contain brightness-0 invert-[0.72]"
                />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="container-padded mt-8 pt-5 text-body-sm text-ds-neutral-400">
        Copyright © <span className="font-bold">Chupaprecios</span> todos los derechos reservados.
        Powered by Chupaprecios {new Date().getFullYear()}
      </p>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="mb-2 text-body-lg font-bold text-ds-text-inverse">{title}</h2>
      {children}
    </div>
  );
}

function LinkList({ links }: { readonly links: readonly FooterLink[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {links.map((link) => (
        <li key={link.href}>
          <a href={link.href} className={LINK}>
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
