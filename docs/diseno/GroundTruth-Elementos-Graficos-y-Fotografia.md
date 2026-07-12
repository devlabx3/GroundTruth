# GroundTruth — Elementos Gráficos y Fotografía (v1)

> Responde a: ¿es aceptable el estilo low-poly (referencia: fases ilustradas de AgroFactoring) dado el perfil de cliente de GroundTruth? Define la alternativa elegida, dónde tiene significancia visual, y especifica cada pieza (tipo, estilo, descripción, propósito) para ilustración y fotografía. Se apoya en `GroundTruth-Sistema-de-Diseno.md` y en `GroundTruth-Indice-de-Vistas-y-Navegacion.md` (cada ubicación referenciada existe ya en el índice de vistas).

---

## 0. Veredicto: low-poly

**No, para las superficies premium (Visitante, Operador, Admin).** El low-poly es el lenguaje visual por defecto de landings de hackathon y demos de MVP genérico — es, para efectos de percepción de marca, el mismo problema que ya corregimos al descartar la primera paleta ("muy genérico, asociado a IA"). Ninguna referencia de la investigación de marca premium (Rolex, Cartier, Harrods, banca privada) usa ilustración facetada 3D; ese lenguaje comunica producto nuevo y demostrativo, no autoridad de certificación. Para exportadores, auditores y compradores institucionales sería retroceder justo lo que se corrigió.

**Lo que sí se valida del referente:** la idea de apoyar pasos/fases con una representación gráfica **sí mejora la comprensión** — ya lo aplicamos en `OnchainProgressModal`. Lo que cambia es el estilo, no el principio.

**Alternativa elegida — grabado botánico de línea:** ilustración monocromo de trazo fino en tinta esmeralda (`#0C3C2D`) sobre porcelana (`#F7F5F0`), inspirada en las láminas científicas de manuales de agronomía del s. XIX. Razones: (1) es el lenguaje visual histórico de la ciencia del suelo — coincide con el concepto de marca "Ground Truth"; (2) convive sin fricción con Libre Caslon; (3) es monocromo y sin relleno de color, cumple la regla de "sin gradientes ni efectos decorativos" ya vigente; (4) funciona igual de bien en 24px que en tamaño hero, a diferencia del low-poly.

**Variante de campo (DApp lite del agricultor):** mismo lenguaje, trazo más grueso y sin detalle fino — prioriza claridad a un vistazo sobre ornamento, porque el contexto de uso es un teléfono en campo, no una demo. **Es el mismo sistema, no un estilo distinto** — la marca no se fragmenta entre roles.

---

## 1. Iconografía de línea — inventario de piezas

Todas en tinta esmeralda sobre porcelana (o transparente), trazo 1.8–2px, sin relleno de color, esquinas redondeadas. Ver especímenes 01–06 en la lámina generada en el chat.

| # | Objeto | Descripción del trazo | Dónde se usa | Rol / vista (índice de navegación) |
| --- | --- | --- | --- | --- |
| 01 | Sonda de suelo | Línea vertical con cabeza circular (sensor) y raíces en abanico en la base | Explicación de prueba química; estado "sin sensores" | Landing → `HowItWorksSection`; Operador → empty state de `topologia` |
| 02 | Evidencia satelital | Órbita elíptica con planeta y satélite | Explicación de prueba visual | Landing → `HowItWorksSection` |
| 03 | Sello de certificado | Doble círculo concéntrico con marcas radiales (fluteado) y check inscrito | Momento de certificado emitido | `OnchainProgressModal` (estado de éxito); Operador → detalle de certificado |
| 04 | Nueva siembra | Tallo con dos hojas y línea de suelo | Confirmar declaración de siembra | Agricultor → `ConfirmDialog` de nueva siembra (variante trazo grueso) |
| 05 | Manifiesto de embarque | Contenedor con corrugación y asa | Empty state / éxito de embarque | Operador → empty state de `embarques`; éxito del saga de certificación |
| 06 | Certificado verificado | Escudo con check inscrito | Resultado de verificación pública | Visitante → `CertificateVerifyCard` (estado "vigente") |

### 1.1 Piezas adicionales necesarias (mismo lenguaje, no cubiertas por los 6 especímenes)

| Objeto | Descripción | Dónde | Rol / vista |
| --- | --- | --- | --- |
| Parcela vacía | Polígono punteado sobre terreno con signo "+" | Empty state "sin parcelas" | Operador → `topologia` |
| Alerta en calma | Hoja con check pequeño, sin urgencia visual | Empty state "sin alertas" | Agricultor → `AlertList`; Operador → panel de alertas |
| Documento no coincide | Documento con signo de interrogación o grieta sutil (sin dramatismo, coherente con lacre) | Resultado de verificación con hash no coincidente | Visitante → `HashCompareRow` (estado de alerta) |
| Búsqueda sin resultado | Lupa sobre una hoja | Certificado no encontrado | Visitante → `/verificar/:certId` (404) |
| Equipo / sub-roles | Círculos enlazados (nodos de una red simple) | Módulo de equipo | Operador → `equipo` |
| Vínculo agricultor–finca | Dos formas (persona simple + parcela) unidas por una línea | Alta/edición de vínculo | Operador → `agricultores` |

**Prioridad de producción:** los 6 especímenes + "parcela vacía" y "alerta en calma" son necesarios para el MVP (aparecen en el flujo principal de certificación). El resto puede producirse en la siguiente iteración.

---

## 2. Diagramas explicativos (no son íconos sueltos, son secuencias)

| Pieza | Descripción | Dónde | Prioridad |
| --- | --- | --- | --- |
| Secuencia "cómo funciona" | Los especímenes 01→02→03 en fila, unidos por una línea fina punteada, cada uno con una frase corta debajo | Landing → `HowItWorksSection` | MVP |
| Corte de horizontes de suelo | Ilustración de un perfil de suelo por capas (bosque nativo vs. monocultivo, lado a lado) con pH indicado en cada capa | Landing → sección de propuesta de valor ("prueba química") | MVP |
| Diagrama de las dos pruebas | Composición de la sonda de suelo (01) junto a la órbita satelital (02), unidas por una llave que converge en el sello (03) | Landing → sección "prueba híbrida" | MVP |
| Mapa de trazabilidad | Ilustración lineal simplificada: finca → parcela → certificado → contenedor → TRACES NT | Landing (opcional, sección de confianza) o material comercial | Futuro |

---

## 3. Fotografía — solo Visitante

La fotografía **no reemplaza** la iconografía; cubre lo que la línea no puede: el terreno real, la escala, la confianza documental. Dirección: **fotografía documental/editorial**, no "lifestyle" de banco de imágenes — luz natural, sin poses artificiales, coherente con lo que la investigación de B2B mostró (los compradores detectan el stock genérico y eso resta confianza). Ver referencia buscada en el chat (niebla real, topografía real de zona cafetera).

| # | Escena | Dirección de estilo | Dónde | Propósito |
| --- | --- | --- | --- | --- |
| P1 | Terreno en niebla de altura (cafetal o cacaotal andino, vista aérea/dron) | Documental, tonos apagados, sin filtro saturado | Landing → `Hero` | Establece "Ground Truth" de forma literal desde el primer segundo |
| P2 | Sonda/sensor real insertado en tierra, plano cercano | Documental, foco en la textura del suelo y el dispositivo | Landing → sección de confianza / `ValuePropSection` | Ancla la "prueba física" en un objeto real, no abstracto |
| P3 | Manos de un agricultor o agrónomo trabajando en campo (rostro opcional, con respeto y sin poses de stock) | Documental, luz natural | Landing → sección de confianza | Humaniza sin caer en fotografía genérica de "granjero sonriente" |
| P4 | Imagen satelital real o estilizada de una parcela (puede ser una captura real de Sentinel Hub con licencia adecuada) | Editorial, alto contraste, monocromo o con overlay del polígono certificado | Landing → sección "prueba híbrida" (a la par de P1/P2) | Contrapunto visual entre "vista ciega" (satélite) y "verdad en tierra" |
| P5 | Puerto o contenedor de exportación (si se decide mostrar la fase de despacho) | Documental, industrial pero no frío | Futuro — sección de "cómo llega a Europa" | Cierra el recorrido hasta TRACES NT |

**Nota de derechos:** ninguna imagen de este listado debe salir de un banco de stock genérico reconocible (esas son las que la investigación B2B marca como perjudiciales para la confianza) ni de una búsqueda sin licencia clara para uso comercial. Las opciones reales son: (a) sesión fotográfica propia en una finca piloto — la más fuerte para credibilidad y la recomendada si hay presupuesto; (b) banco de fotografía documental con licencia comercial, filtrando explícitamente por estilo editorial, no "stock corporativo"; (c) para P4, solicitar a Sentinel Hub/Copernicus una imagen de muestra bajo su licencia de atribución.

---

## 4. Producción — limitación honesta

Este documento especifica **qué** producir y **con qué criterio de estilo**, pero no genera las piezas finales: este entorno no tiene una herramienta de generación de imágenes conectada, y la fotografía documental requiere una sesión real o un banco con licencia — no algo que deba fabricarse sintéticamente si la meta es credibilidad ante auditores. Próximos pasos posibles:

1. **Iconografía de línea (sección 1–2):** son piezas vectoriales simples; se pueden producir con un ilustrador (unas horas de trabajo, ya que el estilo está completamente especificado) o generarse con una herramienta de imagen/vector con este documento como brief.
2. **Fotografía (sección 3):** requiere decisión de presupuesto — sesión propia vs. banco con licencia. Recomiendo sesión propia al menos para P1 y P2 si el objetivo es una plataforma que se presenta ante la Comisión Europea: la autenticidad ahí es literalmente el argumento de venta del producto.

---

## 5. Regla de consistencia

Ninguna pieza gráfica nueva se agrega sin: (a) pertenecer a una de las dos familias definidas (línea esmeralda / fotografía documental — nunca una tercera), (b) tener una ubicación real en `GroundTruth-Indice-de-Vistas-y-Navegacion.md`, y (c) justificar qué comprensión añade que el texto solo no daría. Si una pantalla "se ve vacía" sin ilustración, la primera pregunta es si necesita un estado vacío bien redactado antes que una imagen nueva.

---

## 6. Producción con Gemini — prompts y estado final

Validado en producción (jul 2026): una sola receta de prompt **no** sirve para ambas escalas. Se usaron dos familias.

### 6.1 Familia editorial (grande, textura de papel — se usa CON su marco, sin quitar fondo)

```
A single scientific engraving illustration of [OBJETO], in the style of a 19th-century botanical or natural history plate — fine, precise copperplate linework with delicate cross-hatching for shading and depth, aged paper texture with deckled edges. Monochrome ink illustration in deep emerald-green ink on cream paper background. Composition: centered like a museum specimen plate, ornamental border optional. No text or lettering. High resolution, portrait orientation.
```

### 6.2 Familia ícono (pequeña, fondo plano — transparencia por script)

```
A minimalist single-line icon illustration of [OBJETO], in the spirit of a refined engraving but radically simplified — a single uniform-weight ink line, no hatching, no shading, no gradients, no texture, no ornamental border, no aged paper effect. Only the essential silhouette and a few defining internal lines. Ink color: deep emerald green (approx hex 0C3C2D). Background: flat, completely uniform, solid pale off-white (approx hex F7F5F0). Composition: object centered, designed to stay legible at sizes as small as 24 pixels. No text, no lettering, no shadow. Square format.
```

Lecciones de iteración: (a) sin un número máximo explícito de líneas, el contenedor salió como código de barras — la corrección fue "exactly 4 evenly spaced vertical ridge lines / 5 wide flat panels"; (b) la variante isométrica (caja 3D con etiqueta) se descartó por romper la consistencia 2D del set; (c) el estilo se produce con marca de agua en la esquina inferior derecha, que el script recorta.

### 6.3 Estado de producción — TODO EL SET MVP PRODUCIDO ✅

**Íconos** (`/outputs/iconos/`, PNG con transparencia real, recortados al contenido):

| Archivo | Especimen |
| --- | --- |
| `icono_nueva_siembra.png` | 04 · brote con línea de suelo |
| `icono_sonda_de_suelo.png` | 01 · instrumento vertical |
| `icono_evidencia_satelital.png` | 02 · satélite en órbita |
| `icono_sello_certificado.png` | 03 · doble anillo + check (ecoa el sello editorial) |
| `icono_certificado_verificado.png` | 06 · escudo + check |
| `icono_manifiesto_embarque.png` | 05 · contenedor de 5 paneles |

Procesados con `iconos/remove_bg.py` (remoción de fondo por color muestreado + recorte de watermark + filtro de componentes conectados <8% + crop con padding 6%). Nota de uso: proporciones dispares a propósito — contener en viewBox cuadrado con `object-fit: contain`. Para producción final a 24px se recomienda retrazar a vector usando estos PNG como referencia de forma.

**Láminas editoriales** (`/outputs/ilustraciones/`, se usan completas, con su papel):

| Archivo | Uso (índice de navegación) |
| --- | --- |
| `lamina_sonda_de_suelo.png` | Landing → sección "prueba química" |
| `lamina_sello_certificado.png` | Momento certificado emitido / cabecera PDF (con marco + cinta) |
| `lamina_sello_certificado_sin_marco.png` | Variante contenida, layouts donde el marco sobra |
| `lamina_evidencia_satelital.png` | Landing → "evidencia satelital" (fondo oscuro, recomendada) |
| `lamina_evidencia_satelital_clara.png` | Alterna fondo claro |
| `lamina_corte_horizontes_suelo.png` | Landing → "prueba híbrida" (bosque nativo vs. monocultivo) |

**Pendiente (no bloquea desarrollo):** fotografía documental del Visitante (P1–P5, §3) — decisión de presupuesto sesión propia vs. banco con licencia.
