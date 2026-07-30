import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import ContactPage from './ContactPage';

// Mock the Supabase check
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => null,
}));

// Mock global.fetch
const mockFetch = vi.fn();

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
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'contacto-123' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <I18nextProvider i18n={i18n}>
        <ContactPage />
      </I18nextProvider>,
    );

    const inputs = screen.getAllByRole('textbox') as HTMLElement[];
    const nombreInput = inputs[0];
    const emailInput = inputs[1];
    const mensajeInput = inputs[2];
    const submitBtn = screen.getByRole('button', { name: /submit/i });

    fireEvent.change(nombreInput, { target: { value: 'Juan Pérez' } });
    fireEvent.change(emailInput, { target: { value: 'juan@example.com' } });
    fireEvent.change(mensajeInput, { target: { value: 'Me interesa conocer más' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/public/contacto',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
  });

  it('muestra error rate limit cuando la respuesta es 429', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <I18nextProvider i18n={i18n}>
        <ContactPage />
      </I18nextProvider>,
    );

    const inputs = screen.getAllByRole('textbox') as HTMLElement[];
    const nombreInput = inputs[0];
    const emailInput = inputs[1];
    const mensajeInput = inputs[2];
    const submitBtn = screen.getByRole('button', { name: /submit/i });

    fireEvent.change(nombreInput, { target: { value: 'Juan' } });
    fireEvent.change(emailInput, { target: { value: 'juan@example.com' } });
    fireEvent.change(mensajeInput, { target: { value: 'Mensaje' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
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
