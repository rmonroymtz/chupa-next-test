'use client';

interface ChupaChatWidget {
  open?: () => void;
}

/** `window.ChupaChat` is injected by the GTM container, so it may not be there (yet). */
function openChat(): void {
  (window as { ChupaChat?: ChupaChatWidget }).ChupaChat?.open?.();
}

const BUTTON =
  'min-h-11 rounded-pill border border-ds-border px-5 font-semibold text-ds-text hover:bg-ds-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus';

/** Legacy `CHAT EN LÍNEA` buttons: both open the ChupaChat widget. */
export function ChatButtons() {
  return (
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={openChat} className={BUTTON}>
        Chupaprecios
      </button>
      <button type="button" onClick={openChat} className={BUTTON}>
        Click para abrir el chat
      </button>
    </div>
  );
}
