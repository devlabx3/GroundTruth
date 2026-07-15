/**
 * IDL del programa Anchor `groundtruth`, generado por `anchor build`.
 *
 * NO editar a mano: se regenera desde `groundtruth-program/target/`.
 * Va como módulo TypeScript (y no como .json importado) para que el build de Nest
 * no tenga que copiar assets al dist: el IDL viaja dentro del bundle.
 *
 * El JSON que emite Anchor usa snake_case y el tipo que genera usa camelCase (el
 * cliente convierte en tiempo de ejecución). De ahí el doble cast: es el patrón
 * que documenta Anchor, no un parche.
 */
export type Groundtruth = {
  "address": "GQ7rQxCBvpfHMPkApAjQ2TjMxpGMhifK72tpi5ChnzMH",
  "metadata": {
    "name": "groundtruth",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "GroundTruth — Pay-per-Proof: tesorería por operador y certificación EUDR"
  },
  "docs": [
    "GroundTruth — capa on-chain del Pay-per-Proof (Arquitectura §7).",
    "",
    "Qué vive aquí y qué no: on-chain viajan **el valor** (USDC), **las referencias**",
    "(URI de Arweave) y **las huellas** (SHA-256). La telemetría, los umbrales EUDR y",
    "las tarifas son off-chain: este programa **no re-evalúa umbrales**, exige",
    "*autorización* (firma del backend en el MVP; atestación TEE en Fase B).",
    "",
    "**Atomicidad de la certificación:** un despacho de N parcelas se envía como UNA",
    "transacción con N instrucciones `certify` + 1 `emit_manifest`. La atomicidad la da",
    "la transacción de Solana —si cualquiera falla, revierten todas—, así que no hace",
    "falta (ni conviene) meter N certificados en una sola instrucción."
  ],
  "instructions": [
    {
      "name": "certify",
      "docs": [
        "**Certifica una parcela: cobra y deja el registro, de forma indivisible.**",
        "",
        "1. Autorización: firma del backend (Fase B: + atestación TEE).",
        "2. Idempotencia: `CertificateRecord` se crea con `init` sobre la seed",
        "(parcela, ciclo) — si ya existía, la instrucción falla en la creación",
        "de la cuenta y **no hay segundo cobro ni segundo mint**.",
        "3. Débito de `fee` micro-USDC desde el ATA de la tesorería (signer seeds).",
        "4. Mint del cNFT vía CPI a Bubblegum — **pendiente**: hasta cablearlo,",
        "`asset_id` queda en `Pubkey::default()`. El cobro y el registro ya son",
        "reales; el certificado comprimido es el siguiente paso."
      ],
      "discriminator": [
        242,
        131,
        34,
        239,
        225,
        117,
        92,
        27
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "backendAuthority",
          "docs": [
            "Autorización del MVP (F5): la keypair custodial del backend."
          ],
          "signer": true
        },
        {
          "name": "operator",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  112,
                  101,
                  114,
                  97,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "operator.operador_id",
                "account": "operator"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "operator.operador_id",
                "account": "operator"
              }
            ]
          }
        },
        {
          "name": "farm",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  97,
                  114,
                  109
                ]
              },
              {
                "kind": "account",
                "path": "farm.finca_id",
                "account": "farm"
              }
            ]
          }
        },
        {
          "name": "parcel",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  114,
                  99,
                  101,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "args.parcela_id"
              }
            ]
          }
        },
        {
          "name": "certificateRecord",
          "docs": [
            "Idempotencia: si ya existe para (parcela, ciclo), `init` falla y revierte todo."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  101,
                  114,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "args.parcela_id"
              },
              {
                "kind": "arg",
                "path": "args.ciclo_id"
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "treasuryAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasury"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "plataformaAta",
          "docs": [
            "Cuenta de ingresos de la plataforma (destino del cobro)."
          ],
          "writable": true
        },
        {
          "name": "treeConfig",
          "writable": true
        },
        {
          "name": "merkleTree",
          "writable": true
        },
        {
          "name": "logWrapper",
          "address": "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"
        },
        {
          "name": "compressionProgram",
          "address": "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"
        },
        {
          "name": "bubblegumProgram",
          "address": "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "certifyArgs"
            }
          }
        }
      ]
    },
    {
      "name": "createCertificateTree",
      "docs": [
        "Crea el árbol Merkle donde vivirán los certificados comprimidos.",
        "",
        "El *tree creator* es la PDA `Config`, no una wallet: así **solo este programa**",
        "puede mintear certificados en él. Una keypair comprometida no basta para",
        "acuñar un certificado — tiene que pasar por `certify`, con sus reglas.",
        "",
        "La cuenta del árbol la asigna el cliente (tamaño según profundidad/buffer);",
        "aquí se le da su `TreeConfig` vía CPI a Bubblegum."
      ],
      "discriminator": [
        191,
        210,
        2,
        67,
        74,
        194,
        77,
        148
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "backendAuthority",
          "signer": true
        },
        {
          "name": "treeConfig",
          "writable": true
        },
        {
          "name": "merkleTree",
          "writable": true
        },
        {
          "name": "logWrapper",
          "address": "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"
        },
        {
          "name": "compressionProgram",
          "address": "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"
        },
        {
          "name": "bubblegumProgram",
          "address": "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "maxDepth",
          "type": "u32"
        },
        {
          "name": "maxBufferSize",
          "type": "u32"
        }
      ]
    },
    {
      "name": "emitManifest",
      "docs": [
        "Cobra la micro-tarifa de manifiesto y ancla el URI del GeoJSON agregado.",
        "",
        "Se ejecuta en **cada** despacho, incluso si reutiliza el 100 % de los cNFTs",
        "vigentes: es lo que hace que un embarque \"gratis\" no exista."
      ],
      "discriminator": [
        39,
        242,
        26,
        38,
        249,
        253,
        123,
        84
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "backendAuthority",
          "signer": true
        },
        {
          "name": "operator",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  112,
                  101,
                  114,
                  97,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "operator.operador_id",
                "account": "operator"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "operator.operador_id",
                "account": "operator"
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "treasuryAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasury"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "plataformaAta",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "embarqueId",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "geojsonUri",
          "type": "string"
        },
        {
          "name": "fee",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initConfig",
      "docs": [
        "Configuración global. La firma el admin de la plataforma, una sola vez."
      ],
      "discriminator": [
        23,
        235,
        115,
        232,
        168,
        96,
        1,
        231
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "backendAuthority",
          "type": "pubkey"
        },
        {
          "name": "maxCertFee",
          "type": "u64"
        },
        {
          "name": "maxManifestFee",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initOperatorTreasury",
      "docs": [
        "Crea la unidad y su tesorería (Operator + Treasury PDA + ATA de USDC).",
        "",
        "La dirección del ATA es determinística por unidad: eso es lo que permite al",
        "webhook de Helius atribuir cada depósito **por cuenta destino, sin memo** (§7.4)."
      ],
      "discriminator": [
        208,
        15,
        109,
        223,
        136,
        151,
        171,
        48
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "operator",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  112,
                  101,
                  114,
                  97,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "operadorId"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "operadorId"
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "treasuryAta",
          "docs": [
            "ATA de la tesorería: la dirección pública a la que la unidad deposita USDC."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasury"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "operadorId",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "authority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "registerFarm",
      "discriminator": [
        183,
        52,
        200,
        186,
        245,
        91,
        216,
        246
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "backendAuthority",
          "docs": [
            "Solo el backend registra identidades (el frontend nunca firma esto)."
          ],
          "signer": true
        },
        {
          "name": "operator",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  112,
                  101,
                  114,
                  97,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "operator.operador_id",
                "account": "operator"
              }
            ]
          }
        },
        {
          "name": "farm",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  97,
                  114,
                  109
                ]
              },
              {
                "kind": "arg",
                "path": "fincaId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "fincaId",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        }
      ]
    },
    {
      "name": "registerParcel",
      "discriminator": [
        170,
        232,
        221,
        44,
        109,
        149,
        104,
        207
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "backendAuthority",
          "signer": true
        },
        {
          "name": "farm",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  97,
                  114,
                  109
                ]
              },
              {
                "kind": "account",
                "path": "farm.finca_id",
                "account": "farm"
              }
            ]
          }
        },
        {
          "name": "parcel",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  114,
                  99,
                  101,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "parcelaId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "parcelaId",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        }
      ]
    },
    {
      "name": "setOperatorActive",
      "docs": [
        "Suspende o reactiva una unidad on-chain (espejo de la suspensión del Admin)."
      ],
      "discriminator": [
        153,
        135,
        58,
        208,
        49,
        84,
        121,
        132
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "operator",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  112,
                  101,
                  114,
                  97,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "operator.operador_id",
                "account": "operator"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "active",
          "type": "bool"
        }
      ]
    },
    {
      "name": "updateConfig",
      "docs": [
        "Ajusta el firmante del backend y los techos de cobro (rotación de llaves, F5)."
      ],
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "backendAuthority",
          "type": "pubkey"
        },
        {
          "name": "maxCertFee",
          "type": "u64"
        },
        {
          "name": "maxManifestFee",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "certificateRecord",
      "discriminator": [
        250,
        87,
        4,
        127,
        86,
        3,
        52,
        240
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "farm",
      "discriminator": [
        161,
        156,
        211,
        253,
        250,
        64,
        53,
        250
      ]
    },
    {
      "name": "operator",
      "discriminator": [
        219,
        31,
        188,
        145,
        69,
        139,
        204,
        117
      ]
    },
    {
      "name": "parcel",
      "discriminator": [
        149,
        167,
        245,
        67,
        209,
        244,
        214,
        75
      ]
    },
    {
      "name": "treasury",
      "discriminator": [
        238,
        239,
        123,
        238,
        89,
        1,
        168,
        253
      ]
    }
  ],
  "events": [
    {
      "name": "certificateIssued",
      "discriminator": [
        62,
        59,
        26,
        207,
        181,
        234,
        201,
        52
      ]
    },
    {
      "name": "certificateTreeCreated",
      "discriminator": [
        160,
        65,
        178,
        155,
        79,
        114,
        54,
        34
      ]
    },
    {
      "name": "manifestEmitted",
      "discriminator": [
        238,
        223,
        127,
        31,
        215,
        41,
        72,
        86
      ]
    },
    {
      "name": "treasuryInitialized",
      "discriminator": [
        199,
        73,
        174,
        205,
        59,
        145,
        55,
        179
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "operatorInactive",
      "msg": "La unidad está suspendida on-chain: no puede certificar."
    },
    {
      "code": 6001,
      "name": "feeExceedsCap",
      "msg": "La tarifa supera el techo configurado en el programa."
    },
    {
      "code": 6002,
      "name": "insufficientFunds",
      "msg": "Fondos insuficientes en la tesorería de la unidad."
    },
    {
      "code": 6003,
      "name": "parcelFarmMismatch",
      "msg": "La parcela no pertenece a la finca indicada."
    },
    {
      "code": 6004,
      "name": "farmOperatorMismatch",
      "msg": "La finca no pertenece a la unidad que despacha."
    },
    {
      "code": 6005,
      "name": "attestationRequired",
      "msg": "Se requiere atestación TEE (Fase B) y no se aportó."
    },
    {
      "code": 6006,
      "name": "uriTooLong",
      "msg": "El URI del GeoJSON excede el tamaño máximo."
    }
  ],
  "types": [
    {
      "name": "certificateIssued",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "parcelaId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "cicloId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "operadorId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "assetId",
            "type": "pubkey"
          },
          {
            "name": "geojsonUri",
            "type": "string"
          },
          {
            "name": "hashPdf",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "hashImagen",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "feePagada",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "certificateRecord",
      "docs": [
        "Idempotencia on-chain del certificado — PDA `[\"cert\", parcela_id, ciclo_id]`.",
        "",
        "La identidad del certificado es el par (parcela, ciclo de siembra). Como la",
        "cuenta se crea con `init`, un segundo `certify` para el mismo par **falla en",
        "la creación de la cuenta**: la propia cadena impide el doble cobro y el doble",
        "mint, sin que el programa tenga que comprobar nada."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "parcelaId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "cicloId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "operadorId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "assetId",
            "docs": [
              "Asset ID del cNFT (Bubblegum). Queda en `Pubkey::default()` hasta que se",
              "cablee el mint comprimido: el registro y el cobro ya son reales."
            ],
            "type": "pubkey"
          },
          {
            "name": "geojsonUri",
            "docs": [
              "URI del GeoJSON de la parcela en Arweave (lo jurídicamente vinculante)."
            ],
            "type": "string"
          },
          {
            "name": "hashPdf",
            "docs": [
              "Huellas SHA-256 de los archivos pesados, que nunca viajan on-chain."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "hashImagen",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "feePagada",
            "docs": [
              "Micro-USDC efectivamente cobrados por este certificado."
            ],
            "type": "u64"
          },
          {
            "name": "emitidoEn",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "certificateTreeCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "merkleTree",
            "type": "pubkey"
          },
          {
            "name": "maxDepth",
            "type": "u32"
          },
          {
            "name": "maxBufferSize",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "certifyArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "parcelaId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "cicloId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "nombre",
            "docs": [
              "Nombre del cNFT: el número público del certificado (`GT-AAAA-NNNNN`)."
            ],
            "type": "string"
          },
          {
            "name": "geojsonUri",
            "type": "string"
          },
          {
            "name": "hashPdf",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "hashImagen",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "fee",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "config",
      "docs": [
        "Configuración global del programa (una sola, PDA `[\"config\"]`)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "docs": [
              "Puede reconfigurar el programa (multisig/KMS en producción)."
            ],
            "type": "pubkey"
          },
          {
            "name": "backendAuthority",
            "docs": [
              "Firmante custodial del backend (F5): lo único que autoriza `certify` y",
              "`emit_manifest` en el MVP. En Fase B se le suma la atestación TEE."
            ],
            "type": "pubkey"
          },
          {
            "name": "usdcMint",
            "docs": [
              "Mint de USDC (devnet en el MVP)."
            ],
            "type": "pubkey"
          },
          {
            "name": "maxCertFee",
            "docs": [
              "Techos de cobro, en micro-USDC.",
              "",
              "Las tarifas son un parámetro OFF-CHAIN (las edita el Admin y viajan como",
              "argumento firmado por el backend). Sin un techo on-chain, una keypair de",
              "backend comprometida podría vaciar una tesorería en una sola llamada;",
              "con él, el daño queda acotado por transacción. No contradice el diseño:",
              "la tarifa sigue siendo configurable, solo que acotada."
            ],
            "type": "u64"
          },
          {
            "name": "maxManifestFee",
            "type": "u64"
          },
          {
            "name": "attestationRequired",
            "docs": [
              "Gate de atestación Switchboard (Fase B). En el MVP va en `false`:",
              "presente como interruptor, no como reescritura futura."
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "farm",
      "docs": [
        "Gemelo digital de la finca — PDA `[\"farm\", finca_id]`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "fincaId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "operadorId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "manifestEmitted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "embarqueId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "operadorId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "geojsonUri",
            "type": "string"
          },
          {
            "name": "feePagada",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "operator",
      "docs": [
        "Identidad de la unidad de negocio — PDA `[\"operator\", operador_id]`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "operadorId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "authority",
            "docs": [
              "Wallet de la unidad (informativa en el MVP: no firma nada todavía)."
            ],
            "type": "pubkey"
          },
          {
            "name": "active",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "parcel",
      "docs": [
        "Identidad de la parcela — PDA `[\"parcel\", parcela_id]`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "parcelaId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "fincaId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "treasury",
      "docs": [
        "Authority de la tesorería — PDA `[\"treasury\", operador_id]`.",
        "",
        "No custodia los USDC: los tokens viven en su **ATA**, y esta PDA es su owner.",
        "Solo el programa puede firmar débitos (signer seeds) → aislamiento total:",
        "ninguna unidad puede gastar el USDC de otra."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "operadorId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "totalDebitado",
            "docs": [
              "Espejo acumulado de lo cobrado (auditoría barata; la verdad es el ATA)."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "treasuryInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "operadorId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "ata",
            "type": "pubkey"
          }
        ]
      }
    }
  ]
};

const RAW = {
  "address": "GQ7rQxCBvpfHMPkApAjQ2TjMxpGMhifK72tpi5ChnzMH",
  "metadata": {
    "name": "groundtruth",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "GroundTruth — Pay-per-Proof: tesorería por operador y certificación EUDR"
  },
  "docs": [
    "GroundTruth — capa on-chain del Pay-per-Proof (Arquitectura §7).",
    "",
    "Qué vive aquí y qué no: on-chain viajan **el valor** (USDC), **las referencias**",
    "(URI de Arweave) y **las huellas** (SHA-256). La telemetría, los umbrales EUDR y",
    "las tarifas son off-chain: este programa **no re-evalúa umbrales**, exige",
    "*autorización* (firma del backend en el MVP; atestación TEE en Fase B).",
    "",
    "**Atomicidad de la certificación:** un despacho de N parcelas se envía como UNA",
    "transacción con N instrucciones `certify` + 1 `emit_manifest`. La atomicidad la da",
    "la transacción de Solana —si cualquiera falla, revierten todas—, así que no hace",
    "falta (ni conviene) meter N certificados en una sola instrucción."
  ],
  "instructions": [
    {
      "name": "certify",
      "docs": [
        "**Certifica una parcela: cobra y deja el registro, de forma indivisible.**",
        "",
        "1. Autorización: firma del backend (Fase B: + atestación TEE).",
        "2. Idempotencia: `CertificateRecord` se crea con `init` sobre la seed",
        "(parcela, ciclo) — si ya existía, la instrucción falla en la creación",
        "de la cuenta y **no hay segundo cobro ni segundo mint**.",
        "3. Débito de `fee` micro-USDC desde el ATA de la tesorería (signer seeds).",
        "4. Mint del cNFT vía CPI a Bubblegum — **pendiente**: hasta cablearlo,",
        "`asset_id` queda en `Pubkey::default()`. El cobro y el registro ya son",
        "reales; el certificado comprimido es el siguiente paso."
      ],
      "discriminator": [
        242,
        131,
        34,
        239,
        225,
        117,
        92,
        27
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "backend_authority",
          "docs": [
            "Autorización del MVP (F5): la keypair custodial del backend."
          ],
          "signer": true
        },
        {
          "name": "operator",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  112,
                  101,
                  114,
                  97,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "operator.operador_id",
                "account": "Operator"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "operator.operador_id",
                "account": "Operator"
              }
            ]
          }
        },
        {
          "name": "farm",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  97,
                  114,
                  109
                ]
              },
              {
                "kind": "account",
                "path": "farm.finca_id",
                "account": "Farm"
              }
            ]
          }
        },
        {
          "name": "parcel",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  114,
                  99,
                  101,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "args.parcela_id"
              }
            ]
          }
        },
        {
          "name": "certificate_record",
          "docs": [
            "Idempotencia: si ya existe para (parcela, ciclo), `init` falla y revierte todo."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  101,
                  114,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "args.parcela_id"
              },
              {
                "kind": "arg",
                "path": "args.ciclo_id"
              }
            ]
          }
        },
        {
          "name": "usdc_mint"
        },
        {
          "name": "treasury_ata",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasury"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdc_mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "plataforma_ata",
          "docs": [
            "Cuenta de ingresos de la plataforma (destino del cobro)."
          ],
          "writable": true
        },
        {
          "name": "tree_config",
          "writable": true
        },
        {
          "name": "merkle_tree",
          "writable": true
        },
        {
          "name": "log_wrapper",
          "address": "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"
        },
        {
          "name": "compression_program",
          "address": "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"
        },
        {
          "name": "bubblegum_program",
          "address": "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"
        },
        {
          "name": "token_program"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "CertifyArgs"
            }
          }
        }
      ]
    },
    {
      "name": "create_certificate_tree",
      "docs": [
        "Crea el árbol Merkle donde vivirán los certificados comprimidos.",
        "",
        "El *tree creator* es la PDA `Config`, no una wallet: así **solo este programa**",
        "puede mintear certificados en él. Una keypair comprometida no basta para",
        "acuñar un certificado — tiene que pasar por `certify`, con sus reglas.",
        "",
        "La cuenta del árbol la asigna el cliente (tamaño según profundidad/buffer);",
        "aquí se le da su `TreeConfig` vía CPI a Bubblegum."
      ],
      "discriminator": [
        191,
        210,
        2,
        67,
        74,
        194,
        77,
        148
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "backend_authority",
          "signer": true
        },
        {
          "name": "tree_config",
          "writable": true
        },
        {
          "name": "merkle_tree",
          "writable": true
        },
        {
          "name": "log_wrapper",
          "address": "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"
        },
        {
          "name": "compression_program",
          "address": "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"
        },
        {
          "name": "bubblegum_program",
          "address": "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "max_depth",
          "type": "u32"
        },
        {
          "name": "max_buffer_size",
          "type": "u32"
        }
      ]
    },
    {
      "name": "emit_manifest",
      "docs": [
        "Cobra la micro-tarifa de manifiesto y ancla el URI del GeoJSON agregado.",
        "",
        "Se ejecuta en **cada** despacho, incluso si reutiliza el 100 % de los cNFTs",
        "vigentes: es lo que hace que un embarque \"gratis\" no exista."
      ],
      "discriminator": [
        39,
        242,
        26,
        38,
        249,
        253,
        123,
        84
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "backend_authority",
          "signer": true
        },
        {
          "name": "operator",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  112,
                  101,
                  114,
                  97,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "operator.operador_id",
                "account": "Operator"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "operator.operador_id",
                "account": "Operator"
              }
            ]
          }
        },
        {
          "name": "usdc_mint"
        },
        {
          "name": "treasury_ata",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasury"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdc_mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "plataforma_ata",
          "writable": true
        },
        {
          "name": "token_program"
        }
      ],
      "args": [
        {
          "name": "embarque_id",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "geojson_uri",
          "type": "string"
        },
        {
          "name": "fee",
          "type": "u64"
        }
      ]
    },
    {
      "name": "init_config",
      "docs": [
        "Configuración global. La firma el admin de la plataforma, una sola vez."
      ],
      "discriminator": [
        23,
        235,
        115,
        232,
        168,
        96,
        1,
        231
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "usdc_mint"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "backend_authority",
          "type": "pubkey"
        },
        {
          "name": "max_cert_fee",
          "type": "u64"
        },
        {
          "name": "max_manifest_fee",
          "type": "u64"
        }
      ]
    },
    {
      "name": "init_operator_treasury",
      "docs": [
        "Crea la unidad y su tesorería (Operator + Treasury PDA + ATA de USDC).",
        "",
        "La dirección del ATA es determinística por unidad: eso es lo que permite al",
        "webhook de Helius atribuir cada depósito **por cuenta destino, sin memo** (§7.4)."
      ],
      "discriminator": [
        208,
        15,
        109,
        223,
        136,
        151,
        171,
        48
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "operator",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  112,
                  101,
                  114,
                  97,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "operador_id"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "operador_id"
              }
            ]
          }
        },
        {
          "name": "usdc_mint"
        },
        {
          "name": "treasury_ata",
          "docs": [
            "ATA de la tesorería: la dirección pública a la que la unidad deposita USDC."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasury"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdc_mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "token_program"
        },
        {
          "name": "associated_token_program",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "operador_id",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "authority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "register_farm",
      "discriminator": [
        183,
        52,
        200,
        186,
        245,
        91,
        216,
        246
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "backend_authority",
          "docs": [
            "Solo el backend registra identidades (el frontend nunca firma esto)."
          ],
          "signer": true
        },
        {
          "name": "operator",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  112,
                  101,
                  114,
                  97,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "operator.operador_id",
                "account": "Operator"
              }
            ]
          }
        },
        {
          "name": "farm",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  97,
                  114,
                  109
                ]
              },
              {
                "kind": "arg",
                "path": "finca_id"
              }
            ]
          }
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "finca_id",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        }
      ]
    },
    {
      "name": "register_parcel",
      "discriminator": [
        170,
        232,
        221,
        44,
        109,
        149,
        104,
        207
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "backend_authority",
          "signer": true
        },
        {
          "name": "farm",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  97,
                  114,
                  109
                ]
              },
              {
                "kind": "account",
                "path": "farm.finca_id",
                "account": "Farm"
              }
            ]
          }
        },
        {
          "name": "parcel",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  114,
                  99,
                  101,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "parcela_id"
              }
            ]
          }
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "parcela_id",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        }
      ]
    },
    {
      "name": "set_operator_active",
      "docs": [
        "Suspende o reactiva una unidad on-chain (espejo de la suspensión del Admin)."
      ],
      "discriminator": [
        153,
        135,
        58,
        208,
        49,
        84,
        121,
        132
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "operator",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  112,
                  101,
                  114,
                  97,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "operator.operador_id",
                "account": "Operator"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "active",
          "type": "bool"
        }
      ]
    },
    {
      "name": "update_config",
      "docs": [
        "Ajusta el firmante del backend y los techos de cobro (rotación de llaves, F5)."
      ],
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "backend_authority",
          "type": "pubkey"
        },
        {
          "name": "max_cert_fee",
          "type": "u64"
        },
        {
          "name": "max_manifest_fee",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "CertificateRecord",
      "discriminator": [
        250,
        87,
        4,
        127,
        86,
        3,
        52,
        240
      ]
    },
    {
      "name": "Config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "Farm",
      "discriminator": [
        161,
        156,
        211,
        253,
        250,
        64,
        53,
        250
      ]
    },
    {
      "name": "Operator",
      "discriminator": [
        219,
        31,
        188,
        145,
        69,
        139,
        204,
        117
      ]
    },
    {
      "name": "Parcel",
      "discriminator": [
        149,
        167,
        245,
        67,
        209,
        244,
        214,
        75
      ]
    },
    {
      "name": "Treasury",
      "discriminator": [
        238,
        239,
        123,
        238,
        89,
        1,
        168,
        253
      ]
    }
  ],
  "events": [
    {
      "name": "CertificateIssued",
      "discriminator": [
        62,
        59,
        26,
        207,
        181,
        234,
        201,
        52
      ]
    },
    {
      "name": "CertificateTreeCreated",
      "discriminator": [
        160,
        65,
        178,
        155,
        79,
        114,
        54,
        34
      ]
    },
    {
      "name": "ManifestEmitted",
      "discriminator": [
        238,
        223,
        127,
        31,
        215,
        41,
        72,
        86
      ]
    },
    {
      "name": "TreasuryInitialized",
      "discriminator": [
        199,
        73,
        174,
        205,
        59,
        145,
        55,
        179
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "OperatorInactive",
      "msg": "La unidad está suspendida on-chain: no puede certificar."
    },
    {
      "code": 6001,
      "name": "FeeExceedsCap",
      "msg": "La tarifa supera el techo configurado en el programa."
    },
    {
      "code": 6002,
      "name": "InsufficientFunds",
      "msg": "Fondos insuficientes en la tesorería de la unidad."
    },
    {
      "code": 6003,
      "name": "ParcelFarmMismatch",
      "msg": "La parcela no pertenece a la finca indicada."
    },
    {
      "code": 6004,
      "name": "FarmOperatorMismatch",
      "msg": "La finca no pertenece a la unidad que despacha."
    },
    {
      "code": 6005,
      "name": "AttestationRequired",
      "msg": "Se requiere atestación TEE (Fase B) y no se aportó."
    },
    {
      "code": 6006,
      "name": "UriTooLong",
      "msg": "El URI del GeoJSON excede el tamaño máximo."
    }
  ],
  "types": [
    {
      "name": "CertificateIssued",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "parcela_id",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "ciclo_id",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "operador_id",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "asset_id",
            "type": "pubkey"
          },
          {
            "name": "geojson_uri",
            "type": "string"
          },
          {
            "name": "hash_pdf",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "hash_imagen",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "fee_pagada",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "CertificateRecord",
      "docs": [
        "Idempotencia on-chain del certificado — PDA `[\"cert\", parcela_id, ciclo_id]`.",
        "",
        "La identidad del certificado es el par (parcela, ciclo de siembra). Como la",
        "cuenta se crea con `init`, un segundo `certify` para el mismo par **falla en",
        "la creación de la cuenta**: la propia cadena impide el doble cobro y el doble",
        "mint, sin que el programa tenga que comprobar nada."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "parcela_id",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "ciclo_id",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "operador_id",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "asset_id",
            "docs": [
              "Asset ID del cNFT (Bubblegum). Queda en `Pubkey::default()` hasta que se",
              "cablee el mint comprimido: el registro y el cobro ya son reales."
            ],
            "type": "pubkey"
          },
          {
            "name": "geojson_uri",
            "docs": [
              "URI del GeoJSON de la parcela en Arweave (lo jurídicamente vinculante)."
            ],
            "type": "string"
          },
          {
            "name": "hash_pdf",
            "docs": [
              "Huellas SHA-256 de los archivos pesados, que nunca viajan on-chain."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "hash_imagen",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "fee_pagada",
            "docs": [
              "Micro-USDC efectivamente cobrados por este certificado."
            ],
            "type": "u64"
          },
          {
            "name": "emitido_en",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "CertificateTreeCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "merkle_tree",
            "type": "pubkey"
          },
          {
            "name": "max_depth",
            "type": "u32"
          },
          {
            "name": "max_buffer_size",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "CertifyArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "parcela_id",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "ciclo_id",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "nombre",
            "docs": [
              "Nombre del cNFT: el número público del certificado (`GT-AAAA-NNNNN`)."
            ],
            "type": "string"
          },
          {
            "name": "geojson_uri",
            "type": "string"
          },
          {
            "name": "hash_pdf",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "hash_imagen",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "fee",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "Config",
      "docs": [
        "Configuración global del programa (una sola, PDA `[\"config\"]`)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "docs": [
              "Puede reconfigurar el programa (multisig/KMS en producción)."
            ],
            "type": "pubkey"
          },
          {
            "name": "backend_authority",
            "docs": [
              "Firmante custodial del backend (F5): lo único que autoriza `certify` y",
              "`emit_manifest` en el MVP. En Fase B se le suma la atestación TEE."
            ],
            "type": "pubkey"
          },
          {
            "name": "usdc_mint",
            "docs": [
              "Mint de USDC (devnet en el MVP)."
            ],
            "type": "pubkey"
          },
          {
            "name": "max_cert_fee",
            "docs": [
              "Techos de cobro, en micro-USDC.",
              "",
              "Las tarifas son un parámetro OFF-CHAIN (las edita el Admin y viajan como",
              "argumento firmado por el backend). Sin un techo on-chain, una keypair de",
              "backend comprometida podría vaciar una tesorería en una sola llamada;",
              "con él, el daño queda acotado por transacción. No contradice el diseño:",
              "la tarifa sigue siendo configurable, solo que acotada."
            ],
            "type": "u64"
          },
          {
            "name": "max_manifest_fee",
            "type": "u64"
          },
          {
            "name": "attestation_required",
            "docs": [
              "Gate de atestación Switchboard (Fase B). En el MVP va en `false`:",
              "presente como interruptor, no como reescritura futura."
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "Farm",
      "docs": [
        "Gemelo digital de la finca — PDA `[\"farm\", finca_id]`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "finca_id",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "operador_id",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "ManifestEmitted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "embarque_id",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "operador_id",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "geojson_uri",
            "type": "string"
          },
          {
            "name": "fee_pagada",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "Operator",
      "docs": [
        "Identidad de la unidad de negocio — PDA `[\"operator\", operador_id]`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "operador_id",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "authority",
            "docs": [
              "Wallet de la unidad (informativa en el MVP: no firma nada todavía)."
            ],
            "type": "pubkey"
          },
          {
            "name": "active",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "Parcel",
      "docs": [
        "Identidad de la parcela — PDA `[\"parcel\", parcela_id]`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "parcela_id",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "finca_id",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "Treasury",
      "docs": [
        "Authority de la tesorería — PDA `[\"treasury\", operador_id]`.",
        "",
        "No custodia los USDC: los tokens viven en su **ATA**, y esta PDA es su owner.",
        "Solo el programa puede firmar débitos (signer seeds) → aislamiento total:",
        "ninguna unidad puede gastar el USDC de otra."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "operador_id",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "total_debitado",
            "docs": [
              "Espejo acumulado de lo cobrado (auditoría barata; la verdad es el ATA)."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "TreasuryInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "operador_id",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "ata",
            "type": "pubkey"
          }
        ]
      }
    }
  ]
};

export const IDL = RAW as unknown as Groundtruth;
