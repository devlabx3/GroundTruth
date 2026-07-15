import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Evalscript versionado: la reproducibilidad de la evidencia depende de él, así
 * que su versión se guarda junto a la imagen (`evidencias_satelitales`). Cambiar
 * el script sin cambiar la versión rompería la posibilidad de re-verificar.
 */
export const EVALSCRIPT_VERSION = 'true-color-v1';
const EVALSCRIPT = `//VERSION=3
function setup() {
  return { input: ["B02", "B03", "B04"], output: { bands: 3 } };
}
function evaluatePixel(s) {
  return [2.5 * s.B04, 2.5 * s.B03, 2.5 * s.B02];
}`;

export interface ImagenSatelital {
  png: Buffer;
  bbox: [number, number, number, number];
  desde: string;
  hasta: string;
  evalscriptVersion: string;
  resolucionM: number;
}

/**
 * Sentinel Hub (Copernicus): descarga la imagen de la parcela que sirve de
 * evidencia visual del certificado.
 *
 * **Desactivado sin credenciales** (`SENTINEL_CLIENT_ID`/`SECRET`): en ese caso
 * `obtener()` devuelve null y la certificación sigue sin imagen anclada. No se
 * inventa una imagen ni un hash — el hueco se ve.
 */
@Injectable()
export class SentinelService {
  private readonly log = new Logger(SentinelService.name);
  private token?: { valor: string; expiraEn: number };

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return (
      !!this.config.get<string>('SENTINEL_CLIENT_ID') &&
      !!this.config.get<string>('SENTINEL_CLIENT_SECRET')
    );
  }

  private base(): string {
    return (
      this.config.get<string>('SENTINEL_BASE_URL') ?? 'https://services.sentinel-hub.com'
    ).replace(/\/$/, '');
  }

  private async accessToken(): Promise<string> {
    const ahora = Date.now();
    if (this.token && this.token.expiraEn > ahora + 30_000) return this.token.valor;

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.getOrThrow<string>('SENTINEL_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>('SENTINEL_CLIENT_SECRET'),
    });
    const res = await fetch(`${this.base()}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) throw new Error(`Sentinel OAuth ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = {
      valor: json.access_token,
      expiraEn: ahora + json.expires_in * 1000,
    };
    return this.token.valor;
  }

  /**
   * Imagen de la parcela a partir de su bbox (EPSG:4326). Devuelve `null` si
   * Sentinel no está configurado.
   */
  async obtener(
    bbox: [number, number, number, number],
    diasAtras = 30,
  ): Promise<ImagenSatelital | null> {
    if (!this.isEnabled()) return null;

    const hasta = new Date();
    const desde = new Date(hasta.getTime() - diasAtras * 86_400_000);

    const res = await fetch(`${this.base()}/api/v1/process`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await this.accessToken()}`,
        'content-type': 'application/json',
        accept: 'image/png',
      },
      body: JSON.stringify({
        input: {
          bounds: { bbox, properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' } },
          data: [
            {
              type: 'sentinel-2-l2a',
              dataFilter: {
                timeRange: { from: desde.toISOString(), to: hasta.toISOString() },
                // La menos nublada del rango: la evidencia tiene que verse.
                mosaickingOrder: 'leastCC',
              },
            },
          ],
        },
        output: {
          width: 512,
          height: 512,
          responses: [{ identifier: 'default', format: { type: 'image/png' } }],
        },
        evalscript: EVALSCRIPT,
      }),
    });
    if (!res.ok) throw new Error(`Sentinel process ${res.status}: ${await res.text()}`);

    return {
      png: Buffer.from(await res.arrayBuffer()),
      bbox,
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      evalscriptVersion: EVALSCRIPT_VERSION,
      resolucionM: 10, // Sentinel-2 bandas visibles
    };
  }
}
