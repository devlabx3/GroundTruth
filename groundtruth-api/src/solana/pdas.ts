import { PublicKey } from '@solana/web3.js';

/**
 * Derivación de las PDAs del programa. Módulo **puro** a propósito: estas seeds
 * son un contrato con la cadena. Si una cambia, la Treasury PDA de un operador
 * pasa a ser otra cuenta — y su dinero deja de estar donde el backend lo busca.
 *
 * Los identificadores son los UUID de Postgres **en crudo** (16 bytes), no su
 * texto: así la dirección es derivable desde la base de datos sin guardar ningún
 * mapeo que pueda desincronizarse.
 */
export function uuidBytes(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(hex)) {
    throw new Error(`UUID inválido: ${uuid}`);
  }
  return Buffer.from(hex, 'hex');
}

const pda = (seeds: (Buffer | Uint8Array)[], programId: PublicKey) =>
  PublicKey.findProgramAddressSync(seeds, programId)[0];

export const configPda = (programId: PublicKey) =>
  pda([Buffer.from('config')], programId);

export const operatorPda = (programId: PublicKey, operadorId: string) =>
  pda([Buffer.from('operator'), uuidBytes(operadorId)], programId);

export const treasuryPda = (programId: PublicKey, operadorId: string) =>
  pda([Buffer.from('treasury'), uuidBytes(operadorId)], programId);

export const farmPda = (programId: PublicKey, fincaId: string) =>
  pda([Buffer.from('farm'), uuidBytes(fincaId)], programId);

export const parcelPda = (programId: PublicKey, parcelaId: string) =>
  pda([Buffer.from('parcel'), uuidBytes(parcelaId)], programId);

export const certPda = (programId: PublicKey, parcelaId: string, cicloId: string) =>
  pda([Buffer.from('cert'), uuidBytes(parcelaId), uuidBytes(cicloId)], programId);
