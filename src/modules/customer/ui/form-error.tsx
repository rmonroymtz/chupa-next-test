interface FormErrorProps {
  readonly message: string | null;
}

/** Form-level error, announced to screen readers. */
export function FormError({ message }: FormErrorProps) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-ds-border-error bg-ds-error-bg px-4 py-3 text-sm text-ds-text-error"
    >
      {message}
    </p>
  );
}
