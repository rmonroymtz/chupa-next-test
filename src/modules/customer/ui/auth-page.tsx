import type { ReactNode } from 'react';

/** Links under the card, from the site footer (same pages). */
const HELP_LINKS = [
  { label: 'Ayuda', href: '/preguntas-frecuentes' },
  { label: 'Términos y condiciones', href: '/terminos-y-condiciones' },
  { label: 'Aviso de privacidad', href: '/aviso-privacidad' },
] as const;

interface AuthPageProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
}

/**
 * Shell of the auth screens: the layout already owns `<main>`. A centered card,
 * help links below. Spacing, card and title follow Figma "Inicia sesión" (node 1957:414).
 */
export function AuthPage({ title, subtitle, children }: AuthPageProps) {
  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col gap-5 px-4 pt-12 pb-16">
      <section className="rounded-lg bg-ds-surface p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)] sm:p-10">
        <h1 className="font-display text-[26px] leading-normal font-bold text-ds-text">{title}</h1>
        {subtitle ? (
          <p className="mt-1.5 text-sm font-medium text-ds-text-secondary">{subtitle}</p>
        ) : null}
        <div className="mt-5">{children}</div>
      </section>
      <nav
        aria-label="Ayuda"
        className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-ds-text-secondary"
      >
        {HELP_LINKS.map((link) => (
          <a key={link.href} href={link.href} className="hover:text-ds-text hover:underline">
            {link.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
