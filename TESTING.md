# Tests

Tres capas, y **cada una se ejecuta donde puede ser fiable**.

| Capa | Qué protege | Dónde corre |
| --- | --- | --- |
| **Unitarios** (`pnpm test`) | Lógica pura y contratos | CI ✔ |
| **Programa Anchor** (`cargo run --bin e2e`) | Las 9 garantías del dinero | Local (necesita validador) |
| **Integración** (`pnpm test:integration`) | Reglas de negocio contra el sistema vivo | Local (necesita BD + cadena) |

## Por qué el CI no lo corre todo

Los tests de integración y el e2e del programa necesitan un Postgres real y un validador
de Solana con Bubblegum clonado de mainnet. Meterlos en CI los haría **intermitentes**, y
**un CI que falla a veces se acaba ignorando** — y un CI ignorado no protege nada. Se lanzan
a propósito, antes de tocar algo delicado.

## Qué se prueba (y por qué ese y no otro)

Los tests no persiguen cobertura: persiguen **los fallos que cuestan dinero o credibilidad**.
Varios existen porque el bug ya ocurrió una vez.

**Backend** (`groundtruth-api`, 38 tests)

- `topologia/geo.spec.ts` — la conversión `[lat,lng]` (Leaflet) → `[lng,lat]` (GeoJSON).
  Invertirla **no da error**: muda la parcela de Honduras al océano Índico.
- `solana/pdas.spec.ts` — las seeds de las PDAs son un contrato con la cadena. Si una cambia,
  **la tesorería de un operador pasa a ser otra cuenta** y su dinero deja de estar donde el
  backend lo busca. El test congela la dirección real verificada contra el validador.
- `common/domain-error.spec.ts` — ata cada `messageKey` del backend con su traducción. Sin
  esto, renombrar una clave le enseña `insufficient_funds` en crudo a un agricultor.

**Frontend** (`groundtruth-web`, 20 tests — Vite 6 + vitest 4)

- `i18n/locales.test.js` — paridad de los 7 diccionarios **y de sus interpolaciones**: perder
  un `{{n}}` al traducir deja *"Necesitas sensores"* en vez de *"Necesitas 6 sensores"*.
- `components/ui/Button.test.jsx` — el bug del **botón invisible** (texto esmeralda sobre
  fondo esmeralda). Los colores son del `variant`, nunca del `className`.
- `lib/api.test.js` — que `ApiError` conserve los `details`: sin ellos, el alta de parcela
  mostraba los sensores que estimaba el navegador (5) en vez de los que exige PostGIS (6).

**Programa Anchor** — cobro real, mint del cNFT, idempotencia sin doble cobro, techo de
tarifa, atomicidad del despacho, reversión total ante fallo, aislamiento entre tesorerías,
fondos insuficientes. Ver `groundtruth-program/README.md`.

## Cómo se comprobó que la red sirve

Una suite que pasa no prueba nada si no **falla cuando debe**. Se verificó saboteando el
código a propósito:

| Sabotaje | Detectado por |
| --- | --- |
| Quitar la inversión lat/lng | `geo.spec.ts` — *expected 14.156 to be -88.03* |
| Cambiar la seed `treasury` | `pdas.spec.ts` — la tesorería apuntaba a otra cuenta |
| Borrar una clave del francés | `locales.test.js` |
| Quitar un `{{n}}` en alemán | `locales.test.js` |

## Ejecutar

```bash
# Unitarios (lo que corre el CI)
cd groundtruth-web  && pnpm lint && pnpm test && pnpm build
cd groundtruth-api  && pnpm typecheck && pnpm test && pnpm build

# Programa Anchor: las 9 garantías (necesita validador — ver su README)
cd groundtruth-program && cargo build-sbf && cd client && cargo run --bin e2e

# Integración: contra el sistema vivo (API + Postgres + Solana en marcha)
cd groundtruth-api
API_URL=http://localhost:3000 \
SUPABASE_URL=... SUPABASE_ANON_KEY=... \
TEST_EMAIL=lucia@sierraverde.coop TEST_PASSWORD=... \
pnpm test:integration
```
