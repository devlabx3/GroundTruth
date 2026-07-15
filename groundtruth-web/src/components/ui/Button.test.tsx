import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Button from './Button';

/**
 * Este test existe por un bug real: un `<Button variant="primary">` al que se le
 * pasaba `className="bg-porcelain text-emerald"` salió **texto esmeralda sobre
 * fondo esmeralda** — invisible. Tailwind no resuelve el conflicto por el orden
 * del string, sino por el orden en la hoja de estilos, así que la clase suelta no
 * siempre gana.
 *
 * La lección: los colores son del `variant`, no del `className`. Aquí se vigila.
 */
describe('Button', () => {
  it('cada variante trae su propio par fondo/texto', () => {
    const { rerender } = render(<Button variant="primary">Certificar</Button>);
    const primary = screen.getByRole('button').className;

    rerender(<Button variant="inverted">Solicitar demo</Button>);
    const inverted = screen.getByRole('button').className;

    // Si ambas variantes acabaran con las mismas clases, una de las dos sería
    // invisible sobre su fondo.
    expect(primary).not.toBe(inverted);
    expect(primary).toMatch(/bg-/);
    expect(primary).toMatch(/text-/);
    expect(inverted).toMatch(/bg-/);
    expect(inverted).toMatch(/text-/);
  });

  it('el className extra NO introduce colores de fondo ni de texto', () => {
    // Un `className` con bg-/text- es exactamente el bug de la demo invisible.
    render(
      <Button variant="primary" className="w-full">
        Ancho completo
      </Button>,
    );
    const btn = screen.getByRole('button');

    expect(btn.className).toContain('w-full');
    // La variante sigue mandando en el color.
    expect(btn.className).toMatch(/bg-/);
  });

  it('se puede desactivar', () => {
    render(<Button disabled>Guardar</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
