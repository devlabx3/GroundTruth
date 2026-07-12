# Anexo 3 — Delimitación on-chain / off-chain

```mermaid
graph TB
    subgraph ONCHAIN["ON-CHAIN - Solana"]
        C1[Treasury PDA + USDC por operador]
        C2[Transaccion Pay-per-Proof: debito + mint atomicos]
        C3[cNFT Certificado EUDR con: URI del GeoJSON + hash del PDF + hash de la imagen satelital]
    end

    subgraph ARWEAVE["STORAGE PERMANENTE - Arweave"]
        B1[GeoJSON de parcela - hashes embebidos]
        B2[GeoJSON agregado del embarque - entregable TRACES NT]
    end

    subgraph SUPASTORE["STORAGE ECONOMICO - Supabase Storage"]
        S1[PDF del certificado]
        S2[Copia de la imagen satelital + metadatos de reproducibilidad]
    end

    subgraph OFFCHAIN["OFF-CHAIN - NestJS + Supabase"]
        A1[Telemetria IoT: pH, EC, humedad, temperatura]
        A2[Topologia: operador - finca - parcela - ciclo de siembra]
        A3[Estados del certificado y manifiestos de embarque]
        A4[Reglas de negocio: sensores, umbrales, tarifas]
    end

    OFFCHAIN -->|Genera y sube| ARWEAVE
    OFFCHAIN -->|Guarda archivos pesados| SUPASTORE
    SUPASTORE -.->|Solo sus hashes| ONCHAIN
    ARWEAVE -.->|Solo su URI| ONCHAIN
```

**Principio:** los archivos pesados nunca van on-chain ni a Arweave. On-chain solo viajan el valor (USDC), las referencias (URI) y las huellas criptográficas (hashes SHA-256). El GeoJSON —liviano y jurídicamente vinculante— es lo único que va a storage permanente.
