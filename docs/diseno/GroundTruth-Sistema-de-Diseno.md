# GroundTruth — Sistema de Diseño y Reglas de Frontend (v1)

> Documento interno. Consolida las decisiones de identidad visual, tipografía, stack de frontend e internacionalización aprobadas. Toda pantalla nueva debe cumplir estas reglas.

---

## 1. Concepto de marca

**"Autoridad de certificación privada":** el registro visual de una casa certificadora europea con herencia — banco privado / casa de subastas — aplicado a la certificación agroclimática. Menos "finca artesanal", más permanencia institucional. La señal de confianza es funcional (hashes verificables, trazabilidad, estados claros), no decorativa.

Fundamento de investigación: las paletas premium usan 2–3 colores núcleo + neutros, saturación profunda y un acento metálico racionado; el verde profundo + oro es el código canónico de valor y permanencia (Rolex, Cartier, Harrods) y coincide naturalmente con un producto agro-ambiental de compliance.

## 2. Paleta (3 núcleo + neutros)

| Token | Nombre | Hex | Uso | Prohibiciones |
| --- | --- | --- | --- | --- |
| `emerald` | Esmeralda | `#0C3C2D` | Color de marca. Superficies primarias, headers, botón primario, estado "conforme" | — |
| `porcelain` | Porcelana | `#F7F5F0` | Fondo claro de la aplicación | No usar cremas amarillentos |
| `gold` | Oro champán | `#C69B3C` | **Solo momentos de certificado** (badge emitido, sello, Nº de certificado, 4º segmento del núcleo) | Nunca en botones normales, navegación ni decoración. Nunca `#FFD700` |
| `ink` | Tinta | `#101312` | Texto principal, superficies oscuras | No negro puro `#000` |
| `sealwax` | Lacre | `#6E1423` | Alertas, revocación, error | Prohibido rojo brillante de semáforo |
| `graphite` | Grafito | `#6B6F6B` | Texto secundario, bordes, metadatos | — |

Tonos de apoyo derivados: `emerald-100 #E7F0EC`, `emerald-300 #9FC4B5`, `gold-900 #5C4310`, `sealwax-100 #F7E8EA`, `porcelain-border #E2DED4`.

**Regla del oro:** si el oro aparece en una pantalla donde no se emitió/muestra un certificado, es un error de diseño.

## 3. Tipografía

| Rol | Fuente | Uso |
| --- | --- | --- |
| Display | **Libre Caslon Text** | Títulos, momentos editoriales, el certificado. Con moderación |
| UI | **Hanken Grotesk** (400/500) | Todo el dashboard, formularios, tablas |
| Datos | **IBM Plex Mono** | Hashes, direcciones PDA, coordenadas, lecturas pH/EC, IDs |

Dos pesos máximo (400/500). Sentence case en toda la UI. Nada de mayúsculas sostenidas salvo eyebrows de 11px con letter-spacing.

## 4. Elemento de firma: el núcleo de suelo

Barra vertical de 4 segmentos (telemetría → satélite → tesorería → certificado). Segmentos en esmeralda; el **cuarto segmento se pinta oro** al emitirse el certificado. Aparece como: indicador de estado por parcela, barra de progreso del saga de certificación, favicon. Es el único elemento decorativo permitido — todo lo demás es contenido.

## 5. Stack de frontend (cerrado)

Vite + React 18 · Tailwind CSS (tokens de este documento) · shadcn/ui · Leaflet + react-leaflet · Recharts · Solana Wallet Adapter · @solana/web3.js + cliente Anchor por IDL · **@phosphor-icons/react** · **Zustand** (estado de UI/sesión) · **Axios** (HTTP hacia NestJS) · **TanStack Query** (cache/invalidación sobre Axios) · Supabase JS (solo Auth, Storage, Realtime) · React Hook Form + Zod.

**Regla de datos:** TanStack Query es la única fuente de datos de servidor; Zustand solo guarda estado efímero de interacción. Prohibido duplicar dato de servidor en Zustand. Supabase JS nunca consulta tablas de negocio directamente (eso es de NestJS): solo Auth, Storage y Realtime.

## 6. Internacionalización (regla de arquitectura)

> **Regla i18n:** ninguna cadena visible al usuario se escribe en el código. Todo texto vive en diccionarios desde el primer commit, con español como idioma por defecto y único diccionario completo del MVP. Agregar un idioma = agregar un archivo; cero cambios de código. Si una pantalla funciona en español, funciona idéntica en cualquier idioma futuro.

Implementación: `react-i18next` + ICU. Diccionarios por namespace (`common`, `dashboard`, `certificates`, `farmer`, `verify`). Claves semánticas (`certificates.status.revoked`), nunca el texto como clave. Fechas/números/moneda vía `Intl`. Layout tolerante a +35% de expansión (alemán). No se traducen: hashes, IDs, PDAs, coordenadas, unidades científicas, contenido del GeoJSON.

**Idiomas:** es (MVP, default) → en (Fase 1) → de, nl, it, fr (Fase 2) → pt (Fase 3). Justificación: operadores LATAM (es); auditores/lingua franca (en); Alemania 34% importación café UE (de); Países Bajos 50% cacao UE (nl); Italia 21% café (it); Francia + instituciones UE + Valonia (fr); Brasil/Portugal (pt).

SEO multi-idioma: rutas con prefijo de locale (`/es/…`, `/en/…`), `hreflang`, metadatos y sitemap por idioma.

## 7. Componente: Modal de progreso de transacción por pasos (`OnchainProgressModal`)

Componente reutilizable para **toda acción con efecto on-chain**. Descompone la operación (saga) en pasos nombrados en lenguaje de negocio y muestra el estado de cada uno en vivo. Sustituye cualquier spinner genérico en operaciones que cruzan servicios o esperan confirmación de red.

### 7.1 Cuándo se usa

| Acción | Rol | Pasos |
| --- | --- | --- |
| Generar certificado de embarque | Operador | 5 (validar química → anclar satélite → subir Arweave → emitir+cobrar → registrar manifiesto) |
| Declarar nueva siembra | Agricultor | 2 (confirmar cierre de ciclo → registrar en cadena) |
| Revocar certificado | Operador / Admin | 2 (registrar revocación → confirmar en cadena) |
| Alta de unidad (crear Treasury) | Admin | 2 (crear Treasury PDA → sembrar administrador) |

Es **un solo componente** parametrizado por una lista de pasos; no se crea una pantalla por acción.

### 7.2 Anatomía

- **Cabecera esmeralda** con el núcleo de suelo (segmentos que se pintan oro conforme avanzan los pasos) + título de la acción + subtítulo con contexto ("Embarque de 3 parcelas · no cierres esta ventana").
- **Lista de pasos**, cada uno con: icono de estado + título (lenguaje de negocio) + subtítulo (dato técnico en `IBM Plex Mono` cuando aplica: hash, monto, tx).
- **Pie** con contador (`paso N de M`), red (`devnet`) y aviso de segundo plano.

### 7.3 Estados por paso

| Estado | Icono | Color |
| --- | --- | --- |
| Pendiente | número en círculo hueco | grafito, opacidad 0.5 |
| Activo | spinner | oro champán (`#C69B3C`) |
| Completado | check en círculo lleno | esmeralda (`#0C3C2D`) |
| Fallido | equis en círculo | lacre (`#6E1423`) + motivo del error + acción de reintento |

### 7.4 Reglas de comportamiento (obligatorias)

1. **No se cierra mientras haya un paso activo:** ni con click fuera, ni con Escape, ni con botón X. Evita que el usuario crea que canceló algo que sigue corriendo on-chain.
2. **Ejecución en segundo plano:** como la saga es asíncrona e idempotente, el usuario puede minimizar/cerrar tras la fase de firma; el proceso continúa y el modal es **recuperable desde el historial** (embarque en estado `PENDIENTE`). El texto "puedes seguir en segundo plano" solo aparece cuando ya es seguro cerrar.
3. **Un paso fallido no borra el progreso:** los pasos completados permanecen en check; el reintento retoma desde el paso fallido (idempotencia por `certificate_id` / `CertificateRecord`). Nunca se ofrece un reintento que pueda duplicar cobro o mint.
4. **Estado final éxito:** todos los pasos en check, el núcleo de suelo completa su 4.º segmento en oro, y se muestran las acciones siguientes (p. ej. "Descargar GeoJSON para TRACES NT" + enlace al explorer).
5. **Estado final error:** el modal permanece abierto con el paso fallido en lacre, su motivo en lenguaje claro, y la acción correctiva (reintentar, o ir a Tesorería si es fondos insuficientes).
6. **Texto vía i18n:** todos los títulos/subtítulos de pasos son claves de diccionario (`certify.step.satellite`, etc.); los datos técnicos (hash, tx, monto) no se traducen.
7. **Accesibilidad:** el modal usa `role="dialog"` con foco atrapado; cada cambio de estado de paso se anuncia por `aria-live="polite"`.

## 8. Sistema ilustrativo y fotografía

**Veredicto sobre ilustración facetada/low-poly: rechazada.** Ese lenguaje comunica "demo de hackathon", no autoridad de certificación — contradice la dirección premium de la sección 1.

**Lenguaje elegido — grabado botánico de línea:** ilustración monocromo de trazo fino (1.8–2px) en tinta esmeralda (`#0C3C2D`) sobre porcelana (`#F7F5F0`), sin relleno de color, inspirada en láminas científicas de agronomía. Coherente con Libre Caslon y con la regla existente de "sin gradientes ni efectos decorativos". **Variante de campo** (DApp lite del agricultor): mismo lenguaje, trazo más grueso, sin detalle fino — prioriza claridad en pantalla pequeña, no es un estilo distinto.

**Fotografía (solo superficies del Visitante):** documental/editorial, luz natural, sin poses de banco de imágenes genérico — nunca "stock corporativo" reconocible.

Especificación completa (inventario de piezas, ubicaciones exactas, dirección fotográfica y notas de producción) en `GroundTruth-Elementos-Graficos-y-Fotografia.md`.
