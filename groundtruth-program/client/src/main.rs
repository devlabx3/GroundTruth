//! Pruebas de integración del programa GroundTruth contra un validador real.
//!
//! No comprueban que "el código corre": comprueban las **garantías del negocio**
//! —idempotencia, atomicidad del cobro, aislamiento entre unidades y el techo de
//! tarifa—, que es lo único que justifica poner esto on-chain.
//!
//! Uso: `cargo run --bin e2e -- <RPC_URL>` (por defecto http://127.0.0.1:8899).

use anchor_lang::{InstructionData, ToAccountMetas};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    compute_budget::ComputeBudgetInstruction,
    instruction::Instruction,
    program_pack::Pack,
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    system_instruction,
    transaction::Transaction,
};
use spl_associated_token_account::get_associated_token_address;

const MICRO: u64 = 1_000_000; // 1 USDC = 10^6 micro-USDC (6 decimales)

type Uuid = [u8; 16];

fn uuid(n: u8) -> Uuid {
    let mut u = [0u8; 16];
    u[15] = n;
    u
}

struct Ctx {
    rpc: RpcClient,
    payer: Keypair,
    backend: Keypair,
    usdc_mint: Pubkey,
    plataforma_ata: Pubkey,
    program: Pubkey,
    merkle_tree: Pubkey,
}

/// Profundidad 14 / buffer 64 → hasta 16 384 certificados en un árbol.
const MAX_DEPTH: u32 = 14;
const MAX_BUFFER: u32 = 64;

fn main() {
    let url = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "http://127.0.0.1:8899".to_string());
    let rpc = RpcClient::new_with_commitment(url, CommitmentConfig::confirmed());

    let payer = Keypair::new();
    let backend = Keypair::new();
    let program = groundtruth::ID;

    println!("Programa: {program}");
    airdrop(&rpc, &payer.pubkey(), 100);
    airdrop(&rpc, &backend.pubkey(), 10);

    // Mint de USDC de prueba (6 decimales, como el USDC real).
    let usdc_mint = crear_mint(&rpc, &payer);
    let plataforma_ata = crear_ata(&rpc, &payer, &usdc_mint, &payer.pubkey());
    println!("USDC de prueba: {usdc_mint}");

    let tree = Keypair::new();
    let mut ctx = Ctx {
        rpc,
        payer,
        backend,
        usdc_mint,
        plataforma_ata,
        program,
        merkle_tree: tree.pubkey(),
    };

    let mut fallos = 0;

    // --- Preparación: config, árbol de certificados, unidad A, finca y parcelas ---
    init_config(&ctx, 10 * MICRO, 5 * MICRO);
    println!("\n[setup] config: techo cert = 10 USDC, techo manifiesto = 5 USDC");

    crear_arbol(&mut ctx, &tree);
    println!("[setup] árbol de certificados: {} (hasta {} cNFTs)", ctx.merkle_tree, 1u64 << MAX_DEPTH);

    let op_a = uuid(1);
    let (treasury_a, ata_a) = init_operator(&ctx, op_a);
    mint_to(&ctx, &ata_a, 100 * MICRO);
    println!("[setup] unidad A: tesorería fondeada con 100 USDC");

    let finca_a = uuid(10);
    register_farm(&ctx, op_a, finca_a);
    let parcela_1 = uuid(20);
    let parcela_2 = uuid(21);
    register_parcel(&ctx, finca_a, parcela_1);
    register_parcel(&ctx, finca_a, parcela_2);

    let ciclo_1 = uuid(30);

    // --- 1. Certificación real: cobra y deja registro ---
    println!("\n=== 1. certify: cobra 5 USDC y crea el CertificateRecord");
    let antes = saldo(&ctx, &ata_a);
    let r = certify(&ctx, op_a, finca_a, parcela_1, ciclo_1, 5 * MICRO);
    if let Err(e) = &r {
        println!("   ERROR: {e}");
    }
    let despues = saldo(&ctx, &ata_a);
    check(
        &mut fallos,
        r.is_ok() && antes - despues == 5 * MICRO,
        &format!("cobro real: {} → {} USDC", antes / MICRO, despues / MICRO),
    );
    let (cert_pda, _) = Pubkey::find_program_address(
        &[b"cert", parcela_1.as_ref(), ciclo_1.as_ref()],
        &ctx.program,
    );
    check(
        &mut fallos,
        ctx.rpc.get_account(&cert_pda).is_ok(),
        "CertificateRecord existe on-chain",
    );

    // El certificado ES el cNFT: sin asset ID no hay certificado, solo un cobro.
    let asset_id = leer_asset_id(&ctx, &cert_pda);
    let esperado = mpl_bubblegum::utils::get_asset_id(&ctx.merkle_tree, 0);
    check(
        &mut fallos,
        asset_id != Pubkey::default() && asset_id == esperado,
        &format!("cNFT minteado — asset ID: {asset_id}"),
    );

    // --- 2. IDEMPOTENCIA: el mismo (parcela, ciclo) no se cobra dos veces ---
    println!("\n=== 2. certify repetido (misma parcela y ciclo) → debe fallar sin cobrar");
    let antes = saldo(&ctx, &ata_a);
    let r = certify(&ctx, op_a, finca_a, parcela_1, ciclo_1, 5 * MICRO);
    let despues = saldo(&ctx, &ata_a);
    check(
        &mut fallos,
        r.is_err() && antes == despues,
        &format!("rechazado y SIN doble cobro (saldo intacto: {} USDC)", despues / MICRO),
    );

    // --- 3. Techo de tarifa: acota a un backend comprometido ---
    println!("\n=== 3. certify con tarifa 50 USDC (techo = 10) → debe rechazarse");
    let antes = saldo(&ctx, &ata_a);
    let r = certify(&ctx, op_a, finca_a, parcela_2, uuid(31), 50 * MICRO);
    let despues = saldo(&ctx, &ata_a);
    check(
        &mut fallos,
        r.is_err() && antes == despues,
        "FeeExceedsCap: la tesorería no se puede vaciar de una llamada",
    );

    // --- 4. ATOMICIDAD: N certify + emit_manifest en UNA transacción ---
    println!("\n=== 4. despacho atómico: 1 certify + 1 emit_manifest en la misma TX");
    let antes = saldo(&ctx, &ata_a);
    let r = despacho_atomico(&ctx, op_a, finca_a, parcela_2, uuid(32), 5 * MICRO, 2 * MICRO);
    let despues = saldo(&ctx, &ata_a);
    check(
        &mut fallos,
        r.is_ok() && antes - despues == 7 * MICRO,
        &format!("cert 5 + manifiesto 2 = 7 USDC cobrados juntos ({} → {})", antes / MICRO, despues / MICRO),
    );
    // El nonce del árbol debe AVANZAR: si se quedara en 0, todos los certificados
    // compartirían asset ID y el cNFT no identificaría nada.
    let (cert2_pda, _) = Pubkey::find_program_address(
        &[b"cert", parcela_2.as_ref(), uuid(32).as_ref()],
        &ctx.program,
    );
    let asset2 = leer_asset_id(&ctx, &cert2_pda);
    check(
        &mut fallos,
        asset2 == mpl_bubblegum::utils::get_asset_id(&ctx.merkle_tree, 1) && asset2 != asset_id,
        "segundo cNFT con asset ID distinto (el nonce del árbol avanza)",
    );

    // --- 5. ATOMICIDAD ante fallo: si un certify falla, revierte TODO ---
    println!("\n=== 5. TX con un certify duplicado + manifiesto → revierte entera");
    let antes = saldo(&ctx, &ata_a);
    // parcela_1/ciclo_1 ya está certificada → el certify falla; el manifiesto NO debe cobrarse.
    let r = despacho_atomico(&ctx, op_a, finca_a, parcela_1, ciclo_1, 5 * MICRO, 2 * MICRO);
    let despues = saldo(&ctx, &ata_a);
    check(
        &mut fallos,
        r.is_err() && antes == despues,
        "ni cobro de certificación ni de manifiesto: la TX revirtió completa",
    );

    // --- 6. AISLAMIENTO: la unidad B no puede pagar con la tesorería de A ---
    println!("\n=== 6. unidad B intenta certificar su parcela debitando la tesorería de A");
    let op_b = uuid(2);
    let (_treasury_b, ata_b) = init_operator(&ctx, op_b);
    mint_to(&ctx, &ata_b, 10 * MICRO);
    let finca_b = uuid(11);
    register_farm(&ctx, op_b, finca_b);
    let parcela_b = uuid(22);
    register_parcel(&ctx, finca_b, parcela_b);

    let antes_a = saldo(&ctx, &ata_a);
    let r = certify_cruzado(&ctx, op_b, finca_b, parcela_b, uuid(33), 5 * MICRO, treasury_a, ata_a);
    let despues_a = saldo(&ctx, &ata_a);
    check(
        &mut fallos,
        r.is_err() && antes_a == despues_a,
        "rechazado: ninguna unidad puede gastar el USDC de otra",
    );

    // --- 7. Fondos insuficientes ---
    println!("\n=== 7. certify con tesorería sin fondos suficientes");
    let antes_b = saldo(&ctx, &ata_b);
    let r = certify(&ctx, op_b, finca_b, parcela_b, uuid(34), 10 * MICRO); // B solo tiene 10, tarifa 10 → ok
    let ok_justo = r.is_ok();
    let r2 = certify(&ctx, op_b, finca_b, parcela_b, uuid(35), 10 * MICRO); // ya no le queda
    let despues_b = saldo(&ctx, &ata_b);
    check(
        &mut fallos,
        ok_justo && r2.is_err() && despues_b == 0,
        &format!("cobra hasta agotar ({} → 0) y luego rechaza por fondos", antes_b / MICRO),
    );

    println!("\n{}", "=".repeat(60));
    if fallos == 0 {
        println!("TODAS LAS GARANTÍAS VERIFICADAS ✓");
    } else {
        println!("{fallos} COMPROBACIONES FALLARON ✗");
        std::process::exit(1);
    }
}

fn check(fallos: &mut u32, ok: bool, msg: &str) {
    if ok {
        println!("   ✓ {msg}");
    } else {
        *fallos += 1;
        println!("   ✗ {msg}");
    }
}

// ---------- Instrucciones ----------

fn config_pda(program: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"config"], program).0
}

fn init_config(ctx: &Ctx, max_cert: u64, max_manifest: u64) {
    let config = config_pda(&ctx.program);
    let ix = Instruction {
        program_id: ctx.program,
        accounts: groundtruth::accounts::InitConfig {
            admin: ctx.payer.pubkey(),
            config,
            usdc_mint: ctx.usdc_mint,
            system_program: solana_sdk::system_program::ID,
        }
        .to_account_metas(None),
        data: groundtruth::instruction::InitConfig {
            backend_authority: ctx.backend.pubkey(),
            max_cert_fee: max_cert,
            max_manifest_fee: max_manifest,
        }
        .data(),
    };
    enviar(ctx, &[ix], &[&ctx.payer]).expect("init_config");
}

/// Asigna la cuenta del árbol (con su tamaño) y le pide a Bubblegum su TreeConfig.
/// El *tree creator* es la PDA `Config` del programa, así que solo `certify` mintea.
fn crear_arbol(ctx: &mut Ctx, tree: &Keypair) {
    let size = spl_account_compression::state::CONCURRENT_MERKLE_TREE_HEADER_SIZE_V1
        + std::mem::size_of::<spl_account_compression::ConcurrentMerkleTree<14, 64>>();
    let rent = ctx
        .rpc
        .get_minimum_balance_for_rent_exemption(size)
        .unwrap();

    let config = config_pda(&ctx.program);
    let (tree_config, _) =
        Pubkey::find_program_address(&[tree.pubkey().as_ref()], &mpl_bubblegum::ID);

    let ixs = vec![
        system_instruction::create_account(
            &ctx.payer.pubkey(),
            &tree.pubkey(),
            rent,
            size as u64,
            &spl_account_compression::ID,
        ),
        Instruction {
            program_id: ctx.program,
            accounts: groundtruth::accounts::CreateCertificateTree {
                payer: ctx.payer.pubkey(),
                config,
                backend_authority: ctx.backend.pubkey(),
                tree_config,
                merkle_tree: tree.pubkey(),
                log_wrapper: groundtruth::SPL_NOOP_ID,
                compression_program: groundtruth::SPL_ACCOUNT_COMPRESSION_ID,
                bubblegum_program: mpl_bubblegum::ID,
                system_program: solana_sdk::system_program::ID,
            }
            .to_account_metas(None),
            data: groundtruth::instruction::CreateCertificateTree {
                max_depth: MAX_DEPTH,
                max_buffer_size: MAX_BUFFER,
            }
            .data(),
        },
    ];

    let bh = ctx.rpc.get_latest_blockhash().unwrap();
    let tx = Transaction::new_signed_with_payer(
        &ixs,
        Some(&ctx.payer.pubkey()),
        &[&ctx.payer, tree, &ctx.backend],
        bh,
    );
    ctx.rpc
        .send_and_confirm_transaction(&tx)
        .expect("create_certificate_tree");
}

fn init_operator(ctx: &Ctx, operador_id: Uuid) -> (Pubkey, Pubkey) {
    let config = config_pda(&ctx.program);
    let (operator, _) =
        Pubkey::find_program_address(&[b"operator", operador_id.as_ref()], &ctx.program);
    let (treasury, _) =
        Pubkey::find_program_address(&[b"treasury", operador_id.as_ref()], &ctx.program);
    let treasury_ata = get_associated_token_address(&treasury, &ctx.usdc_mint);

    let ix = Instruction {
        program_id: ctx.program,
        accounts: groundtruth::accounts::InitOperatorTreasury {
            payer: ctx.payer.pubkey(),
            config,
            operator,
            treasury,
            usdc_mint: ctx.usdc_mint,
            treasury_ata,
            token_program: spl_token::ID,
            associated_token_program: spl_associated_token_account::ID,
            system_program: solana_sdk::system_program::ID,
        }
        .to_account_metas(None),
        data: groundtruth::instruction::InitOperatorTreasury {
            operador_id,
            authority: ctx.payer.pubkey(),
        }
        .data(),
    };
    enviar(ctx, &[ix], &[&ctx.payer]).expect("init_operator_treasury");
    (treasury, treasury_ata)
}

fn register_farm(ctx: &Ctx, operador_id: Uuid, finca_id: Uuid) {
    let config = config_pda(&ctx.program);
    let (operator, _) =
        Pubkey::find_program_address(&[b"operator", operador_id.as_ref()], &ctx.program);
    let (farm, _) = Pubkey::find_program_address(&[b"farm", finca_id.as_ref()], &ctx.program);

    let ix = Instruction {
        program_id: ctx.program,
        accounts: groundtruth::accounts::RegisterFarm {
            payer: ctx.payer.pubkey(),
            config,
            backend_authority: ctx.backend.pubkey(),
            operator,
            farm,
            system_program: solana_sdk::system_program::ID,
        }
        .to_account_metas(None),
        data: groundtruth::instruction::RegisterFarm { finca_id }.data(),
    };
    enviar(ctx, &[ix], &[&ctx.payer, &ctx.backend]).expect("register_farm");
}

fn register_parcel(ctx: &Ctx, finca_id: Uuid, parcela_id: Uuid) {
    let config = config_pda(&ctx.program);
    let (farm, _) = Pubkey::find_program_address(&[b"farm", finca_id.as_ref()], &ctx.program);
    let (parcel, _) =
        Pubkey::find_program_address(&[b"parcel", parcela_id.as_ref()], &ctx.program);

    let ix = Instruction {
        program_id: ctx.program,
        accounts: groundtruth::accounts::RegisterParcel {
            payer: ctx.payer.pubkey(),
            config,
            backend_authority: ctx.backend.pubkey(),
            farm,
            parcel,
            system_program: solana_sdk::system_program::ID,
        }
        .to_account_metas(None),
        data: groundtruth::instruction::RegisterParcel { parcela_id }.data(),
    };
    enviar(ctx, &[ix], &[&ctx.payer, &ctx.backend]).expect("register_parcel");
}

fn ix_certify(
    ctx: &Ctx,
    operador_id: Uuid,
    finca_id: Uuid,
    parcela_id: Uuid,
    ciclo_id: Uuid,
    fee: u64,
    treasury_override: Option<(Pubkey, Pubkey)>,
) -> Instruction {
    let config = config_pda(&ctx.program);
    let (operator, _) =
        Pubkey::find_program_address(&[b"operator", operador_id.as_ref()], &ctx.program);
    let (treasury, treasury_ata) = treasury_override.unwrap_or_else(|| {
        let (t, _) =
            Pubkey::find_program_address(&[b"treasury", operador_id.as_ref()], &ctx.program);
        (t, get_associated_token_address(&t, &ctx.usdc_mint))
    });
    let (farm, _) = Pubkey::find_program_address(&[b"farm", finca_id.as_ref()], &ctx.program);
    let (parcel, _) =
        Pubkey::find_program_address(&[b"parcel", parcela_id.as_ref()], &ctx.program);
    let (certificate_record, _) = Pubkey::find_program_address(
        &[b"cert", parcela_id.as_ref(), ciclo_id.as_ref()],
        &ctx.program,
    );

    let (tree_config, _) =
        Pubkey::find_program_address(&[ctx.merkle_tree.as_ref()], &mpl_bubblegum::ID);

    Instruction {
        program_id: ctx.program,
        accounts: groundtruth::accounts::Certify {
            payer: ctx.payer.pubkey(),
            config,
            backend_authority: ctx.backend.pubkey(),
            operator,
            treasury,
            farm,
            parcel,
            certificate_record,
            usdc_mint: ctx.usdc_mint,
            treasury_ata,
            plataforma_ata: ctx.plataforma_ata,
            tree_config,
            merkle_tree: ctx.merkle_tree,
            log_wrapper: groundtruth::SPL_NOOP_ID,
            compression_program: groundtruth::SPL_ACCOUNT_COMPRESSION_ID,
            bubblegum_program: mpl_bubblegum::ID,
            token_program: spl_token::ID,
            system_program: solana_sdk::system_program::ID,
        }
        .to_account_metas(None),
        data: groundtruth::instruction::Certify {
            args: groundtruth::CertifyArgs {
                parcela_id,
                ciclo_id,
                nombre: "GT-2026-00001".to_string(),
                geojson_uri: "ar://GeoJSONdePruebaParaLaParcela".to_string(),
                hash_pdf: [7u8; 32],
                hash_imagen: [9u8; 32],
                fee,
            },
        }
        .data(),
    }
}

fn ix_manifest(ctx: &Ctx, operador_id: Uuid, embarque_id: Uuid, fee: u64) -> Instruction {
    let config = config_pda(&ctx.program);
    let (operator, _) =
        Pubkey::find_program_address(&[b"operator", operador_id.as_ref()], &ctx.program);
    let (treasury, _) =
        Pubkey::find_program_address(&[b"treasury", operador_id.as_ref()], &ctx.program);
    let treasury_ata = get_associated_token_address(&treasury, &ctx.usdc_mint);

    Instruction {
        program_id: ctx.program,
        accounts: groundtruth::accounts::EmitManifest {
            config,
            backend_authority: ctx.backend.pubkey(),
            operator,
            treasury,
            usdc_mint: ctx.usdc_mint,
            treasury_ata,
            plataforma_ata: ctx.plataforma_ata,
            token_program: spl_token::ID,
        }
        .to_account_metas(None),
        data: groundtruth::instruction::EmitManifest {
            embarque_id,
            geojson_uri: "ar://GeoJSONagregadoDelEmbarque".to_string(),
            fee,
        }
        .data(),
    }
}

type TxResult = Result<(), String>;

fn certify(
    ctx: &Ctx,
    operador_id: Uuid,
    finca_id: Uuid,
    parcela_id: Uuid,
    ciclo_id: Uuid,
    fee: u64,
) -> TxResult {
    let ix = ix_certify(ctx, operador_id, finca_id, parcela_id, ciclo_id, fee, None);
    enviar(ctx, &[ix], &[&ctx.payer, &ctx.backend])
}

/// Intenta certificar una parcela de una unidad debitando la tesorería de OTRA.
fn certify_cruzado(
    ctx: &Ctx,
    operador_id: Uuid,
    finca_id: Uuid,
    parcela_id: Uuid,
    ciclo_id: Uuid,
    fee: u64,
    treasury_ajena: Pubkey,
    ata_ajena: Pubkey,
) -> TxResult {
    let ix = ix_certify(
        ctx,
        operador_id,
        finca_id,
        parcela_id,
        ciclo_id,
        fee,
        Some((treasury_ajena, ata_ajena)),
    );
    enviar(ctx, &[ix], &[&ctx.payer, &ctx.backend])
}

/// Un despacho = UNA transacción con N certify + 1 emit_manifest.
fn despacho_atomico(
    ctx: &Ctx,
    operador_id: Uuid,
    finca_id: Uuid,
    parcela_id: Uuid,
    ciclo_id: Uuid,
    fee_cert: u64,
    fee_manifest: u64,
) -> TxResult {
    let ixs = vec![
        ix_certify(ctx, operador_id, finca_id, parcela_id, ciclo_id, fee_cert, None),
        ix_manifest(ctx, operador_id, uuid(99), fee_manifest),
    ];
    enviar(ctx, &ixs, &[&ctx.payer, &ctx.backend])
}

// ---------- Utilidades RPC ----------

fn enviar(ctx: &Ctx, ixs: &[Instruction], firmantes: &[&Keypair]) -> TxResult {
    let bh = ctx.rpc.get_latest_blockhash().map_err(|e| e.to_string())?;
    // El mint comprimido (CPI a Bubblegum + compresión) no cabe en los 200k CU
    // por defecto; un despacho lleva además varios certify en la misma TX.
    let mut todas = vec![ComputeBudgetInstruction::set_compute_unit_limit(1_200_000)];
    todas.extend_from_slice(ixs);
    let tx = Transaction::new_signed_with_payer(
        &todas,
        Some(&ctx.payer.pubkey()),
        &firmantes.to_vec(),
        bh,
    );
    ctx.rpc
        .send_and_confirm_transaction(&tx)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn airdrop(rpc: &RpcClient, to: &Pubkey, sol: u64) {
    let sig = rpc
        .request_airdrop(to, sol * 1_000_000_000)
        .expect("airdrop");
    loop {
        if rpc.confirm_transaction(&sig).unwrap_or(false) {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(200));
    }
}

fn crear_mint(rpc: &RpcClient, payer: &Keypair) -> Pubkey {
    let mint = Keypair::new();
    let rent = rpc
        .get_minimum_balance_for_rent_exemption(spl_token::state::Mint::LEN)
        .unwrap();
    let ixs = vec![
        system_instruction::create_account(
            &payer.pubkey(),
            &mint.pubkey(),
            rent,
            spl_token::state::Mint::LEN as u64,
            &spl_token::ID,
        ),
        spl_token::instruction::initialize_mint(
            &spl_token::ID,
            &mint.pubkey(),
            &payer.pubkey(),
            None,
            6, // decimales del USDC
        )
        .unwrap(),
    ];
    let bh = rpc.get_latest_blockhash().unwrap();
    let tx = Transaction::new_signed_with_payer(&ixs, Some(&payer.pubkey()), &[payer, &mint], bh);
    rpc.send_and_confirm_transaction(&tx).expect("crear mint");
    mint.pubkey()
}

fn crear_ata(rpc: &RpcClient, payer: &Keypair, mint: &Pubkey, owner: &Pubkey) -> Pubkey {
    let ix = spl_associated_token_account::instruction::create_associated_token_account(
        &payer.pubkey(),
        owner,
        mint,
        &spl_token::ID,
    );
    let bh = rpc.get_latest_blockhash().unwrap();
    let tx = Transaction::new_signed_with_payer(&[ix], Some(&payer.pubkey()), &[payer], bh);
    rpc.send_and_confirm_transaction(&tx).expect("crear ATA");
    get_associated_token_address(owner, mint)
}

fn mint_to(ctx: &Ctx, ata: &Pubkey, cantidad: u64) {
    let ix = spl_token::instruction::mint_to(
        &spl_token::ID,
        &ctx.usdc_mint,
        ata,
        &ctx.payer.pubkey(),
        &[],
        cantidad,
    )
    .unwrap();
    let bh = ctx.rpc.get_latest_blockhash().unwrap();
    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&ctx.payer.pubkey()),
        &[&ctx.payer],
        bh,
    );
    ctx.rpc.send_and_confirm_transaction(&tx).expect("mint_to");
}

/// Lee el `asset_id` del CertificateRecord (offset: 8 disc + 3 UUID de 16 bytes).
fn leer_asset_id(ctx: &Ctx, cert_pda: &Pubkey) -> Pubkey {
    let acc = ctx.rpc.get_account(cert_pda).expect("certificate_record");
    let off = 8 + 16 * 3;
    Pubkey::new_from_array(acc.data[off..off + 32].try_into().unwrap())
}

fn saldo(ctx: &Ctx, ata: &Pubkey) -> u64 {
    let acc = ctx.rpc.get_account(ata).expect("ata");
    spl_token::state::Account::unpack(&acc.data).expect("unpack").amount
}
