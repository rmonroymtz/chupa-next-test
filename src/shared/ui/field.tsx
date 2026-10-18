import { useId, type ReactNode } from 'react';

/** Label and message slots shared by Input, Select and Checkbox. */
export interface FieldMessageProps {
  readonly label?: ReactNode;
  /** Shown when there is no error. */
  readonly helperText?: ReactNode;
  /** Error message; also flips the field to its error style. */
  readonly error?: ReactNode;
}

/**
 * Ids and ARIA wiring for a form control: a stable id (the caller's or a
 * generated one), `aria-invalid` only on error, and `aria-describedby` that
 * keeps the caller's ids and adds the helper or error message.
 */
export function useFieldA11y(options: {
  readonly id: string | undefined;
  readonly describedBy: string | undefined;
  readonly helperText: ReactNode;
  readonly error: ReactNode;
}) {
  const generated = useId();
  const controlId = options.id ?? `field-${generated}`;
  const hasError = Boolean(options.error);
  const messageId = hasError
    ? `${controlId}-error`
    : options.helperText
      ? `${controlId}-helper`
      : undefined;
  const describedBy = [options.describedBy, messageId].filter(Boolean).join(' ') || undefined;
  return {
    controlId,
    messageId,
    hasError,
    controlProps: {
      id: controlId,
      'aria-invalid': hasError ? (true as const) : undefined,
      'aria-describedby': describedBy,
    },
  };
}

export function FieldMessage({
  id,
  helperText,
  error,
}: {
  readonly id: string | undefined;
  readonly helperText: ReactNode;
  readonly error: ReactNode;
}) {
  if (!id) return null;
  return error ? (
    <span id={id} className="text-xs text-ds-text-error">
      {error}
    </span>
  ) : (
    <span id={id} className="text-xs text-ds-text-secondary">
      {helperText}
    </span>
  );
}

export const FIELD_LABEL = 'text-[13px] font-semibold text-ds-text';

/*
 * Shared control skin. Focus follows the DS reference pattern (Checkbox,
 * INCONSISTENCIAS "Transversal"): 2px `ds-focus` outline with a 2px offset,
 * plus the focus border and the brand-subtle fill.
 */
export const CONTROL =
  'h-11 w-full rounded-md border bg-ds-surface px-4 text-[15px] text-ds-text transition-colors duration-150 placeholder:text-ds-text-tertiary focus:border-ds-focus focus:bg-ds-surface-brand focus:outline-2 focus:outline-offset-2 focus:outline-ds-focus disabled:cursor-not-allowed disabled:bg-ds-surface-muted disabled:text-ds-text-tertiary';
