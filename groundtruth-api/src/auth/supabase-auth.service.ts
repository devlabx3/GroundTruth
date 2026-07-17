import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Supabase Auth Admin — invitaciones reales vía email (Bloque 1 ítem 3).
 *
 * Patrón: mismo que `StorageService` — usa `fetch` crudo contra la API REST de Supabase,
 * se degrada con gracia si faltan credenciales (no revienta el módulo, `isEnabled()` = false).
 *
 * API: POST {SUPABASE_URL}/auth/v1/admin/invite
 * Headers: apikey (anonymous key) + Authorization: Bearer {service_role_key}
 * Body: { email, password?, data?: {name, ...} }
 *
 * Reemplaza los 3 sitios que hoy usan `gen_random_uuid()` como placeholder:
 * - agricultores.service.ts:59-63 (crear agricultor)
 * - admin/unidades.service.ts:186-190 (crear usuario en unidad)
 * - admin/identidad.service.ts:63-67 (crear usuario de plataforma)
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

  private headers(): Record<string, string> {
    return {
      apikey: this.supabaseAnonKey!,
      authorization: `Bearer ${this.supabaseServiceRoleKey}`,
      'content-type': 'application/json',
    };
  }
}
