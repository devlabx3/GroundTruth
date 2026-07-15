import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

/** Buckets privados: la evidencia no es pública, se sirve firmada. */
export const BUCKET_EVIDENCIA = 'evidencia';

/**
 * Supabase Storage — "storage económico" (Arquitectura §11): aquí viven los archivos
 * pesados (PDF del certificado, copia de la imagen satelital). On-chain solo
 * viajan sus **hashes**; el archivo nunca.
 *
 * Sin `SUPABASE_SERVICE_ROLE_KEY` queda desactivado y la certificación sigue
 * sin evidencia anclada, en vez de romperse.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly log = new Logger(StorageService.name);
  private url?: string;
  private key?: string;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      this.log.warn('Storage desactivado: falta SUPABASE_SERVICE_ROLE_KEY.');
      return;
    }
    this.url = url.replace(/\/$/, '');
    this.key = key;
    await this.asegurarBucket(BUCKET_EVIDENCIA);
  }

  isEnabled(): boolean {
    return this.key !== undefined;
  }

  /** SHA-256 sobre la copia ALMACENADA (Arquitectura §6): ese es el hash que se ancla. */
  sha256(buf: Buffer): string {
    return createHash('sha256').update(buf).digest('hex');
  }

  private async asegurarBucket(id: string) {
    const res = await fetch(`${this.url}/storage/v1/bucket`, {
      method: 'POST',
      headers: this.cabeceras('application/json'),
      body: JSON.stringify({ id, name: id, public: false }),
    });
    if (res.ok) return;

    // "Ya existe" es el camino de ÉXITO de una función que se llama `asegurarBucket`.
    // Ojo: Supabase Storage no responde 409 sino **HTTP 400** con el 409 dentro del
    // cuerpo (`{"statusCode":"409","error":"Duplicate"}`). Mirar solo `res.status`
    // hacía que cada arranque gritara "No se pudo crear el bucket" mientras todo iba
    // bien — y un WARN que siempre miente enseña a ignorar los WARN de verdad.
    const cuerpo = await res.text();
    if (esDuplicado(res.status, cuerpo)) return;

    this.log.warn(`No se pudo crear el bucket ${id}: ${res.status} ${cuerpo}`);
  }

  /** Sube (con upsert) y devuelve la ruta y el hash de lo realmente almacenado. */
  async subir(
    path: string,
    contenido: Buffer,
    contentType: string,
  ): Promise<{ path: string; hash: string }> {
    const res = await fetch(
      `${this.url}/storage/v1/object/${BUCKET_EVIDENCIA}/${path}`,
      {
        method: 'POST',
        headers: { ...this.cabeceras(contentType), 'x-upsert': 'true' },
        body: new Uint8Array(contenido),
      },
    );
    if (!res.ok) {
      throw new Error(`Storage ${res.status}: ${await res.text()}`);
    }
    return { path: `${BUCKET_EVIDENCIA}/${path}`, hash: this.sha256(contenido) };
  }

  private cabeceras(contentType: string): Record<string, string> {
    return {
      apikey: this.key!,
      authorization: `Bearer ${this.key}`,
      'content-type': contentType,
    };
  }
}

/**
 * ¿El bucket ya existía? Supabase lo señala de dos formas según la versión: un
 * 409 limpio, o un 400 con `statusCode: "409"` / `error: "Duplicate"` en el cuerpo.
 * Se aceptan ambas — pero solo esas: cualquier otro 400 sigue siendo un fallo real
 * (credenciales inválidas, nombre prohibido) y debe avisar.
 */
export function esDuplicado(status: number, cuerpo: string): boolean {
  if (status === 409) return true;
  if (status !== 400) return false;
  try {
    const j = JSON.parse(cuerpo) as { statusCode?: string; error?: string };
    return j.statusCode === '409' || j.error === 'Duplicate';
  } catch {
    return false; // cuerpo no-JSON: no se asume nada
  }
}
