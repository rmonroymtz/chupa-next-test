export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <p className="text-neutral-700">La página que buscas no existe o ya no está disponible.</p>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- home is served by PWA Studio in phase 1 */}
      <a href="/" className="rounded bg-neutral-900 px-4 py-2 font-medium text-white">
        Ir al inicio
      </a>
    </main>
  );
}
