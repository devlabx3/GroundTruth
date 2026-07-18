import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Supabase Auth Admin — invitaciones, reset de contraseña y edición de email
 * reales (Bloque 1 ítem 3). Usado por `equipo.service.ts`, `agricultores.service.ts`,
 * `admin/unidades.service.ts` y `admin/identidad.service.ts` para que las altas
 * produzcan un usuario que realmente puede iniciar sesión.
 *
 * Patrón: mismo que `StorageService` — usa `fetch` crudo contra la API REST de Supabase,
 * se degrada con gracia si faltan credenciales (no revienta el módulo, `isEnabled()` = false;
 * el caller cae a un placeholder `crypto.randomUUID()` en vez de romper el alta).
 *
 * Headers: apikey (anonymous key) + Authorization: Bearer {service_role_key}
 */
@Injectable()
export class SupabaseAuthService {
  private readonly logger = new Logger(SupabaseAuthService.name);
  private readonly supabaseUrl: string | undefined;
  private readonly supabaseAnonKey: string | undefined;
  private readonly supabaseServiceRoleKey: string | undefined;
  private enabled = false;

  constructor(private readonly config: ConfigService) {
    this.supabaseUrl = this.config.get('SUPABASE_URL');
    this.supabaseAnonKey = this.config.get('SUPABASE_ANON_KEY');
    this.supabaseServiceRoleKey = this.config.get('SUPABASE_SERVICE_ROLE_KEY');

    if (this.supabaseUrl && this.supabaseServiceRoleKey) {
      this.enabled = true;
    } else {
      this.logger.warn(
        'SupabaseAuthService degraded: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY falta. ' +
          'Invitaciones caerán al placeholder gen_random_uuid().',
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Invita un usuario a Supabase Auth via email. Retorna el auth_user_id real,
   * o null si no está configurado (fallback a gen_random_uuid en el caller).
   */
  async invitar(email: string, nombre?: string): Promise<{ authUserId: string } | null> {
    if (!this.enabled) return null;

    try {
      const response = await fetch(`${this.supabaseUrl}/auth/v1/admin/invite`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          email,
          data: nombre ? { name: nombre } : {},
          // No password: el usuario lo elige al aceptar el email.
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        this.logger.error(
          `Supabase invite failed for ${email}: ${response.status}`,
          error,
        );
        return null;
      }

      const data = (await response.json()) as { id?: string; user?: { id?: string } };
      // Supabase retorna { id, user: {...} } — el id de la tabla auth.users
      const userId = data.id || data.user?.id;
      if (!userId) {
        this.logger.error(`Supabase invite response missing user ID for ${email}`);
        return null;
      }

      this.logger.log(`Invited ${email} → auth.users.id = ${userId}`);
      return { authUserId: userId };
    } catch (error) {
      this.logger.error(`Supabase invite error for ${email}:`, error);
      return null;
    }
  }

  /**
   * Dispara el email de recuperación de contraseña. El Admin nunca ve ni fija una
   * contraseña ajena — solo pide que Supabase se la mande a la persona. Nunca
   * lanza: un fallo de red no debe romper la petición del Admin, igual que `invitar()`.
   */
  async enviarResetPassword(email: string): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const response = await fetch(`${this.supabaseUrl}/auth/v1/recover`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        this.logger.error(`Supabase recover failed for ${email}: ${response.status}`, error);
        return false;
      }
      this.logger.log(`Password recovery email sent to ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Supabase recover error for ${email}:`, error);
      return false;
    }
  }

  /**
   * Sincroniza el email de login real (Admin API) cuando cambia en el dominio.
   * Llamar ANTES de escribir en `usuarios`: si esto falla, el dominio no debe
   * quedar desincronizado de la identidad real.
   */
  async actualizarEmail(authUserId: string, email: string): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const response = await fetch(`${this.supabaseUrl}/auth/v1/admin/users/${authUserId}`, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        this.logger.error(
          `Supabase update email failed for ${authUserId}: ${response.status}`,
          error,
        );
        return false;
      }
      this.logger.log(`Updated auth email for ${authUserId} → ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Supabase update email error for ${authUserId}:`, error);
      return false;
    }
  }

  private headers(): Record<string, string> {
    return {
      apikey: this.supabaseAnonKey!,
      authorization: `Bearer ${this.supabaseServiceRoleKey}`,
      'content-type': 'application/json',
    };
  }
}
