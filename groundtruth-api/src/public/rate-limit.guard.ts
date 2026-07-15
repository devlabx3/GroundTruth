import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { DomainError } from '@/common/domain-error';

const VENTANA_MS = 60_000;
const MAX_POR_VENTANA = 30;

/**
 * Límite por IP para el verificador público.
 *
 * Es la única superficie sin autenticación: sin freno, cualquiera puede recorrer
 * el espacio de números `GT-AAAA-NNNNN` y **enumerar todos los certificados de la
 * plataforma** (quién exporta, qué cultivo, en qué país). El contrato de privacidad
 * no lo impide: cada respuesta suelta es inocua, el daño está en el agregado.
 *
 * **Limitación honesta:** el contador vive **en memoria de este proceso**. Con varias
 * réplicas detrás de un balanceador, cada una lleva su propia cuenta y el límite
 * efectivo se multiplica. Para producción esto va a Redis o al borde (Cloudflare,
 * API Gateway). Sirve como freno, no como muro.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly visitas = new Map<string, { n: number; expira: number }>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const ip = req.ip ?? req.socket.remoteAddress ?? 'desconocida';
    const ahora = Date.now();

    // Limpieza perezosa: sin esto el Map crece sin límite y es una fuga.
    if (this.visitas.size > 10_000) {
      for (const [k, v] of this.visitas) if (v.expira <= ahora) this.visitas.delete(k);
    }

    const actual = this.visitas.get(ip);
    if (!actual || actual.expira <= ahora) {
      this.visitas.set(ip, { n: 1, expira: ahora + VENTANA_MS });
      return true;
    }

    actual.n += 1;
    if (actual.n > MAX_POR_VENTANA) {
      throw new DomainError('RATE_LIMITED', 'rate_limited', 429, true);
    }
    return true;
  }
}
