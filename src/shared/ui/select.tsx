import type { SelectHTMLAttributes } from 'react';
import { cx } from './class-names';
import { CONTROL, FIELD_LABEL, FieldMessage, useFieldA11y, type FieldMessageProps } from './field';
import { Icon } from './icon';

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, keyof FieldMessageProps> &
  FieldMessageProps & {
    /** Completed/valid state, same skin as Input. Error wins. */
    readonly success?: boolean;
    /** Class for the wrapping field (label + control + message). */
    readonly className?: string;
  };

/** DS Select: native `<select>` with the Input skin and a chevron. Pass `<option>` children. */
export function Select({
  label,
  helperText,
  error,
  success = false,
  id,
  className,
  children,
  'aria-describedby': ariaDescribedBy,
  ...props
}: SelectProps) {
  const field = useFieldA11y({ id, describedBy: ariaDescribedBy, helperText, error });
  const isSuccess = success && !field.hasError;
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      {label ? (
        <label htmlFor={field.controlId} className={FIELD_LABEL}>
          {label}
        </label>
      ) : null}
      <div className="relative">
        <select
          {...props}
          {...field.controlProps}
          className={cx(
            CONTROL,
            'cursor-pointer appearance-none pr-10',
            field.hasError
              ? 'border-ds-border-error bg-ds-error-bg'
              : isSuccess
                ? 'border-ds-border-success bg-ds-success-bg'
                : 'border-ds-border',
          )}
        >
          {children}
        </select>
        <Icon
          name="chevron-down"
          size={18}
          className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ds-text-secondary"
        />
      </div>
      <FieldMessage id={field.messageId} helperText={helperText} error={error} />
    </div>
  );
}
