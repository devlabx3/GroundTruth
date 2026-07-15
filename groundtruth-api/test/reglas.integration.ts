import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Reglas de negocio, contra el sistema REAL (API + Postgres + Solana).
 *
 * Formaliza las comprobaciones que hasta ahora se hacían a mano con curl. No se
 * ejecuta en CI: necesita infraestructura viva, y un CI intermitente se acaba
 * ignorando. Se lanza a propósito, antes de tocar algo delicado:
 *
 *   API_URL=http://localhost:3000 \
 *   TEST_EMAIL=lucia@sierraverde.coop TEST_PASSWORD=... \
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... \
 *   OPERADOR_ID=11111111-1111-1111-1111-111111111111 \
 *   pnpm test:integration
 *
 * Cada test comprueba una regla que, si se rompe, cuesta dinero o credibilidad.
 */
const API = process.env.API_URL ?? 'http://localhost:3000';
const OPERADOR = process.env.OPERADOR_ID ?? '11111111-1111-1111-1111-111111111111';

let token: string;

async function login(): Promise<string> {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY!,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: process.env.TEST_EMAIL,
        password: process.env.TEST_PASSWORD,
      }),
    },
  );
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

/** Llamada como operador de la unidad. */
async function api(ruta: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${ruta}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'x-operador-id': OPERADOR,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

beforeAll(async () => {
  token = await login();
  expect(token, 'no se pudo iniciar sesión: revisa TEST_EMAIL/TEST_PASSWORD').toBeTruthy();

  // PRECONDICIÓN, y no es ceremonia: esta suite pasó una vez "en verde" contra un
  // backend apuntando a un validador destruido. Sus tests seguían pasando porque
  // comparaban ceros con ceros. Si la unidad de prueba no tiene saldo, el entorno
  // está roto y CUALQUIER resultado posterior es basura: mejor fallar aquí.
  const { body } = await api('/tesoreria');
  expect(
    body?.saldoUsdc,
    'la tesorería de prueba está a 0: el backend no está hablando con la cadena ' +
      '(¿.env desactualizado tras un bootstrap?). Los tests serían falsos positivos.',
  ).toBeGreaterThan(0);
});

describe('alta de parcela: el gate lo impone el servidor', () => {
  // ~10,75 ha reales según PostGIS → exige 6 sensores.
  const POLIGONO = [
    [14.156, -88.03],
    [14.156, -88.027],
    [14.153, -88.027],
    [14.153, -88.03],
  ];
  let fincaId: string;

  beforeAll(async () => {
    const { body } = await api('/topologia/fincas');
    fincaId = body[0].id;
  });

  it('rechaza cobertura de sensores insuficiente y dice cuántos faltan', async () => {
    const { status, body } = await api('/topologia/parcelas', {
      method: 'POST',
      body: JSON.stringify({
        fincaId,
        nombre: `Test cobertura ${Date.now()}`,
        cultivo: 'cafe',
        poligono: POLIGONO,
        nodos: ['n1'],
      }),
    });
    expect(status).toBe(422);
    expect(body.code).toBe('SENSOR_COVERAGE_UNMET');
    // El número lo calcula PostGIS, no el navegador: la UI lo interpola.
    expect(body.details.n).toBeGreaterThan(1);
  });

  it('rechaza un polígono que se cruza a sí mismo (tiene área, no es parcela)', async () => {
    const { status, body } = await api('/topologia/parcelas', {
      method: 'POST',
      body: JSON.stringify({
        fincaId,
        nombre: `Corbatín ${Date.now()}`,
        cultivo: 'cafe',
        poligono: [
          [14.156, -88.03],
          [14.153, -88.027],
          [14.156, -88.027],
          [14.153, -88.03],
        ],
        nodos: ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'],
      }),
    });
    expect(status).toBe(422);
    expect(body.code).toBe('INVALID_POLYGON');
  });

  it('no deja crear una parcela en la finca de otra unidad', async () => {
    const { status } = await api('/topologia/parcelas', {
      method: 'POST',
      body: JSON.stringify({
        fincaId: '00000000-0000-0000-0000-000000000000',
        nombre: 'Ajena',
        cultivo: 'cafe',
        poligono: POLIGONO,
        nodos: ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'],
      }),
    });
    expect(status).toBe(404);
  });
});

describe('tesorería: la cadena es la fuente de verdad', () => {
  it('la dirección de depósito es el ATA, no la Treasury PDA', async () => {
    const { body } = await api('/tesoreria');
    // Enviar USDC a la PDA (fuera de la curva) es cómo se pierde un depósito.
    expect(body.address).toBeTruthy();
    expect(body.address).not.toBe(body.treasuryPda);
  });

  it('el saldo cuadra con el que devuelve /tesoreria/saldo', async () => {
    const { body: t } = await api('/tesoreria');
    const { body: s } = await api('/tesoreria/saldo');
    expect(s.saldoUsdc).toBeCloseTo(t.saldoUsdc, 6);
  });

  it('las firmas expuestas son transacciones reales (sin el sufijo interno)', async () => {
    const { body } = await api('/tesoreria');
    for (const m of body.movimientos) {
      // En la BD los dos débitos de un despacho llevan `#cert` / `#manifiesto`
      // por la unicidad de la columna; hacia fuera nunca deben salir.
      expect(m.tx).not.toContain('#');
    }
  });

  it('reconciliar dos veces no duplica depósitos', async () => {
    await api('/tesoreria/sincronizar', { method: 'POST' });
    const { body: primera } = await api('/tesoreria/sincronizar', { method: 'POST' });
    expect(primera.nuevos).toBe(0);
  });
});

describe('certificación: idempotencia', () => {
  it('re-certificar un embarque emitido no vuelve a cobrar', async () => {
    const { body: embarques } = await api('/embarques');
    const emitido = embarques.find((e: any) => e.estado === 'emitido');
    // Nada de `if (!emitido) return`: un salto silencioso deja el test en verde
    // sin haber comprobado nada. Si no hay embarque emitido, el entorno no sirve.
    expect(emitido, 'no hay ningún embarque EMITIDO: la base de prueba no está sembrada').toBeTruthy();

    const { body: antes } = await api('/tesoreria/saldo');
    const { status } = await api(`/embarques/${emitido.id}/certificar`, { method: 'POST' });
    const { body: despues } = await api('/tesoreria/saldo');

    expect(status).toBeLessThan(300);
    expect(despues.saldoUsdc).toBe(antes.saldoUsdc); // ni un céntimo
  });
});

describe('autorización', () => {
  it('sin token no se entra', async () => {
    const res = await fetch(`${API}/tesoreria`, {
      headers: { 'x-operador-id': OPERADOR },
    });
    expect(res.status).toBe(401);
  });

  it('un operador no alcanza la superficie del Admin', async () => {
    const res = await fetch(`${API}/admin/unidades`, {
      headers: { authorization: `Bearer ${token}` },
    });
    // Ser admin de plataforma no es un privilegio de sub-rol que se pueda acumular.
    expect(res.status).toBe(403);
  });

  it('el webhook de depósitos rechaza un secreto inválido', async () => {
    const res = await fetch(`${API}/webhooks/helius`, {
      method: 'POST',
      headers: { authorization: 'no-es-el-secreto', 'content-type': 'application/json' },
      body: '[]',
    });
    expect(res.status).toBe(403);
  });
});
