use anchor_lang::prelude::*;

/// Los identificadores del dominio son UUID de Postgres: 16 bytes crudos, que
/// se usan tal cual como seeds. Así la dirección de cada PDA es derivable desde
/// la base de datos sin guardar ningún mapeo (y sin poder desincronizarse).
pub type Uuid = [u8; 16];

/// Configuración global del programa (una sola, PDA `["config"]`).
#[account]
#[derive(InitSpace)]
pub struct Config {
    /// Puede reconfigurar el programa (multisig/KMS en producción).
    pub admin: Pubkey,
    /// Firmante custodial del backend (F5): lo único que autoriza `certify` y
    /// `emit_manifest` en el MVP. En Fase B se le suma la atestación TEE.
    pub backend_authority: Pubkey,
    /// Mint de USDC (devnet en el MVP).
    pub usdc_mint: Pubkey,
    /// Techos de cobro, en micro-USDC.
    ///
    /// Las tarifas son un parámetro OFF-CHAIN (las edita el Admin y viajan como
    /// argumento firmado por el backend). Sin un techo on-chain, una keypair de
    /// backend comprometida podría vaciar una tesorería en una sola llamada;
    /// con él, el daño queda acotado por transacción. No contradice el diseño:
    /// la tarifa sigue siendo configurable, solo que acotada.
    pub max_cert_fee: u64,
    pub max_manifest_fee: u64,
    /// Gate de atestación Switchboard (Fase B). En el MVP va en `false`:
    /// presente como interruptor, no como reescritura futura.
    pub attestation_required: bool,
    pub bump: u8,
}

/// Identidad de la unidad de negocio — PDA `["operator", operador_id]`.
#[account]
#[derive(InitSpace)]
pub struct Operator {
    pub operador_id: [u8; 16],
    /// Wallet de la unidad (informativa en el MVP: no firma nada todavía).
    pub authority: Pubkey,
    pub active: bool,
    pub bump: u8,
}

/// Authority de la tesorería — PDA `["treasury", operador_id]`.
///
/// No custodia los USDC: los tokens viven en su **ATA**, y esta PDA es su owner.
/// Solo el programa puede firmar débitos (signer seeds) → aislamiento total:
/// ninguna unidad puede gastar el USDC de otra.
#[account]
#[derive(InitSpace)]
pub struct Treasury {
    pub operador_id: [u8; 16],
    /// Espejo acumulado de lo cobrado (auditoría barata; la verdad es el ATA).
    pub total_debitado: u64,
    pub bump: u8,
}

/// Gemelo digital de la finca — PDA `["farm", finca_id]`.
#[account]
#[derive(InitSpace)]
pub struct Farm {
    pub finca_id: [u8; 16],
    pub operador_id: [u8; 16],
    pub bump: u8,
}

/// Identidad de la parcela — PDA `["parcel", parcela_id]`.
#[account]
#[derive(InitSpace)]
pub struct Parcel {
    pub parcela_id: [u8; 16],
    pub finca_id: [u8; 16],
    pub bump: u8,
}

/// Idempotencia on-chain del certificado — PDA `["cert", parcela_id, ciclo_id]`.
///
/// La identidad del certificado es el par (parcela, ciclo de siembra). Como la
/// cuenta se crea con `init`, un segundo `certify` para el mismo par **falla en
/// la creación de la cuenta**: la propia cadena impide el doble cobro y el doble
/// mint, sin que el programa tenga que comprobar nada.
#[account]
#[derive(InitSpace)]
pub struct CertificateRecord {
    pub parcela_id: [u8; 16],
    pub ciclo_id: [u8; 16],
    pub operador_id: [u8; 16],
    /// Asset ID del cNFT (Bubblegum). Queda en `Pubkey::default()` hasta que se
    /// cablee el mint comprimido: el registro y el cobro ya son reales.
    pub asset_id: Pubkey,
    /// URI del GeoJSON de la parcela en Arweave (lo jurídicamente vinculante).
    #[max_len(200)]
    pub geojson_uri: String,
    /// Huellas SHA-256 de los archivos pesados, que nunca viajan on-chain.
    pub hash_pdf: [u8; 32],
    pub hash_imagen: [u8; 32],
    /// Micro-USDC efectivamente cobrados por este certificado.
    pub fee_pagada: u64,
    pub emitido_en: i64,
    pub bump: u8,
}
