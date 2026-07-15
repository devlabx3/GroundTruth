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

**Vite 6 + React 18** · Tailwind CSS (tokens de este documento) · Leaflet + **react-leaflet ^4.x** · Recharts · **@phosphor-icons/react** · **Zustand** (estado de UI/sesión) · **Axios** (HTTP hacia NestJS) · **TanStack Query** (cache/invalidación sobre Axios) · Supabase JS (solo Auth) · React Hook Form + Zod · **Vitest + Testing Library**.

> **`react-leaflet` debe quedarse en `^4.x`:** la v5 exige React 19 y el stack está cerrado en React 18.

**Regla de datos:** TanStack Query es la única fuente de datos de servidor; Zustand solo guarda estado efímero de interacción. Prohibido duplicar dato de servidor en Zustand. Supabase JS **nunca consulta tablas de negocio** (eso es de NestJS).

### Correcciones respecto a la versión anterior de este documento

| Decía | Realidad |
| --- | --- |
| **shadcn/ui** | **No se usa.** Los componentes (`Button`, `Card`, `Dialog`, `Table`, `Select`…) son **propios**, con la paleta cerrada de la §2. Ventaja concreta: los colores viven en el `variant`, nunca en el `className` — y hay un test que lo vigila, porque un `className` con `bg-`/`text-` ya produjo un **botón invisible** (texto esmeralda sobre fondo esmeralda). |
| **Solana Wallet Adapter** · **@solana/web3.js** · **cliente Anchor por IDL** | **No están en el frontend, y no deben estar.** El frontend **no firma transacciones ni conecta wallets**: toda la interacción con la cadena la hace el backend (que sí usa `@solana/web3.js` y `@coral-xyz/anchor`). El operador deposita USDC **desde su propia wallet, fuera de la aplicación**. Menos superficie de ataque y ninguna llave en el navegador. |
| Supabase JS para **Storage y Realtime** | **Auth** y **Realtime**. El Storage lo maneja el backend (con `service_role`). El Realtime ✅ está implementado, pero **como campana, no como cartero**: el cliente se suscribe, **ignora el payload** del evento y solo invalida su caché para volver a pedir el dato **por NestJS**. La regla se mantiene intacta: **ningún dato de negocio se lee directamente de Postgres**. |

## 6. Internacionalización (regla de arquitectura)

> **Regla i18n:** ninguna cadena visible al usuario se escribe en el código. Todo texto vive en diccionarios desde el primer commit, con español como idioma por defecto y único diccionario completo del MVP. Agregar un idioma = agregar un archivo; cero cambios de código. Si una pantalla funciona en español, funciona idéntica en cualquier idioma futuro.

Implementación: `react-i18next` + ICU. Diccionarios por namespace: **`common`, `dashboard`, `admin`, `farmer`, `public`, `verify`, `errors`**. Claves semánticas (`certificates.status.revoked`), nunca el texto como clave. Fechas/números/moneda vía `Intl`. Layout tolerante a +35% de expansión (alemán). No se traducen: hashes, IDs, PDAs, coordenadas, unidades científicas, contenido del GeoJSON.

**Idiomas: los 7 están completos** (es, en, de, nl, it, fr, pt), no por fases. Justificación de la selección: operadores LATAM (es); auditores/lingua franca (en); Alemania 34% importación café UE (de); Países Bajos 50% cacao UE (nl); Italia 21% café (it); Francia + instituciones UE (fr); Brasil/Portugal (pt).

> **La regla i18n está protegida por tests.** Uno verifica la **paridad exacta de claves** entre los 7 diccionarios; otro verifica que **las interpolaciones `{{n}}` sobrevivan a la traducción** — perder un `{{n}}` deja *"Necesitas sensores"* en vez de *"Necesitas 6 sensores"*. Ambos fallan si alguien rompe la regla.
>
> El namespace **`errors`** es un contrato con el backend: cada `messageKey` que devuelve la API tiene ahí su traducción, y **un test del backend lo verifica** — si alguien renombra una clave, la UI le enseñaría `insufficient_funds` en crudo a un agricultor.

SEO multi-idioma: rutas con prefijo de locale (`/es/…`, `/en/…`), `hreflang`, metadatos y sitemap por idioma.

## 7. Componente: Modal de progreso por pasos (`OnchainProgressModal`)

Componente reutilizable para **toda operación larga que cruza servicios**. Descompone la saga en pasos nombrados en lenguaje de negocio y muestra el estado de cada uno en vivo. Sustituye cualquier spinner genérico.

### 7.1 Cuándo se usa

| Acción | Rol | Pasos | ¿Toca la cadena? |
| --- | --- | --- | --- |
| Generar certificado de embarque | Operador | 5 (validar química → anclar satélite → subir Arweave → emitir+cobrar → registrar manifiesto) | **Sí** |
| Alta de unidad | Admin | 2 (crear la unidad y su sub-rol de dirección → sembrar al administrador) | No |
| Declarar nueva siembra | Agricultor | 2 (cerrar el ciclo anterior → abrir el nuevo) | No |
| Revocar certificado | Operador / Admin | 2 (registrar la revocación → anotar en la auditoría) | No |

> ### ⚠️ Un paso NUNCA puede afirmar algo que no ocurre
>
> La versión anterior de este documento decía que "declarar nueva siembra" y "revocar
> certificado" tenían un paso **"registrar / confirmar en cadena"**. Se implementó así, y **la
> interfaz estaba mintiendo**: ninguna de esas dos acciones toca la cadena, **y no es un
> descuido — es el diseño**. El cNFT es inmutable, así que el estado del certificado vive
> off-chain (Arquitectura §2.3): **la revocación nunca será on-chain.**
>
> Los pasos se renombraron para describir lo que de verdad pasa. Un modal que finge una
> escritura en blockchain destruye exactamente la confianza que este producto vende.
>
> **El alta de unidad tampoco crea la Treasury PDA** (decía que sí): la unidad nace
> `PENDIENTE_ONCHAIN` y su tesorería se crea aparte, con `init_operator_treasury`.

Es **un solo componente** parametrizado por una lista de pasos; no se crea una pantalla por acción.

### 7.2 Anatomía

- **Cabecera esmeralda** con el núcleo de suelo (segmentos que se pintan oro conforme avanzan los pasos) + título de la acción + subtítulo con contexto ("Embarque de 3 parcelas · no cierres esta ventana").
- **Lista de pasos**, cada uno con: icono de estado + título (lenguaje de negocio) + subtítulo (dato técnico en `IBM Plex Mono` cuando aplica: hash, monto, tx).
- **Pie** con contador (`paso N de M`) y aviso de segundo plano. *(La red — `devnet` — no se muestra: pendiente.)*

### 7.3 Estados por paso

| Estado | Icono | Color |
| --- | --- | --- |
| Pendiente | número en círculo hueco | grafito, opacidad 0.5 |
| Activo | spinner | oro champán (`#C69B3C`) |
| Completado | check en círculo lleno | esmeralda (`#0C3C2D`) |
| Fallido | equis en círculo | lacre (`#6E1423`) + motivo del error + acción de reintento |

### 7.4 Reglas de comportamiento (obligatorias)

1. **No se cierra mientras haya un paso activo:** ni con click fuera, ni con Escape, ni con botón X. Evita que el usuario crea que canceló algo que sigue corriendo on-chain.
2. **Ejecución en segundo plano:** como la saga es asíncrona e idempotente, el proceso continúa aunque el usuario cierre. 🔜 **Pendiente:** el modal **todavía no es recuperable** desde la vista del operador (si se cierra a media saga, no hay forma de volver a verlo). Hoy la red de seguridad es el **Admin**, que ve la cola del saga (`FAILED`/`CERT_PENDING`) y puede reintentar. El reintento **reconcilia en vez de duplicar**.
3. **Un paso fallido no borra el progreso:** los pasos completados permanecen en check; el reintento retoma desde el paso fallido (idempotencia por `certificate_id` / `CertificateRecord`). Nunca se ofrece un reintento que pueda duplicar cobro o mint.
4. **Estado final éxito:** todos los pasos en check, el núcleo de suelo completa su 4.º segmento en oro, y se muestran las acciones siguientes (p. ej. "Descargar GeoJSON para TRACES NT" + enlace al explorer).
5. **Estado final error:** el modal permanece abierto con el paso fallido en lacre, su motivo en lenguaje claro, y la acción correctiva (reintentar, o ir a Tesorería si es fondos insuficientes).
6. **Texto vía i18n:** todos los títulos/subtítulos de pasos son claves de diccionario (`certify.step.satellite`, etc.); los datos técnicos (hash, tx, monto) no se traducen.
7. **Accesibilidad:** el modal usa `role="dialog"` con foco atrapado; cada cambio de estado de paso se anuncia por `aria-live="polite"`.

## 8. Sistema ilustrativo y fotografía

**Veredicto sobre ilustración facetada/low-poly: rechazada.** Ese lenguaje comunica "demo de hackathon", no autoridad de certificación — contradice la dirección premium de la sección 1.

**Lenguaje elegido — grabado botánico de línea:** ilustración monocromo de trazo fino (1.8–2px) en tinta esmeralda (`#0C3C2D`) sobre porcelana (`#F7F5F0`), sin relleno de color, inspirada en láminas científicas de agronomía. Coherente con Libre Caslon y con la regla existente de "sin gradientes ni efectos decorativos". **Variante de campo** (DApp lite del agricultor): mismo lenguaje, trazo más grueso, sin detalle fino — prioriza claridad en pantalla pequeña, no es un estilo distinto.

**Fotografía (solo superficies del Visitante):** documental/editorial, luz natural, sin poses de banco de imágenes genérico — nunca "stock corporativo" reconocible.

La especificación completa (inventario de piezas, ubicaciones exactas, dirección fotográfica y notas de producción) **no se versiona**: vive junto al arte fuente, fuera del repo (`../design-assets/`).
