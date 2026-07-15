import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import type { Response } from 'express';
import { DomainError } from './domain-error';

/**
 * Filtro global (Gestion-de-Errores §6): el front NUNCA ve un stack ni un error
 * crudo de Postgres/Solana. Todo sale como { code, messageKey, retryable, incidentId? }.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errores');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof DomainError) {
      return res.status(exception.status).json({
        code: exception.code,
        messageKey: exception.messageKey,
        retryable: exception.retryable,
        ...(exception.details ? { details: exception.details } : {}),
      });
    }

    // Validación de entrada (zod) → 400 con clave i18n de campo requerido.
    if (exception instanceof ZodError) {
      return res.status(400).json({
        code: 'VALIDATION',
        messageKey: 'field_required',
        retryable: false,
        details: { issues: exception.issues.map((i) => ({ path: i.path.join('.'), code: i.code })) },
      });
    }

    // El guardarraíl "nunca sin timón" llega como excepción de Postgres.
    if (exception instanceof Error && exception.message.includes('LAST_TEAM_ADMIN')) {
      return res.status(409).json({
        code: 'LAST_TEAM_ADMIN',
        messageKey: 'last_team_admin',
        retryable: false,
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const byStatus: Record<number, { code: string; messageKey: string }> = {
        401: { code: 'SESSION_EXPIRED', messageKey: 'session_expired' },
        403: { code: 'NO_PRIVILEGE', messageKey: 'no_privilege' },
        404: { code: 'NOT_FOUND', messageKey: 'not_found' },
        429: { code: 'RATE_LIMITED', messageKey: 'rate_limited' },
      };
      const mapped = byStatus[status] ?? { code: 'SERVER', messageKey: 'server' };
      return res.status(status).json({ ...mapped, retryable: status >= 500 });
    }

    // Inesperado → 500 con id de incidencia correlacionable (observabilidad).
    const incidentId = randomUUID();
    this.logger.error(`incident=${incidentId}`, exception instanceof Error ? exception.stack : String(exception));
    return res.status(500).json({
      code: 'SERVER',
      messageKey: 'server',
      retryable: true,
      incidentId,
    });
  }
}
