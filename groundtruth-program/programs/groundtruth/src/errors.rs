use anchor_lang::prelude::*;

/// Los códigos que el backend traduce a las claves i18n del frontend
/// (Gestion-de-Errores §6). El mensaje de aquí es para el explorador y los logs;
/// el que ve la persona sale del diccionario, nunca de la cadena.
#[error_code]
pub enum GroundTruthError {
    #[msg("La unidad está suspendida on-chain: no puede certificar.")]
    OperatorInactive,

    #[msg("La tarifa supera el techo configurado en el programa.")]
    FeeExceedsCap,

    #[msg("Fondos insuficientes en la tesorería de la unidad.")]
    InsufficientFunds,

    #[msg("La parcela no pertenece a la finca indicada.")]
    ParcelFarmMismatch,

    #[msg("La finca no pertenece a la unidad que despacha.")]
    FarmOperatorMismatch,

    #[msg("Se requiere atestación TEE (Fase B) y no se aportó.")]
    AttestationRequired,

    #[msg("El URI del GeoJSON excede el tamaño máximo.")]
    UriTooLong,
}
