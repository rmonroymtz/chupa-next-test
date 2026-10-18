import type { InputHTMLAttributes } from 'react';
import { cx } from './class-names';
import { FieldMessage, useFieldA11y, type FieldMessageProps } from './field';
import { Icon } from './icon';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | keyof FieldMessageProps> &
  FieldMessageProps & {
    /** Class for the wrapping field. */
    readonly className?: string;
  };

/**
 * DS Checkbox: a visually hidden native checkbox (keeps keyboard, form and
 * screen reader behavior) with a styled box. Checked fill `ds-cta`, focus
 * 2px `ds-focus` outline with a 2px offset (the DS reference pattern).
 */
export function Checkbox({
  label,
  helperText,
  error,
  id,
  disabled = false,
  className,
  'aria-describedby': ariaDescribedBy,
  ...props
}: CheckboxProps) {
  const field = useFieldA11y({ id, describedBy: ariaDescribedBy, helperText, error });
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <label
        htmlFor={field.controlId}
        className={cx(
          'relative inline-flex items-center gap-2 text-sm select-none',
          disabled ? 'cursor-not-allowed text-ds-text-secondary' : 'cursor-pointer text-ds-text',
        )}
      >
        <input
          {...props}
          {...field.controlProps}
          type="checkbox"
          disabled={disabled}
          className="peer sr-only"
        />
        <span
          className={cx(
            'inline-flex size-5 shrink-0 items-center justify-center rounded-sm border bg-ds-surface text-transparent transition-colors duration-150 peer-checked:border-ds-cta peer-checked:bg-ds-cta peer-checked:text-ds-text-on-cta peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ds-focus peer-disabled:border-ds-border peer-disabled:bg-ds-surface-subtle',
            field.hasError ? 'border-ds-border-error' : 'border-ds-border',
          )}
        >
          <Icon name="check" size={14} strokeWidth={3} />
        </span>
        {label ? <span>{label}</span> : null}
      </label>
      <FieldMessage id={field.messageId} helperText={helperText} error={error} />
    </div>
  );
}
