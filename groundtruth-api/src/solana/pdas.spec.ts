import { describe, it, expect } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { uuidBytes, treasuryPda, certPda, operatorPda } from './pdas';

const PROGRAM = new PublicKey('GQ7rQxCBvpfHMPkApAjQ2TjMxpGMhifK72tpi5ChnzMH');
const OPERADOR = '11111111-1111-1111-1111-111111111111';
const PARCELA = '55555555-5555-5555-5555-555555555552';
const CICLO = '3b91f3a4-fe75-4399-a03e-28cabcfd02da';

describe('uuidBytes', () => {
  it('convierte el UUID a sus 16 bytes crudos (no a su texto)', () => {
    const b = uuidBytes(OPERADOR);
    expect(b).toHaveLength(16); // 16, no 36: el texto ocuparía 36
    expect(b.toString('hex')).toBe('11111111111111111111111111111111');
  });

  it('rechaza un UUID malformado en vez de derivar una PDA silenciosamente errónea', () => {
    expect(() => uuidBytes('no-soy-un-uuid')).toThrow();
    expect(() => uuidBytes('')).toThrow();
  });
});

describe('derivación de PDAs', () => {
  it('la Treasury de un operador es estable: si cambia, su dinero se pierde de vista', () => {
    // Valor congelado a propósito: coincide con la tesorería real verificada
    // contra el validador. Cualquier cambio de seed lo rompe, que es el objetivo.
    expect(treasuryPda(PROGRAM, OPERADOR).toBase58()).toBe(
      'FStyGZ92nCDQue6VceeSH21mZFGBtKsMwQq26KaiyoG7',
    );
  });

  it('operadores distintos tienen tesorerías distintas (aislamiento)', () => {
    const a = treasuryPda(PROGRAM, OPERADOR);
    const b = treasuryPda(PROGRAM, '22222222-2222-2222-2222-222222222222');
    expect(a.toBase58()).not.toBe(b.toBase58());
  });

  it('el certificado se identifica por (parcela, ciclo): otro ciclo, otra cuenta', () => {
    const mismo = certPda(PROGRAM, PARCELA, CICLO);
    const otroCiclo = certPda(PROGRAM, PARCELA, '00000000-0000-0000-0000-000000000001');

    // Esta desigualdad ES la idempotencia on-chain: una siembra nueva mintea un
    // cNFT nuevo; la misma siembra choca contra la cuenta que ya existe.
    expect(mismo.toBase58()).not.toBe(otroCiclo.toBase58());
  });

  it('la derivación es determinista (mismo input → misma dirección)', () => {
    expect(operatorPda(PROGRAM, OPERADOR).toBase58()).toBe(
      operatorPda(PROGRAM, OPERADOR).toBase58(),
    );
  });
});
