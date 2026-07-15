import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Logger,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '@/auth/public.decorator';
import { DepositosService } from './depositos.service';

/**
 * Webhook de Helius: avisa de USDC entrante en la ATA de una tesorería.
 *
 * Es **público** porque quien llama es Helius, no una persona: no hay JWT. La
 * autenticación es un secreto compartido en la cabecera `authorization`, que se
 * compara en **tiempo constante** (una comparación normal filtra el secreto byte
 * a byte por temporización).
 *
 * El aviso NO se cree a ciegas: solo dispara la reconciliación contra la cadena.
 * Un webhook falsificado, en el peor caso, provoca una lectura de más — nunca un
 * depósito inventado, porque el dinero lo pone el ATA, no el payload.
 */
@Controller('webhooks/helius')
export class HeliusController {
  private readonly log = new Logger(HeliusController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly depositos: DepositosService,
  ) {}

  @Public()
  @Post()
  async recibir(
    @Headers('authorization') auth: string | undefined,
    @Body() body: unknown,
  ) {
    this.verificarSecreto(auth);

    // Helius manda un array de transacciones (enhanced o raw). Solo nos interesan
    // las cuentas tocadas: con eso ya sabemos a qué unidad reconciliar.
    const eventos = Array.isArray(body) ? body : [body];
    const cuentas = new Set<string>();
    for (const e of eventos as any[]) {
      for (const t of e?.tokenTransfers ?? []) {
        if (t?.toTokenAccount) cuentas.add(t.toTokenAccount);
      }
      for (const c of e?.accountData ?? []) {
        for (const b of c?.tokenBalanceChanges ?? []) {
          if (b?.tokenAccount) cuentas.add(b.tokenAccount);
        }
      }
    }

    let sincronizadas = 0;
    for (const ata of cuentas) {
      if (await this.depositos.sincronizarPorAta(ata)) sincronizadas++;
    }

    this.log.log(`Helius: ${cuentas.size} cuenta(s), ${sincronizadas} tesorería(s) reconciliada(s).`);
    return { ok: true, sincronizadas };
  }

  private verificarSecreto(auth: string | undefined) {
    const esperado = this.config.get<string>('HELIUS_WEBHOOK_SECRET');
    // Sin secreto configurado el webhook queda CERRADO: un endpoint público sin
    // autenticar es peor que no tenerlo.
    if (!esperado) throw new ForbiddenException();
    if (!auth) throw new ForbiddenException();

    const a = Buffer.from(auth);
    const b = Buffer.from(esperado);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException();
    }
  }
}
