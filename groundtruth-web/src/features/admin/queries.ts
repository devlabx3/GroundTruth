/**
 * Capa de datos del Admin: backend real cuando Supabase está configurado, o
 * fixtures de maqueta. Ninguna llamada de aquí manda `x-operador-id` — el admin
 * no pertenece a una unidad, las cruza todas (lo exige AdminGuard en el backend).
 */
import { getSupabase } from '@/lib/supabase';
import { api, ApiError } from '@/lib/api';
import { demoQueryFn } from '@/lib/demo';
import type {
  CertificadoGlobal,
  EstadoCuenta,
  CrearUnidadPayload,
  EntradaAuditoria,
  EstadoUnidad,
  Finanzas,
  Integracion,
  MetricasGlobales,
  NodoSimulado,
  Parametros,
  ParcelaGlobal,
  PerfilSimulacion,
  Privilege,
  PrivilegioCatalogo,
  SagaEntry,
  UnidadDetalle,
  UnidadResumen,
  UnidadesPaginadas,
  UsuarioAdmin,
  UsuariosPaginados,
} from '@/types/api';
import {
  FINANZAS,
  GLOBAL_METRICS,
  GLOBAL_PARCELS,
  UNITS,
  USERS,
  SYSTEM_PARAMS,
  PARAMS_AUDIT_LOG,
  SAGA_QUEUE,
  INTEGRATIONS,
  SIM_NODES,
} from './fixtures';

const isDemo = () => getSupabase() === null;

// ---- Panel global y supervisión (A6) ----

export async function fetchOverview(): Promise<MetricasGlobales> {
  if (isDemo()) return demoQueryFn(GLOBAL_METRICS)();
  const { data } = await api.get<MetricasGlobales>('/admin/overview');
  return data;
}

export async function fetchParcelasGlobales(): Promise<ParcelaGlobal[]> {
  if (isDemo()) return demoQueryFn(GLOBAL_PARCELS)();
  const { data } = await api.get<ParcelaGlobal[]>('/admin/parcelas');
  return data;
}

export async function fetchFinanzas(): Promise<Finanzas> {
  if (isDemo()) return demoQueryFn(FINANZAS)();
  const { data } = await api.get<Finanzas>('/admin/finanzas');
  return data;
}

// ---- Unidades (A1) ----

export interface FetchUnidadesParams {
  page?: number;
  pageSize?: number;
  sortBy?: 'nombre' | 'pais' | 'parcelas' | 'saldoUsdc' | 'estado';
  sortDir?: 'asc' | 'desc';
  nombre?: string;
  pais?: string;
  estado?: EstadoUnidad;
}

export async function fetchUnidades(
  params: FetchUnidadesParams = {},
): Promise<UnidadesPaginadas> {
  if (isDemo()) {
    const {
      page = 1,
      pageSize = 25,
      sortBy = 'nombre',
      sortDir = 'asc',
      nombre,
      pais,
      estado,
    } = params;

    const filtered = UNITS.filter((u) => {
      if (nombre && !u.nombre.toLowerCase().includes(nombre.toLowerCase())) return false;
      if (pais && !u.pais.toLowerCase().includes(pais.toLowerCase())) return false;
      if (estado && u.estado !== estado) return false;
      return true;
    });

    const sortMap: Record<string, (a: UnidadResumen, b: UnidadResumen) => number> = {
      nombre: (a, b) => a.nombre.localeCompare(b.nombre),
      pais: (a, b) => a.pais.localeCompare(b.pais),
      parcelas: (a, b) => a.parcelas - b.parcelas,
      saldoUsdc: (a, b) => a.saldoUsdc - b.saldoUsdc,
      estado: (a, b) => a.estado.localeCompare(b.estado),
    };

    filtered.sort(sortMap[sortBy]);
    if (sortDir === 'desc') filtered.reverse();

    const total = filtered.length;
    const offset = (page - 1) * pageSize;
    const items = filtered.slice(offset, offset + pageSize);

    return { items, total, page, pageSize };
  }

  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
  if (params.sortBy !== undefined) query.set('sortBy', params.sortBy);
  if (params.sortDir !== undefined) query.set('sortDir', params.sortDir);
  if (params.nombre !== undefined) query.set('nombre', params.nombre);
  if (params.pais !== undefined) query.set('pais', params.pais);
  if (params.estado !== undefined) query.set('estado', params.estado);

  const { data } = await api.get<UnidadesPaginadas>(`/admin/unidades?${query.toString()}`);
  return data;
}

export async function fetchUnidad(id: string): Promise<UnidadDetalle | null> {
  if (isDemo()) return (UNITS.find((u) => u.id === id) as UnidadDetalle | undefined) ?? null;
  try {
    const { data } = await api.get<UnidadDetalle>(`/admin/unidades/${id}`);
    return data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function crearUnidad(
  payload: CrearUnidadPayload,
): Promise<{ id: string; estado: EstadoUnidad; treasuryPendiente?: boolean }> {
  if (isDemo()) {
    const u = {
      id: `op-${Date.now()}`,
      nombre: payload.nombre,
      pais: payload.pais,
      parcelas: 0,
      saldoUsdc: 0,
      estado: 'pendiente' as const,
      treasury: null,
      miembros: [
        {
          id: `u-${Date.now()}`,
          nombre: payload.adminNombre,
          email: payload.adminEmail,
          subRol: 'Dirección',
        },
      ],
    };
    UNITS.push(u);
    return { id: u.id, estado: 'pendiente', treasuryPendiente: true };
  }
  const { data } = await api.post<{ id: string; estado: EstadoUnidad }>('/admin/unidades', payload);
  return data;
}

export async function cambiarEstadoUnidad(
  id: string,
  estado: EstadoUnidad,
): Promise<{ id: string; estado: EstadoUnidad }> {
  if (isDemo()) {
    const u = UNITS.find((x) => x.id === id);
    if (u) u.estado = estado;
    return { id, estado };
  }
  const { data } = await api.patch<{ id: string; estado: EstadoUnidad }>(`/admin/unidades/${id}`, {
    estado,
  });
  return data;
}

// ---- Usuarios (A3) ----

export interface FetchUsuariosParams {
  page?: number;
  pageSize?: number;
  sortBy?: 'nombre' | 'email' | 'membresia' | 'rol';
  sortDir?: 'asc' | 'desc';
  nombre?: string;
  email?: string;
  membresia?: string;
  rol?: string;
}

export async function fetchUsuarios(
  params: FetchUsuariosParams = {},
): Promise<UsuariosPaginados> {
  if (isDemo()) {
    // Simulación en memoria: aplicar paginación + orden + filtros
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'nombre',
      sortDir = 'asc',
      nombre,
      email,
      membresia,
      rol,
    } = params;

    let filtered = USERS.filter((u) => {
      if (nombre && !u.nombre.toLowerCase().includes(nombre.toLowerCase())) return false;
      if (email && !u.email.toLowerCase().includes(email.toLowerCase())) return false;
      if (membresia && !u.membresias.toLowerCase().includes(membresia.toLowerCase())) return false;
      if (rol && !u.rol?.toLowerCase().includes(rol.toLowerCase())) return false;
      return true;
    });

    const sortMap: Record<string, (a: UsuarioAdmin, b: UsuarioAdmin) => number> = {
      nombre: (a, b) => a.nombre.localeCompare(b.nombre),
      email: (a, b) => a.email.localeCompare(b.email),
      membresia: (a, b) => a.membresias.localeCompare(b.membresias),
      rol: (a, b) => (a.rol || '').localeCompare(b.rol || ''),
    };

    const sorter = sortMap[sortBy];
    filtered.sort(sorter);
    if (sortDir === 'desc') filtered.reverse();

    const total = filtered.length;
    const offset = (page - 1) * pageSize;
    const items = filtered.slice(offset, offset + pageSize);

    return { items, total, page, pageSize };
  }

  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
  if (params.sortBy !== undefined) query.set('sortBy', params.sortBy);
  if (params.sortDir !== undefined) query.set('sortDir', params.sortDir);
  if (params.nombre !== undefined) query.set('nombre', params.nombre);
  if (params.email !== undefined) query.set('email', params.email);
  if (params.membresia !== undefined) query.set('membresia', params.membresia);
  if (params.rol !== undefined) query.set('rol', params.rol);

  const { data } = await api.get<UsuariosPaginados>(`/admin/usuarios?${query.toString()}`);
  return data;
}

export async function crearUsuario(payload: {
  nombre: string;
  email: string;
}): Promise<UsuarioAdmin> {
  if (isDemo()) {
    const u: UsuarioAdmin = {
      id: `u-${Date.now()}`,
      ...payload,
      membresias: '',
      rol: '',
      estado: 'activa',
    };
    USERS.push(u);
    return u;
  }
  const { data } = await api.post<UsuarioAdmin>('/admin/usuarios', payload);
  return data;
}

export async function desactivarUsuario(
  id: string,
): Promise<{ id: string; estado: EstadoCuenta }> {
  if (isDemo()) {
    const u = USERS.find((x) => x.id === id);
    if (u) u.estado = 'inactiva';
    return { id, estado: 'inactiva' };
  }
  const { data } = await api.post<{ id: string; estado: EstadoCuenta }>(
    `/admin/usuarios/${id}/desactivar`,
  );
  return data;
}

export async function editarUsuario(
  id: string,
  payload: { nombre?: string; email?: string },
): Promise<{ id: string; nombre: string; email: string }> {
  if (isDemo()) {
    const u = USERS.find((x) => x.id === id);
    if (u) Object.assign(u, payload);
    return { id, nombre: u?.nombre ?? '', email: u?.email ?? '' };
  }
  const { data } = await api.patch<{ id: string; nombre: string; email: string }>(
    `/admin/usuarios/${id}`,
    payload,
  );
  return data;
}

export async function reactivarUsuario(
  id: string,
): Promise<{ id: string; estado: EstadoCuenta }> {
  if (isDemo()) {
    const u = USERS.find((x) => x.id === id);
    if (u) u.estado = 'activa';
    return { id, estado: 'activa' };
  }
  const { data } = await api.post<{ id: string; estado: EstadoCuenta }>(
    `/admin/usuarios/${id}/reactivar`,
  );
  return data;
}

export async function enviarResetPassword(
  id: string,
): Promise<{ id: string; enviado: boolean }> {
  if (isDemo()) return { id, enviado: true };
  const { data } = await api.post<{ id: string; enviado: boolean }>(
    `/admin/usuarios/${id}/reset-password`,
  );
  return data;
}

/** Vía transitoria mientras el SMTP (Resend) está suspendido: fija la contraseña sin email. */
export async function fijarPassword(
  id: string,
  password: string,
): Promise<{ id: string; fijado: boolean }> {
  if (isDemo()) return { id, fijado: true };
  const { data } = await api.post<{ id: string; fijado: boolean }>(
    `/admin/usuarios/${id}/fijar-password`,
    { password },
  );
  return data;
}

// ---- Catálogo de privilegios (A2) ----

export async function fetchPrivilegios(): Promise<PrivilegioCatalogo[]> {
  if (isDemo()) {
    const { PRIVILEGES, SENSITIVE_PRIVILEGES } = await import('@/lib/privileges');
    return Object.values(PRIVILEGES).map((clave: Privilege) => ({
      id: clave,
      clave,
      nombre: clave,
      sensible: SENSITIVE_PRIVILEGES.has(clave),
      estado: 'activo' as const,
      enSubroles: 2,
    }));
  }
  const { data } = await api.get<PrivilegioCatalogo[]>('/admin/privilegios');
  return data;
}

export async function crearPrivilegio(payload: {
  clave: string;
  nombre: string;
  sensible?: boolean;
}): Promise<PrivilegioCatalogo> {
  if (isDemo()) {
    return {
      id: payload.clave,
      sensible: false,
      ...payload,
      enSubroles: 0,
      estado: 'activo',
    };
  }
  const { data } = await api.post<PrivilegioCatalogo>('/admin/privilegios', payload);
  return data;
}

export async function deprecarPrivilegio(
  id: string,
): Promise<{ id: string; estado: 'deprecado' }> {
  if (isDemo()) return { id, estado: 'deprecado' };
  const { data } = await api.post<{ id: string; estado: 'deprecado' }>(
    `/admin/privilegios/${id}/deprecar`,
  );
  return data;
}

// ---- Parámetros (A4) ----

export async function fetchParametros(): Promise<Parametros> {
  if (isDemo()) {
    // Adaptamos la maqueta a la forma real (vigencia y umbrales POR cultivo).
    return {
      tarifas: SYSTEM_PARAMS.tarifas,
      haPorSensor: SYSTEM_PARAMS.haPorSensor,
      cultivos: Object.fromEntries(
        Object.entries(SYSTEM_PARAMS.umbrales).map(([c, u]) => [
          c,
          { vigenciaDias: SYSTEM_PARAMS.vigenciaMeses * 30, ...u },
        ]),
      ),
    };
  }
  const { data } = await api.get<Parametros>('/admin/parametros');
  return data;
}

export async function actualizarParametros(payload: Parametros): Promise<Parametros> {
  if (isDemo()) return payload;
  const { data } = await api.patch<Parametros>('/admin/parametros', payload);
  return data;
}

export async function fetchParametrosAuditoria(): Promise<EntradaAuditoria[]> {
  if (isDemo()) {
    return PARAMS_AUDIT_LOG.map((e) => ({
      id: e.id,
      fecha: e.fecha,
      quien: e.quien,
      cambios: [{ campo: e.parametro, antes: e.antes, despues: e.despues }],
    }));
  }
  const { data } = await api.get<EntradaAuditoria[]>('/admin/parametros/auditoria');
  return data;
}

// ---- Saga (A7) ----

export async function fetchSagas(): Promise<SagaEntry[]> {
  if (isDemo()) return demoQueryFn(SAGA_QUEUE)();
  const { data } = await api.get<SagaEntry[]>('/admin/saga');
  return data;
}

export async function reintentarSaga(id: string): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>(`/admin/saga/${id}/retry`);
  return data;
}

// ---- Certificados, vista global (A8) ----

export async function fetchCertificadosGlobales(): Promise<CertificadoGlobal[]> {
  if (isDemo()) {
    const { CERTIFICATES } = await import('@/features/dashboard/fixtures');
    return CERTIFICATES.map((c) => ({
      id: c.id,
      numeroPublico: c.id,
      parcela: c.parcela,
      unidad: 'Coop. Sierra Verde',
      emitido: c.emitido,
      estado: c.estado,
    }));
  }
  const { data } = await api.get<CertificadoGlobal[]>('/admin/certificados');
  return data;
}

export async function revocarCertificadoGlobal(
  id: string,
  motivo: string,
): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>(`/admin/certificados/${id}/revocar`, { motivo });
  return data;
}

// ---- Integraciones (A9) ----

export async function fetchIntegraciones(): Promise<Integracion[]> {
  if (isDemo()) return demoQueryFn(INTEGRATIONS)();
  const { data } = await api.get<Integracion[]>('/admin/integraciones');
  return data;
}

// ---- Simulador IoT (A5) ----

export async function fetchNodos(): Promise<NodoSimulado[]> {
  if (isDemo()) return demoQueryFn(SIM_NODES)();
  const { data } = await api.get<NodoSimulado[]>('/admin/simulador/nodos');
  return data;
}

export async function activarNodo(
  id: string,
  activo: boolean,
): Promise<{ id: string; activo: boolean }> {
  if (isDemo()) {
    const n = SIM_NODES.find((x) => x.id === id);
    if (n) n.activo = activo;
    return { id, activo };
  }
  const { data } = await api.patch<{ id: string; activo: boolean }>(
    `/admin/simulador/nodos/${id}`,
    { activo },
  );
  return data;
}

export interface ResultadoSimulacion {
  parcelaId: string;
  perfil: PerfilSimulacion;
  lecturas: number;
  estado: string;
}

export async function generarLecturas(
  parcelaId: string,
  perfil: PerfilSimulacion,
  horas: number,
): Promise<ResultadoSimulacion> {
  if (isDemo()) {
    return {
      parcelaId,
      perfil,
      lecturas: horas,
      estado: perfil === 'sano' ? 'conforme' : 'alerta',
    };
  }
  const { data } = await api.post<ResultadoSimulacion>('/admin/simulador/generar', {
    parcelaId,
    perfil,
    horas,
  });
  return data;
}
