import type { InputHTMLAttributes } from 'react';
import { cx } from './class-names';
import { CONTROL, FIELD_LABEL, FieldMessage, useFieldA11y, type FieldMessageProps } from './field';
import { Icon } from './icon';

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, keyof FieldMessageProps> &
  FieldMessageProps & {
    /** Completed/valid state (green border + check, V3 D§5). Error wins. */
    readonly success?: boolean;
    /** Class for the wrapping field (label + control + message). */
    readonly className?: string;
  };

/** DS Input: label + text control + helper/error, states in CSS. */
export function Input({
  label,
  helperText,
  error,
  success = false,
  id,
  className,
  'aria-describedby': ariaDescribedBy,
  ...props
}: InputProps) {
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
        <input
          {...props}
          {...field.controlProps}
          className={cx(
            CONTROL,
            field.hasError
              ? 'border-ds-border-error bg-ds-error-bg'
              : isSuccess
                ? 'border-ds-border-success bg-ds-success-bg pr-10'
                : 'border-ds-border',
          )}
        />
        {isSuccess ? (
          <Icon
            name="check"
            size={18}
            className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ds-success"
          />
        ) : null}
      </div>
      <FieldMessage id={field.messageId} helperText={helperText} error={error} />
    </div>
  );
}
