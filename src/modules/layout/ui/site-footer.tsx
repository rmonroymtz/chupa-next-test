import Image from 'next/image';
import type { ReactNode } from 'react';
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
import { FacebookIcon, InstagramIcon } from './icons';

const NEW_TAB = ' (se abre en una pestaña nueva)';
const HEADING = 'font-roboto text-base leading-6 font-bold text-white';
const TEXT = 'font-montserrat text-[0.8125rem] leading-5 font-light text-white';

/**
 * Legacy PWA Studio footer (non-checkout variant): logo and social buttons,
 * help, about, customer service and office columns, AMVO seal, payment
 * methods and copyright. Static content (`footer-content.ts`); every internal
 * link is a plain anchor because PWA Studio or Magento CMS serve those pages.
 * Images are lazy: the footer is always below the fold.
 */
export function SiteFooter() {
  return (
    <footer className="w-full bg-ch-dark-grey py-4 text-white">
      <div className="container-padded flex flex-col gap-6 py-5 lg:grid lg:grid-cols-12 lg:gap-4">
        <div className="flex flex-col items-start lg:[grid-area:1/1/8/4]">
          <Image
            src="/images/layout/logo-white.svg"
            alt="Chupaprecios"
            width={300}
            height={28}
            className="h-auto w-[260px] max-w-full"
          />
          <ul className="mt-6 flex gap-7">
            {SOCIAL_LINKS.map((link) => (
              <li key={link.network}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${link.label}${NEW_TAB}`}
                  className="block text-white transition-colors hover:text-brand-red"
                >
                  {link.network === 'facebook' ? (
                    <FacebookIcon className="size-11" />
                  ) : (
                    <InstagramIcon className="size-11" />
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:[grid-area:1/4/5/6]">
          <FooterHeading>Centro de ayuda</FooterHeading>
          <LinkList links={HELP_LINKS} />
          <FooterHeading className="mt-2">Redes Sociales</FooterHeading>
          <ul className="flex flex-col gap-2">
            {SOCIAL_LINKS.map((link) => (
              <li key={link.network}>
                <a href={link.href} target="_blank" rel="noopener noreferrer" className={TEXT}>
                  {link.label}
                  <span className="sr-only">{NEW_TAB}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:[grid-area:1/6/5/8]">
          <FooterHeading>Conócenos</FooterHeading>
          <LinkList links={ABOUT_LINKS} />
        </div>

        <div className="lg:[grid-area:1/8/5/10]">
          <FooterHeading>Atención a clientes</FooterHeading>
          <ul className={`flex flex-col gap-2 ${TEXT}`}>
            <li>
              Atención telefónica:{' '}
              <a href={CUSTOMER_SERVICE.phone.href} className="font-bold">
                {CUSTOMER_SERVICE.phone.label}
              </a>
            </li>
            <li className="font-bold">Horario:</li>
            {CUSTOMER_SERVICE.hours.map((entry) => (
              <li key={entry.days}>
                {entry.days} <span className="font-bold">{entry.time}</span>
                {entry.note ? ` ${entry.note}` : null}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:[grid-area:1/10/8/13]">
          {OFFICES.map((office, index) => (
            <address key={office.title} className="not-italic">
              <FooterHeading className={index > 0 ? 'mt-2' : undefined}>
                {office.title}
              </FooterHeading>
              <ul className={`flex flex-col gap-2 ${TEXT}`}>
                {office.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </address>
          ))}
        </div>

        <div className="flex flex-col items-center text-center lg:[grid-area:5/5/8/9]">
          <Image
            src="/images/layout/amvo-white.svg"
            alt="Sello de confianza AMVO"
            width={171}
            height={102}
            className="my-4 h-auto w-[120px]"
          />
          <ul
            aria-label="Métodos de pago"
            className="my-4 flex flex-wrap items-center justify-center gap-1"
          >
            {PAYMENT_METHODS.map((method) => (
              <li key={method.id}>
                <Image
                  src={`/images/layout/payments/${method.id}.svg`}
                  alt={method.label}
                  width={method.width}
                  height={PAYMENT_LOGO_HEIGHT}
                  className="h-[15px] w-auto opacity-80 grayscale"
                />
              </li>
            ))}
          </ul>
          <p className="pt-2.5 text-xs text-white">
            Copyright © <span className="font-bold">Chupaprecios</span> todos los derechos
            reservados. Powered by Chupaprecios {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterHeading({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string | undefined;
}) {
  return <h2 className={`${HEADING} py-2 first:pt-0 ${className ?? ''}`}>{children}</h2>;
}

function LinkList({ links }: { readonly links: readonly FooterLink[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {links.map((link) => (
        <li key={link.href}>
          <a href={link.href} className={`${TEXT} hover:underline`}>
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
