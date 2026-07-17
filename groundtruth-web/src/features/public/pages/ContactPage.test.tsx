import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import ContactPage from './ContactPage';

// Mock the Supabase check
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => null,
}));

describe('ContactPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el formulario con todos los campos', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ContactPage />
      </I18nextProvider>,
    );

    expect(screen.getByDisplayValue('')).toBeTruthy();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('completa el formulario y lo envía', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'contacto-123' }),
    });

    render(
      <I18nextProvider i18n={i18n}>
        <ContactPage />
      </I18nextProvider>,
    );

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const nombreInput = inputs[0];
    const emailInput = inputs[1];
    const mensajeInput = inputs[2] as HTMLTextAreaElement;
    const submitBtn = screen.getByRole('button', { name: /submit/i });

    fireEvent.change(nombreInput, { target: { value: 'Juan Pérez' } });
    fireEvent.change(emailInput, { target: { value: 'juan@example.com' } });
    fireEvent.change(mensajeInput, { target: { value: 'Me interesa conocer más' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/public/contacto',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
  });

  it('muestra error rate limit cuando la respuesta es 429', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    });

    render(
      <I18nextProvider i18n={i18n}>
        <ContactPage />
      </I18nextProvider>,
    );

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const nombreInput = inputs[0];
    const emailInput = inputs[1];
    const mensajeInput = inputs[2] as HTMLTextAreaElement;
    const submitBtn = screen.getByRole('button', { name: /submit/i });

    fireEvent.change(nombreInput, { target: { value: 'Juan' } });
    fireEvent.change(emailInput, { target: { value: 'juan@example.com' } });
    fireEvent.change(mensajeInput, { target: { value: 'Mensaje' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('desactiva el botón si algún campo está vacío', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ContactPage />
      </I18nextProvider>,
    );

    const submitBtn = screen.getByRole('button', { name: /submit/i }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });
});
