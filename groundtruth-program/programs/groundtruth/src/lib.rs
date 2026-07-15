use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked},
};
use mpl_bubblegum::{
    accounts::TreeConfig,
    instructions::{
        CreateTreeConfigCpi, CreateTreeConfigCpiAccounts, CreateTreeConfigInstructionArgs,
        MintV1Cpi, MintV1CpiAccounts, MintV1InstructionArgs,
    },
    types::{Creator, MetadataArgs, TokenProgramVersion, TokenStandard},
    utils::get_asset_id,
};

pub mod errors;
pub mod state;

use errors::GroundTruthError;
use state::*;

/// Programas de ZK Compression sobre los que se apoya Bubblegum. El crate
/// `mpl-bubblegum` no los exporta, así que se fijan aquí (son direcciones
/// canónicas de la plataforma, iguales en devnet y mainnet).
pub const SPL_ACCOUNT_COMPRESSION_ID: Pubkey =
    pubkey!("cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK");
pub const SPL_NOOP_ID: Pubkey = pubkey!("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV");

/// Nombre máximo de un cNFT en Bubblegum.
pub const MAX_NOMBRE_LEN: usize = 32;

declare_id!("GQ7rQxCBvpfHMPkApAjQ2TjMxpGMhifK72tpi5ChnzMH");

pub const MAX_URI_LEN: usize = 200;

/// GroundTruth — capa on-chain del Pay-per-Proof (Arquitectura §7).
///
/// Qué vive aquí y qué no: on-chain viajan **el valor** (USDC), **las referencias**
/// (URI de Arweave) y **las huellas** (SHA-256). La telemetría, los umbrales EUDR y
/// las tarifas son off-chain: este programa **no re-evalúa umbrales**, exige
/// *autorización* (firma del backend en el MVP; atestación TEE en Fase B).
///
/// **Atomicidad de la certificación:** un despacho de N parcelas se envía como UNA
/// transacción con N instrucciones `certify` + 1 `emit_manifest`. La atomicidad la da
/// la transacción de Solana —si cualquiera falla, revierten todas—, así que no hace
/// falta (ni conviene) meter N certificados en una sola instrucción.
#[program]
pub mod groundtruth {
    use super::*;

    /// Configuración global. La firma el admin de la plataforma, una sola vez.
    pub fn init_config(
        ctx: Context<InitConfig>,
        backend_authority: Pubkey,
        max_cert_fee: u64,
        max_manifest_fee: u64,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.backend_authority = backend_authority;
        config.usdc_mint = ctx.accounts.usdc_mint.key();
        config.max_cert_fee = max_cert_fee;
        config.max_manifest_fee = max_manifest_fee;
        config.attestation_required = false; // Fase B
        config.bump = ctx.bumps.config;
        Ok(())
    }

    /// Ajusta el firmante del backend y los techos de cobro (rotación de llaves, F5).
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        backend_authority: Pubkey,
        max_cert_fee: u64,
        max_manifest_fee: u64,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.backend_authority = backend_authority;
        config.max_cert_fee = max_cert_fee;
        config.max_manifest_fee = max_manifest_fee;
        Ok(())
    }

    /// Crea la unidad y su tesorería (Operator + Treasury PDA + ATA de USDC).
    ///
    /// La dirección del ATA es determinística por unidad: eso es lo que permite al
    /// webhook de Helius atribuir cada depósito **por cuenta destino, sin memo** (§7.4).
    pub fn init_operator_treasury(
        ctx: Context<InitOperatorTreasury>,
        operador_id: Uuid,
        authority: Pubkey,
    ) -> Result<()> {
        let operator = &mut ctx.accounts.operator;
        operator.operador_id = operador_id;
        operator.authority = authority;
        operator.active = true;
        operator.bump = ctx.bumps.operator;

        let treasury = &mut ctx.accounts.treasury;
        treasury.operador_id = operador_id;
        treasury.total_debitado = 0;
        treasury.bump = ctx.bumps.treasury;

        emit!(TreasuryInitialized {
            operador_id,
            treasury: treasury.key(),
            ata: ctx.accounts.treasury_ata.key(),
        });
        Ok(())
    }

    /// Suspende o reactiva una unidad on-chain (espejo de la suspensión del Admin).
    pub fn set_operator_active(ctx: Context<SetOperatorActive>, active: bool) -> Result<()> {
        ctx.accounts.operator.active = active;
        Ok(())
    }

    /// Crea el árbol Merkle donde vivirán los certificados comprimidos.
    ///
    /// El *tree creator* es la PDA `Config`, no una wallet: así **solo este programa**
    /// puede mintear certificados en él. Una keypair comprometida no basta para
    /// acuñar un certificado — tiene que pasar por `certify`, con sus reglas.
    ///
    /// La cuenta del árbol la asigna el cliente (tamaño según profundidad/buffer);
    /// aquí se le da su `TreeConfig` vía CPI a Bubblegum.
    pub fn create_certificate_tree(
        ctx: Context<CreateCertificateTree>,
        max_depth: u32,
        max_buffer_size: u32,
    ) -> Result<()> {
        let config_seeds: &[&[u8]] = &[b"config", &[ctx.accounts.config.bump]];

        CreateTreeConfigCpi::new(
            &ctx.accounts.bubblegum_program,
            CreateTreeConfigCpiAccounts {
                tree_config: &ctx.accounts.tree_config,
                merkle_tree: &ctx.accounts.merkle_tree,
                payer: &ctx.accounts.payer,
                tree_creator: &ctx.accounts.config.to_account_info(),
                log_wrapper: &ctx.accounts.log_wrapper,
                compression_program: &ctx.accounts.compression_program,
                system_program: &ctx.accounts.system_program,
            },
            CreateTreeConfigInstructionArgs {
                max_depth,
                max_buffer_size,
                public: Some(false), // solo el programa mintea
            },
        )
        .invoke_signed(&[config_seeds])?;

        emit!(CertificateTreeCreated {
            merkle_tree: ctx.accounts.merkle_tree.key(),
            max_depth,
            max_buffer_size,
        });
        Ok(())
    }

    pub fn register_farm(ctx: Context<RegisterFarm>, finca_id: Uuid) -> Result<()> {
        let farm = &mut ctx.accounts.farm;
        farm.finca_id = finca_id;
        farm.operador_id = ctx.accounts.operator.operador_id;
        farm.bump = ctx.bumps.farm;
        Ok(())
    }

    pub fn register_parcel(ctx: Context<RegisterParcel>, parcela_id: Uuid) -> Result<()> {
        let parcel = &mut ctx.accounts.parcel;
        parcel.parcela_id = parcela_id;
        parcel.finca_id = ctx.accounts.farm.finca_id;
        parcel.bump = ctx.bumps.parcel;
        Ok(())
    }

    /// **Certifica una parcela: cobra y deja el registro, de forma indivisible.**
    ///
    /// 1. Autorización: firma del backend (Fase B: + atestación TEE).
    /// 2. Idempotencia: `CertificateRecord` se crea con `init` sobre la seed
    ///    (parcela, ciclo) — si ya existía, la instrucción falla en la creación
    ///    de la cuenta y **no hay segundo cobro ni segundo mint**.
    /// 3. Débito de `fee` micro-USDC desde el ATA de la tesorería (signer seeds).
    /// 4. Mint del cNFT vía CPI a Bubblegum (`mint_v1`): el certificado ES el
    ///    activo. Su `asset_id` se deriva de (árbol, nonce) y queda guardado en el
    ///    `CertificateRecord`, que es lo que ata la base de datos con la cadena.
    pub fn certify(ctx: Context<Certify>, args: CertifyArgs) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(
            !config.attestation_required,
            GroundTruthError::AttestationRequired
        );
        require!(
            ctx.accounts.operator.active,
            GroundTruthError::OperatorInactive
        );
        require!(
            args.fee <= config.max_cert_fee,
            GroundTruthError::FeeExceedsCap
        );
        require!(
            args.geojson_uri.len() <= MAX_URI_LEN,
            GroundTruthError::UriTooLong
        );

        // La parcela debe colgar de una finca de ESTA unidad: un embarque nunca
        // cruza operadores, así que su tesorería tampoco puede pagar por otra.
        require!(
            ctx.accounts.parcel.finca_id == ctx.accounts.farm.finca_id,
            GroundTruthError::ParcelFarmMismatch
        );
        require!(
            ctx.accounts.farm.operador_id == ctx.accounts.operator.operador_id,
            GroundTruthError::FarmOperatorMismatch
        );

        require!(
            args.nombre.len() <= MAX_NOMBRE_LEN,
            GroundTruthError::UriTooLong
        );

        debitar(
            &ctx.accounts.token_program,
            &ctx.accounts.treasury_ata,
            &ctx.accounts.usdc_mint,
            &ctx.accounts.plataforma_ata,
            &ctx.accounts.treasury,
            args.fee,
        )?;

        // El asset ID de un cNFT se deriva de (árbol, nonce), y el nonce es el
        // número de hojas ya minteadas: hay que leerlo ANTES del mint.
        let nonce = {
            let data = ctx.accounts.tree_config.try_borrow_data()?;
            TreeConfig::from_bytes(&data)?.num_minted
        };
        let asset_id = get_asset_id(&ctx.accounts.merkle_tree.key(), nonce);

        // Mint del certificado comprimido. El dueño es la PDA de la unidad: el
        // certificado pertenece a quien lo pagó, no al firmante del backend.
        let config_seeds: &[&[u8]] = &[b"config", &[ctx.accounts.config.bump]];
        MintV1Cpi::new(
            &ctx.accounts.bubblegum_program,
            MintV1CpiAccounts {
                tree_config: &ctx.accounts.tree_config,
                leaf_owner: &ctx.accounts.operator.to_account_info(),
                leaf_delegate: &ctx.accounts.operator.to_account_info(),
                merkle_tree: &ctx.accounts.merkle_tree,
                payer: &ctx.accounts.payer,
                tree_creator_or_delegate: &ctx.accounts.config.to_account_info(),
                log_wrapper: &ctx.accounts.log_wrapper,
                compression_program: &ctx.accounts.compression_program,
                system_program: &ctx.accounts.system_program,
            },
            MintV1InstructionArgs {
                metadata: MetadataArgs {
                    name: args.nombre.clone(),
                    symbol: "GTEUDR".to_string(),
                    // El URI apunta al GeoJSON de la parcela en Arweave, que lleva
                    // los hashes embebidos (Arquitectura §11). Los archivos pesados no viajan.
                    uri: args.geojson_uri.clone(),
                    seller_fee_basis_points: 0,
                    primary_sale_happened: false,
                    is_mutable: false, // un certificado no se reescribe
                    edition_nonce: None,
                    token_standard: Some(TokenStandard::NonFungible),
                    collection: None,
                    uses: None,
                    token_program_version: TokenProgramVersion::Original,
                    creators: vec![Creator {
                        address: ctx.accounts.config.key(),
                        verified: true, // firma el programa: el certificado es auténtico
                        share: 100,
                    }],
                },
            },
        )
        .invoke_signed(&[config_seeds])?;

        let treasury = &mut ctx.accounts.treasury;
        treasury.total_debitado = treasury.total_debitado.saturating_add(args.fee);

        let record = &mut ctx.accounts.certificate_record;
        record.parcela_id = args.parcela_id;
        record.ciclo_id = args.ciclo_id;
        record.operador_id = ctx.accounts.operator.operador_id;
        record.asset_id = asset_id;
        record.geojson_uri = args.geojson_uri.clone();
        record.hash_pdf = args.hash_pdf;
        record.hash_imagen = args.hash_imagen;
        record.fee_pagada = args.fee;
        record.emitido_en = Clock::get()?.unix_timestamp;
        record.bump = ctx.bumps.certificate_record;

        emit!(CertificateIssued {
            parcela_id: args.parcela_id,
            ciclo_id: args.ciclo_id,
            operador_id: record.operador_id,
            asset_id: record.asset_id,
            geojson_uri: args.geojson_uri,
            hash_pdf: args.hash_pdf,
            hash_imagen: args.hash_imagen,
            fee_pagada: args.fee,
        });
        Ok(())
    }

    /// Cobra la micro-tarifa de manifiesto y ancla el URI del GeoJSON agregado.
    ///
    /// Se ejecuta en **cada** despacho, incluso si reutiliza el 100 % de los cNFTs
    /// vigentes: es lo que hace que un embarque "gratis" no exista.
    pub fn emit_manifest(
        ctx: Context<EmitManifest>,
        embarque_id: Uuid,
        geojson_uri: String,
        fee: u64,
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(
            ctx.accounts.operator.active,
            GroundTruthError::OperatorInactive
        );
        require!(
            fee <= config.max_manifest_fee,
            GroundTruthError::FeeExceedsCap
        );
        require!(
            geojson_uri.len() <= MAX_URI_LEN,
            GroundTruthError::UriTooLong
        );

        debitar(
            &ctx.accounts.token_program,
            &ctx.accounts.treasury_ata,
            &ctx.accounts.usdc_mint,
            &ctx.accounts.plataforma_ata,
            &ctx.accounts.treasury,
            fee,
        )?;

        let treasury = &mut ctx.accounts.treasury;
        treasury.total_debitado = treasury.total_debitado.saturating_add(fee);

        // El manifiesto NO es un cNFT (§ "No se emite un cNFT de embarque"): es un
        // evento que referencia los N certificados y ancla el agregado en Arweave.
        emit!(ManifestEmitted {
            embarque_id,
            operador_id: ctx.accounts.operator.operador_id,
            geojson_uri,
            fee_pagada: fee,
        });
        Ok(())
    }
}

/// Débito desde el ATA de la tesorería, firmado por el programa con las seeds de
/// la PDA. Es el único camino por el que salen USDC de una unidad.
fn debitar<'info>(
    token_program: &Interface<'info, TokenInterface>,
    treasury_ata: &InterfaceAccount<'info, TokenAccount>,
    usdc_mint: &InterfaceAccount<'info, Mint>,
    plataforma_ata: &InterfaceAccount<'info, TokenAccount>,
    treasury: &Account<'info, Treasury>,
    fee: u64,
) -> Result<()> {
    if fee == 0 {
        return Ok(());
    }
    require!(
        treasury_ata.amount >= fee,
        GroundTruthError::InsufficientFunds
    );

    let operador_id = treasury.operador_id;
    let seeds: &[&[u8]] = &[b"treasury", operador_id.as_ref(), &[treasury.bump]];

    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            TransferChecked {
                from: treasury_ata.to_account_info(),
                mint: usdc_mint.to_account_info(),
                to: plataforma_ata.to_account_info(),
                authority: treasury.to_account_info(),
            },
            &[seeds],
        ),
        fee,
        usdc_mint.decimals,
    )
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CertifyArgs {
    pub parcela_id: Uuid,
    pub ciclo_id: Uuid,
    /// Nombre del cNFT: el número público del certificado (`GT-AAAA-NNNNN`).
    pub nombre: String,
    pub geojson_uri: String,
    pub hash_pdf: [u8; 32],
    pub hash_imagen: [u8; 32],
    pub fee: u64,
}

// ---------- Contextos ----------

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Box<Account<'info, Config>>,
    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = admin)]
    pub config: Box<Account<'info, Config>>,
}

#[derive(Accounts)]
#[instruction(operador_id: Uuid)]
pub struct InitOperatorTreasury<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,

    #[account(
        init,
        payer = payer,
        space = 8 + Operator::INIT_SPACE,
        seeds = [b"operator", operador_id.as_ref()],
        bump
    )]
    pub operator: Account<'info, Operator>,

    #[account(
        init,
        payer = payer,
        space = 8 + Treasury::INIT_SPACE,
        seeds = [b"treasury", operador_id.as_ref()],
        bump
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(address = config.usdc_mint)]
    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,

    /// ATA de la tesorería: la dirección pública a la que la unidad deposita USDC.
    #[account(
        init,
        payer = payer,
        associated_token::mint = usdc_mint,
        associated_token::authority = treasury,
    )]
    pub treasury_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetOperatorActive<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin)]
    pub config: Box<Account<'info, Config>>,
    #[account(
        mut,
        seeds = [b"operator", operator.operador_id.as_ref()],
        bump = operator.bump
    )]
    pub operator: Account<'info, Operator>,
}

#[derive(Accounts)]
#[instruction(finca_id: Uuid)]
pub struct RegisterFarm<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    /// Solo el backend registra identidades (el frontend nunca firma esto).
    #[account(address = config.backend_authority)]
    pub backend_authority: Signer<'info>,

    #[account(
        seeds = [b"operator", operator.operador_id.as_ref()],
        bump = operator.bump
    )]
    pub operator: Account<'info, Operator>,

    #[account(
        init,
        payer = payer,
        space = 8 + Farm::INIT_SPACE,
        seeds = [b"farm", finca_id.as_ref()],
        bump
    )]
    pub farm: Account<'info, Farm>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(parcela_id: Uuid)]
pub struct RegisterParcel<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(address = config.backend_authority)]
    pub backend_authority: Signer<'info>,

    #[account(
        seeds = [b"farm", farm.finca_id.as_ref()],
        bump = farm.bump
    )]
    pub farm: Account<'info, Farm>,

    #[account(
        init,
        payer = payer,
        space = 8 + Parcel::INIT_SPACE,
        seeds = [b"parcel", parcela_id.as_ref()],
        bump
    )]
    pub parcel: Account<'info, Parcel>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: CertifyArgs)]
pub struct Certify<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    /// Autorización del MVP (F5): la keypair custodial del backend.
    #[account(address = config.backend_authority)]
    pub backend_authority: Signer<'info>,

    #[account(
        seeds = [b"operator", operator.operador_id.as_ref()],
        bump = operator.bump
    )]
    pub operator: Account<'info, Operator>,

    #[account(
        mut,
        seeds = [b"treasury", operator.operador_id.as_ref()],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(seeds = [b"farm", farm.finca_id.as_ref()], bump = farm.bump)]
    pub farm: Account<'info, Farm>,

    #[account(
        seeds = [b"parcel", args.parcela_id.as_ref()],
        bump = parcel.bump
    )]
    pub parcel: Account<'info, Parcel>,

    /// Idempotencia: si ya existe para (parcela, ciclo), `init` falla y revierte todo.
    #[account(
        init,
        payer = payer,
        space = 8 + CertificateRecord::INIT_SPACE,
        seeds = [b"cert", args.parcela_id.as_ref(), args.ciclo_id.as_ref()],
        bump
    )]
    pub certificate_record: Box<Account<'info, CertificateRecord>>,

    #[account(address = config.usdc_mint)]
    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = treasury,
    )]
    pub treasury_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    /// Cuenta de ingresos de la plataforma (destino del cobro).
    #[account(mut, token::mint = usdc_mint)]
    pub plataforma_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    // --- Bubblegum (cNFT comprimido) ---
    /// CHECK: la valida Bubblegum; su PDA es [merkle_tree] en su propio programa.
    #[account(mut)]
    pub tree_config: UncheckedAccount<'info>,
    /// CHECK: la valida el programa de compresión.
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,
    /// CHECK: programa Noop (log de compresión).
    #[account(address = SPL_NOOP_ID)]
    pub log_wrapper: UncheckedAccount<'info>,
    /// CHECK: programa SPL Account Compression.
    #[account(address = SPL_ACCOUNT_COMPRESSION_ID)]
    pub compression_program: UncheckedAccount<'info>,
    /// CHECK: programa Bubblegum.
    #[account(address = mpl_bubblegum::ID)]
    pub bubblegum_program: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateCertificateTree<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(address = config.backend_authority)]
    pub backend_authority: Signer<'info>,

    /// CHECK: la crea Bubblegum en el CPI.
    #[account(mut)]
    pub tree_config: UncheckedAccount<'info>,
    /// CHECK: cuenta del árbol, ya asignada por el cliente con su tamaño.
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,
    /// CHECK: programa Noop.
    #[account(address = SPL_NOOP_ID)]
    pub log_wrapper: UncheckedAccount<'info>,
    /// CHECK: programa SPL Account Compression.
    #[account(address = SPL_ACCOUNT_COMPRESSION_ID)]
    pub compression_program: UncheckedAccount<'info>,
    /// CHECK: programa Bubblegum.
    #[account(address = mpl_bubblegum::ID)]
    pub bubblegum_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EmitManifest<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(address = config.backend_authority)]
    pub backend_authority: Signer<'info>,

    #[account(
        seeds = [b"operator", operator.operador_id.as_ref()],
        bump = operator.bump
    )]
    pub operator: Account<'info, Operator>,

    #[account(
        mut,
        seeds = [b"treasury", operator.operador_id.as_ref()],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(address = config.usdc_mint)]
    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = treasury,
    )]
    pub treasury_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = usdc_mint)]
    pub plataforma_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
}

// ---------- Eventos (los consume el indexador / el webhook) ----------

#[event]
pub struct CertificateTreeCreated {
    pub merkle_tree: Pubkey,
    pub max_depth: u32,
    pub max_buffer_size: u32,
}

#[event]
pub struct TreasuryInitialized {
    pub operador_id: Uuid,
    pub treasury: Pubkey,
    pub ata: Pubkey,
}

#[event]
pub struct CertificateIssued {
    pub parcela_id: Uuid,
    pub ciclo_id: Uuid,
    pub operador_id: Uuid,
    pub asset_id: Pubkey,
    pub geojson_uri: String,
    pub hash_pdf: [u8; 32],
    pub hash_imagen: [u8; 32],
    pub fee_pagada: u64,
}

#[event]
pub struct ManifestEmitted {
    pub embarque_id: Uuid,
    pub operador_id: Uuid,
    pub geojson_uri: String,
    pub fee_pagada: u64,
}
