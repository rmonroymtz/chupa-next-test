// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Checkbox } from '@/shared/ui/checkbox';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';

afterEach(cleanup);

const describedBy = (element: HTMLElement): string =>
  (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' | ');

describe('Input', () => {
  it('labels the control and describes it with the helper text', () => {
    render(<Input label="Correo" helperText="Te enviaremos tu pedido" />);
    const input = screen.getByLabelText('Correo');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(describedBy(input)).toBe('Te enviaremos tu pedido');
    expect(input.className).toContain('border-ds-border');
    expect(input.className).toContain('focus:outline-ds-focus');
  });

  it('error replaces the helper text and flags the control', () => {
    render(<Input label="Correo" helperText="Ayuda" error="Correo inválido" />);
    const input = screen.getByLabelText('Correo');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(describedBy(input)).toBe('Correo inválido');
    expect(screen.queryByText('Ayuda')).toBeNull();
    expect(input.className).toContain('border-ds-border-error');
    expect(input.className).toContain('bg-ds-error-bg');
  });

  it('success shows the check and the success border; error wins over success', () => {
    const { rerender, container } = render(<Input label="CP" success />);
    expect(screen.getByLabelText('CP').className).toContain('border-ds-border-success');
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    rerender(<Input label="CP" success error="Requerido" />);
    expect(screen.getByLabelText('CP').className).not.toContain('border-ds-border-success');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('keeps a caller id and aria-describedby, and supports disabled', () => {
    render(
      <>
        <p id="extra">Extra</p>
        <Input id="email" label="Correo" helperText="Ayuda" aria-describedby="extra" disabled />
      </>,
    );
    const input = screen.getByLabelText('Correo');
    expect(input.id).toBe('email');
    expect(describedBy(input)).toBe('Extra | Ayuda');
    expect(input).toHaveProperty('disabled', true);
    expect(input.className).toContain('disabled:bg-ds-surface-muted');
  });
});

describe('Select', () => {
  it('wires label, helper and error like Input', () => {
    const { rerender } = render(
      <Select label="Estado" helperText="Elige uno">
        <option value="cdmx">CDMX</option>
      </Select>,
    );
    const select = screen.getByLabelText('Estado');
    expect(select.tagName).toBe('SELECT');
    expect(describedBy(select)).toBe('Elige uno');
    expect(select.hasAttribute('aria-invalid')).toBe(false);
    rerender(
      <Select label="Estado" error="Selecciona un estado">
        <option value="cdmx">CDMX</option>
      </Select>,
    );
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(describedBy(select)).toBe('Selecciona un estado');
    expect(select.className).toContain('border-ds-border-error');
  });

  it('renders a decorative chevron and supports disabled', () => {
    const { container } = render(
      <Select label="Estado" disabled>
        <option value="cdmx">CDMX</option>
      </Select>,
    );
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByLabelText('Estado')).toHaveProperty('disabled', true);
  });
});

describe('Checkbox', () => {
  it('is a native checkbox named by its label', () => {
    render(<Checkbox label="Recordarme" defaultChecked />);
    const checkbox = screen.getByRole('checkbox', { name: 'Recordarme' });
    expect(checkbox).toHaveProperty('checked', true);
    expect(checkbox.hasAttribute('aria-invalid')).toBe(false);
  });

  it('wires error and helper text', () => {
    const { rerender } = render(<Checkbox label="Acepto" helperText="Lee los términos" />);
    const checkbox = screen.getByRole('checkbox', { name: 'Acepto' });
    expect(describedBy(checkbox)).toBe('Lee los términos');
    rerender(<Checkbox label="Acepto" error="Debes aceptar" />);
    expect(checkbox.getAttribute('aria-invalid')).toBe('true');
    expect(describedBy(checkbox)).toBe('Debes aceptar');
  });

  it('supports disabled', () => {
    render(<Checkbox label="Acepto" disabled />);
    expect(screen.getByRole('checkbox', { name: 'Acepto' })).toHaveProperty('disabled', true);
  });
});
