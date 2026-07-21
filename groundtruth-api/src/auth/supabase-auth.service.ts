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
 * Headers: apikey + Authorization: Bearer {service_role_key} (ambos con service_role_key para admin ops)
 */
@Injectable()
export class SupabaseAuthService {
  private readonly logger = new Logger(SupabaseAuthService.name);
  private readonly supabaseUrl: string | undefined;
  private readonly supabaseAnonKey: string | undefined;
  private readonly supabaseServiceRoleKey: string | undefined;
  private readonly frontendUrl: string | undefined;
  private enabled = false;

  constructor(private readonly config: ConfigService) {
    this.supabaseUrl = this.config.get('SUPABASE_URL');
    this.supabaseAnonKey = this.config.get('SUPABASE_ANON_KEY');
    this.supabaseServiceRoleKey = this.config.get('SUPABASE_SERVICE_ROLE_KEY');
    this.frontendUrl = this.config.get('FRONTEND_URL');

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
   * El link del email apunta a /reset-password en el frontend (vía redirectTo).
   */
  async enviarResetPassword(email: string): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const redirectTo = this.frontendUrl ? `${this.frontendUrl}/es/reset-password` : undefined;
      const response = await fetch(`${this.supabaseUrl}/auth/v1/recover`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          email,
          ...(redirectTo && { redirect_to: redirectTo }),
        }),
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

  /**
   * Fija una contraseña directamente (sin pasar por email) — vía transitoria
   * mientras el proveedor SMTP (Resend) está suspendido/en revisión: el Admin
   * ve la contraseña una vez y se la da al usuario por otro canal.
   * Si el usuario no existe en Supabase Auth (404), lo crea primero.
   * Retorna { success: true, newAuthUserId?: string } para permitir al caller
   * sincronizar la BD si el usuario fue creado.
   */
  async fijarPassword(
    authUserId: string,
    password: string,
    email?: string,
  ): Promise<{ success: boolean; newAuthUserId?: string }> {
    if (!this.enabled) return { success: false };

    try {
      const response = await fetch(`${this.supabaseUrl}/auth/v1/admin/users/${authUserId}`, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify({ password, email_confirm: true }),
        signal: AbortSignal.timeout(10_000),
      });

      // Si 404 (usuario no existe), intentar crearlo primero
      if (response.status === 404 && email) {
        this.logger.log(`User ${authUserId} not found, attempting to create with email ${email}`);
        const createResult = await this.crearUsuarioEnAuthYFijarPassword(email, password);
        if (createResult) {
          return { success: true, newAuthUserId: createResult };
        }
        return { success: false };
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        this.logger.error(
          `Supabase set password failed for ${authUserId}: ${response.status}`,
          error,
        );
        return { success: false };
      }
      this.logger.log(`Password set for ${authUserId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Supabase set password error for ${authUserId}:`, error);
      return { success: false };
    }
  }

  /**
   * Crea un usuario en Supabase Auth con email+password, activo (email confirmado).
   * Retorna el nuevo ID creado, o null si falla.
   */
  private async crearUsuarioEnAuthYFijarPassword(email: string, password: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          email,
          password,
          email_confirm: true, // Marca como email confirmado = activo
          user_metadata: { created_by_admin: true },
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        this.logger.error(
          `Supabase user creation failed for ${email}: ${response.status}`,
          error,
        );
        return null;
      }

      const data = (await response.json()) as { id?: string };
      const createdUserId = data.id;
      if (!createdUserId) {
        this.logger.error(`Supabase user creation response missing user ID for ${email}`);
        return null;
      }

      this.logger.log(`Created Supabase user ${createdUserId} for ${email}, active with password set`);
      return createdUserId;
    } catch (error) {
      this.logger.error(`Supabase user creation error for ${email}:`, error);
      return null;
    }
  }

  private headers(): Record<string, string> {
    return {
      apikey: this.supabaseServiceRoleKey!,
      authorization: `Bearer ${this.supabaseServiceRoleKey}`,
      'content-type': 'application/json',
    };
  }
}
