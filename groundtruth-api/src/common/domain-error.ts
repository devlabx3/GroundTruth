/**
 * Error de dominio — Gestion-de-Errores §6: toda excepción sale del API con la
 * forma estable { code, messageKey, retryable, incidentId? }. El front antepone
 * el namespace (`errors:`) al messageKey; aquí va la clave pelada.
 */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    readonly messageKey: string,
    readonly status = 400,
    readonly retryable = false,
    readonly details?: Record<string, unknown>,
  ) {
    super(code);
  }
}

/** Códigos de dominio (§6) mapeados 1:1 a claves i18n del frontend. */
export const DomainErrors = {
  userNotProvisioned: () =>
    new DomainError('USER_NOT_PROVISIONED', 'account_inactive', 403),
  accountInactive: () => new DomainError('ACCOUNT_INACTIVE', 'account_inactive', 403),
  noPrivilege: () => new DomainError('NO_PRIVILEGE', 'no_privilege', 403),
  notFound: () => new DomainError('NOT_FOUND', 'not_found', 404),
  treasuryInsufficientFunds: () =>
    new DomainError('TREASURY_INSUFFICIENT_FUNDS', 'insufficient_funds', 409, true),
  sensorCoverageUnmet: (n: number) =>
    new DomainError('SENSOR_COVERAGE_UNMET', 'sensor_coverage', 422, false, { n }),
  cropMismatch: () => new DomainError('CROP_MISMATCH', 'crop_mismatch', 422),
  certAlreadyExists: () => new DomainError('CERT_ALREADY_EXISTS', 'cert_exists', 409),
  lastTeamAdmin: () => new DomainError('LAST_TEAM_ADMIN', 'last_team_admin', 409),
  /** La unidad está suspendida o aún pendiente de tesorería on-chain: no emite. */
  unitNotActive: () => new DomainError('UNIT_NOT_ACTIVE', 'unit_not_active', 409),
  userExists: () => new DomainError('USER_EXISTS', 'user_exists', 409),
  paramOutOfRange: () => new DomainError('PARAM_OUT_OF_RANGE', 'param_out_of_range', 422),
  privilegeExists: () => new DomainError('PRIVILEGE_EXISTS', 'privilege_exists', 409),
  /** Supabase Auth respondió pero la llamada (email/reset) falló — reintentable. */
  authSyncFailed: () => new DomainError('AUTH_SYNC_FAILED', 'auth_sync_failed', 502, true),
  /** Faltan credenciales de Supabase Auth: el Admin necesita saberlo, no un éxito fingido. */
  authNotConfigured: () =>
    new DomainError('AUTH_NOT_CONFIGURED', 'auth_not_configured', 503, false),
} as const;
