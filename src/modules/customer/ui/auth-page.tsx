import type { ReactNode } from 'react';

interface AuthPageProps {
  readonly title: string;
  readonly children: ReactNode;
}

/** Shell of the auth screens: the layout already owns `<main>`. */
export function AuthPage({ title, children }: AuthPageProps) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-ds-text">{title}</h1>
      {children}
    </div>
  );
}
