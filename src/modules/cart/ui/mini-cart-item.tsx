import Image from 'next/image';
import type { MiniCartItem as MiniCartItemData } from '@/modules/cart/application/ports';
import { formatPrice } from '@/modules/product/ui/format-price';

/**
 * One mini-cart row on the DS tokens (the PWA `MiniCart/ProductList/item`
 * layout: 80px thumbnail, name, options, quantity and unit price). The row is
 * read-only: Next has no cart mutation yet, so quantity and removal are
 * changed in the PWA cart ("Editar carrito").
 */
export function MiniCartItem({ item }: { readonly item: MiniCartItemData }) {
  return (
    <li className="flex gap-3 py-4">
      {item.thumbnailUrl ? (
        <Image
          src={item.thumbnailUrl}
          alt=""
          width={80}
          height={80}
          unoptimized
          loading="lazy"
          className="size-20 shrink-0 rounded-sm border border-ds-border-subtle object-contain"
        />
      ) : (
        <span
          className="size-20 shrink-0 rounded-sm border border-ds-border-subtle bg-ds-surface-subtle"
          aria-hidden="true"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <a
          href={item.url}
          className="line-clamp-2 rounded-xs text-body-md font-semibold text-ds-text hover:text-ds-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus"
        >
          {item.name}
        </a>
        {item.options.map((option) => (
          <span key={option.label} className="text-body-sm text-ds-text-secondary">
            {option.label}: {option.value}
          </span>
        ))}
        {item.outOfStock ? (
          <span className="text-body-sm font-semibold text-ds-text-error">Agotado</span>
        ) : null}
        <div className="mt-auto flex items-baseline justify-between gap-2 pt-1">
          <span className="text-body-sm text-ds-text-secondary">Cantidad: {item.quantity}</span>
          {item.unitPrice ? (
            <span className="text-body-md font-semibold text-ds-text">
              {formatPrice(item.unitPrice.amount, item.unitPrice.currency)}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}
