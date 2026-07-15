# Assets del repositorio

Imágenes **versionadas** que se muestran en los README. No confundir con `design-assets/`
(láminas, iconos y fotografía de origen), que está fuera del control de versiones por peso.

## `cover.png` — portada del README raíz

| | |
| :--- | :--- |
| **Ruta** | `docs/assets/cover.png` |
| **Dimensiones** | **1600 × 500 px** (relación 3.2 : 1) |
| **Formato** | PNG, o WebP si pesa menos |
| **Peso** | **< 400 KB** — se descarga en cada visita al repositorio |

**Por qué 1600 px de ancho:** GitHub renderiza el README en una columna de ~1000 px. Al doble
de resolución la imagen se ve nítida en pantallas retina sin desperdiciar bytes. Más ancho no
mejora nada visible.

**Por qué una franja apaisada y no un cuadrado:** la portada no debe empujar el contenido fuera
de la primera pantalla. Con 3.2 : 1, el título y el índice siguen visibles sin hacer scroll.

> [!TIP]
> El texto que lleve la imagen debe ser **grande y escaso**. GitHub la reescala a ~1000 px de
> ancho, y en móvil a ~400 px: la tipografía fina se vuelve ilegible. Lo que la imagen tenga que
> decir, que lo diga con dos o tres palabras.

> [!IMPORTANT]
> La portada es **decorativa**: el `alt` la describe, pero **ningún dato que importe puede vivir
> solo dentro de ella**. Quien lea el repositorio con un lector de pantalla, con las imágenes
> desactivadas o desde una terminal debe entender el proyecto igual.

### Variante en modo oscuro (opcional)

Si añades `cover-dark.png` (mismas dimensiones), sustituye el `<img>` del README raíz por:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/cover-dark.png">
  <img src="docs/assets/cover.png" alt="GroundTruth — certificación agroclimática EUDR anclada en Solana" width="100%">
</picture>
```

> [!CAUTION]
> No dejes ese `<picture>` puesto **sin** crear `cover-dark.png`. Si el `<source>` apunta a un
> fichero que no existe, el navegador **no vuelve al `<img>`**: muestra una imagen rota. Con una
> sola portada, un `<img>` a secas es lo correcto — se ve bien en ambos temas.

**Paleta de referencia** (del [Sistema de Diseño](../diseno/GroundTruth-Sistema-de-Diseno.md)):
esmeralda `#0F7A5A`, tinta `#111815`, porcelana `#F4F5F2`, grafito `#5C6660`.
