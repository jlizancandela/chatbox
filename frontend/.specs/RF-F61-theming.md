# RF-F61 — Theming del chatbox

> Estructura del template `to-spec` adaptada a la convención del proyecto (`.specs/` por RF, decisiones de proceso en `../docs/decisions/`).
>
> Spec confirmado el 2026-10-17 tras sesión de `grill-with-docs`. Cambios respecto al borrador inicial: US #7 reescrita a lectura (a), L2 honra `data-theme` en ancestros (antes se rechazaba), `forced-colors: active` y `prefers-contrast: more` entran en scope (antes fuera), target sube a WCAG 2.x AAA, layout de archivos a `src/components/Chatbox.css` (antes `src/components/chatbox/chatbox.css`), glosario renombrado.
>
> Revisión 2026-10-17 (sesión de T2, issue #58): ratios recalculados con WCAG 2.x y corregidos; el target AAA se acota a **texto de cuerpo** (los tokens cromáticos del tema claro se quedan en AA); el orden de las capas de tema pasa a assertearse estructuralmente; el widget consume `text` y `surface`; el label del botón usa `--chatbox-color-surface`; y la verificación de valores resueltos se traslada al ticket T5 (navegador real).

## Síntesis de la entrevista (decisiones acordadas, 2026-10-17)

- **L0 — Superficie pública**: 7 tokens semánticos `--chatbox-color-*` (text, surface, primary, link, border, focus, error). Lista cerrada. Burbujas user/assistant mismo color (sin `surface-elevated`). Estados de link reusan `--chatbox-color-link` (sin `link-hover`/`link-visited`). Sin `text-muted`, `success`, `warning` ni "on-primary" dedicado.
- **L1 — Scoping**: defaults declarados dentro de `.chatbox` (no en `:root`), self-contained, override por cascada desde cualquier ancestro. US #7 reescrita: "los defaults del chatbox son razonables y se ven neutros; alinear con la marca del sitio es opt-in vía mapping explícito de los 7 tokens en la hoja del host". Scope raíz único: `.chatbox`.
- **L2 — Estrategia de tema**: el widget honra `data-theme="dark"` y `data-theme="light"` cuando un ancestro del subtree del widget lo declara. Sin `data-theme`, cae a `@media (prefers-color-scheme: dark)` para los defaults oscuros. `data-theme` gana sobre `prefers-color-scheme` por especificidad. `forced-colors: active` y `prefers-contrast: more` entran en scope.
- **L3 — Paleta y conformidad**: las dos tablas del borrador se confirman **en hex**. Target: **WCAG 2.x AAA (≥7:1) para texto de cuerpo** (`--chatbox-color-text`) y **AA (≥4.5:1) para texto cromático** (`link`, `primary`, `focus`, `error`); `--chatbox-color-border` cumple AA non-text 1.4.11 (≥3:1). Ratios recalculados el 2026-10-17: texto light 15.9:1, dark 10.8:1; `link`/`primary`/`focus` 5.98:1 en light y 7.84:1 en dark; `error` 6.47:1 light y 9.17:1 dark; `border` 4.83:1 light y 3.60:1 dark. Los tokens cromáticos del tema claro **no** alcanzan 7:1 con los hex acordados; subirlos exigiría reabrir la paleta de T1, así que el spec declara el target real en vez de un AAA global que no se cumple.
- **L4 — Layout de archivos**: CSS del chatbox en `src/components/Chatbox.css` (nuevo, colocalizado con `Chatbox.tsx`). `src/style.css` mínimo (solo reset de Vite, sin reglas `.chatbox`). Migración del bloque `.chatbox a` desde `src/style.css` al nuevo `Chatbox.css` con `var(--chatbox-color-link)`. `src/index.tsx` sin cambios; `src/components/Chatbox.tsx` añade `import './Chatbox.css'`.
- **L5 — Glosario**: "Heredado del sitio" renombrado a "Override por cascada". Se añaden "Sitio host" y "Self-contained". Glosario dentro del spec; sin `GLOSSARY.md` raíz.
  - **Revocado 2026-10-18 (RF-F62)**: esta decisión se revierte por indicación de Jorge. El glosario vive ahora en `GLOSSARY.md` en la raíz del repositorio, como ya anticipaba `docs/agents/domain.md`, y los términos de este spec se han trasladado allí. Motivo: el vocabulario dejó de ser de un solo RF.
- **L6 — Aislamiento de estilos globales (2026-10-20)**: el widget no depende de ningún estilo global. `src/style.css` solo contiene reglas de la página demo bajo `#app` (sin `:root`, `body`, `section`, `img` ni `.resource`). Todo estilo del chat vive en `src/components/Chatbox.css` con selectores que empiezan por `.chatbox`; la raíz declara tipografía (pila del sistema, `line-height`), `display`, `height: 100%` y `margin: 0`. El reset se acota a `.chatbox` (`box-sizing`, `font: inherit` en `textarea` y `button`, márgenes de `h1`/`p`/`ol`). El foco visible usa `--chatbox-color-focus` con `:focus-visible`. `prefers-reduced-motion` anula transiciones y animaciones dentro de `.chatbox`. El textarea usa `font-size: 1rem` para evitar el zoom de iOS. La altura del widget la fija el host; la demo la da con `#app { height: 100dvh }`. Verificación: `test/unit/chatbox-scoped-styles.test.ts` (guardia estructural con casos negativos) y `test/browser/scoped-styles.spec.ts` (computados iguales con y sin la hoja del host).

## Problem Statement

El widget de chatbox se incrusta en un sitio host (Astro en MVP) y hoy no expone contrato de tema. La paleta vive en `src/style.css` mezclada con los estilos por defecto de Vite, los enlaces tienen colores hardcodeados (`#005fcc` / `#66b3ff`), y no hay defaults propios del chatbox. Un sitio que quiere alinear el widget con su marca tiene que patchear el archivo o pisar todo a mano. Además, los requisitos RF-F31 (enlaces contrastantes) y RF-F42 (contraste 4.5:1 / 3:1) están parcialmente implementados con valores fijos, lo que dificulta auditarlos y cambiarlos.

## Solution

El chatbox expone un contrato de tema mínimo basado en 7 tokens semánticos CSS: `--chatbox-color-text`, `--chatbox-color-surface`, `--chatbox-color-primary`, `--chatbox-color-link`, `--chatbox-color-border`, `--chatbox-color-focus`, `--chatbox-color-error`. Los defaults se declaran dentro de `.chatbox` para que el widget sea self-contained; el sitio host los pisa por cascada desde cualquier ancestro. El tema oscuro se activa con `@media (prefers-color-scheme: dark)` y, además, el widget honra `data-theme` en ancestros del subtree para sincronizarse con toggles del host. `forced-colors: active` y `prefers-contrast: more` adaptan el widget a las preferencias de accesibilidad del sistema. Los defaults de ambos temas pasan WCAG 2.x AAA para **texto de cuerpo** (≥7:1), AA (≥4.5:1) para texto cromático (enlaces, acciones, error) y AA non-text (3:1) para componentes y foco. Los enlaces y los acentos usan los tokens en vez de hex hardcodeados (RF-F31, RF-F61).

## User Stories

1. Como visitante del sitio host, quiero que el chatbox se vea coherente con el resto de la página, para que no parezca un widget de otro sitio.
2. Como visitante con el sistema en modo oscuro, quiero que el chatbox siga esa preferencia, para no forzar la vista.
3. Como autor del sitio host, quiero override del tema del chatbox con variables CSS en mi hoja, para alinear el widget con mi marca sin tocar el código del chatbox.
4. Como autor del sitio host, quiero override de un solo token sin tocar los demás, para ajustes puntuales (p. ej. un color de error distinto).
5. Como usuario de teclado, quiero indicadores de foco visibles, para saber dónde estoy navegando.
6. Como visitante con baja visión, quiero texto con al menos 7:1 de contraste (WCAG 2.x AAA), para leer sin esforzar la vista.
7. Como autor del sitio host, quiero que los defaults del chatbox sean razonables y se vean neutros; alinear con la marca de mi sitio es opt-in vía mapping explícito de los 7 tokens en mi hoja.
8. Como autor del sitio host con un toggle manual de tema, quiero sincronizar el chatbox propagando `data-theme` al subtree del widget, sin escribir CSS adicional.
9. Como usuario con Windows High Contrast Mode (u otra preferencia de colores forzados del sistema), quiero que el chatbox use los colores del sistema, para que el widget no se vea roto ni ilegible.
10. Como usuario con `prefers-contrast: more` activo, quiero que el chatbox suba el contraste de sus tokens, para alinear con el resto del sistema.
11. Como autor del chatbox, quiero defaults razonables ya incluidos, para que el widget se vea bien sin configuración.
12. Como autor del chatbox, quiero que los estilos del componente vivan en un archivo propio, para no contaminar el global.
13. Como mantenedor del proyecto, quiero que el contrato de tema esté documentado y testeado, para evitar regresiones.

## Implementation Decisions

### Contrato de tokens (público)

7 tokens semánticos, todos con prefijo `--chatbox-color-`:

- `--chatbox-color-text` — texto principal sobre la superficie.
- `--chatbox-color-surface` — fondo del chatbox y de las burbujas (user y assistant comparten este color).
- `--chatbox-color-primary` — acción principal (botón Enviar/Detener).
- `--chatbox-color-link` — enlaces markdown (RF-F30) y enlace de contacto (RF-F60). Reusado para default, hover y visited.
- `--chatbox-color-border` — separadores y bordes de input/textarea.
- `--chatbox-color-focus` — anillo de foco (RF-F40). Aplica a componentes interactivos.
- `--chatbox-color-error` — estado de error y borde de mensaje fallido (RF-F14, §7).

### Defaults y scoping

- Defaults declarados en `.chatbox { ... }`. El chatbox no escribe en `:root`. Self-contained.
- Override por cascada: el host pisa los tokens en cualquier ancestro (`body`, `main`, contenedor del chatbox) y la cascada los lleva al widget. Si el host quiere alinear con su sistema propio, mapea en su hoja:

```css
body {
  --chatbox-color-primary: var(--color-brand);
  --chatbox-color-text: var(--color-fg);
  /* los 7 */
}
```

- El host que solo quiere sincronizar el tema con su propio toggle **no necesita mapping**: propaga `data-theme` al subtree del widget (ver siguiente sección).

### Tema oscuro y sincronía con el host

- `@media (prefers-color-scheme: dark) .chatbox { ... }` para los defaults oscuros cuando el sistema está en oscuro.
- El widget **honra `data-theme` en ancestros del subtree**. Si el host declara `data-theme="dark"` (o `"light"`) en `<html>`, `<body>` o en el contenedor del chatbox, el widget lo sigue sin mapping de variables. Esto permite que un sitio con toggle de tema sincronice el widget propagando el atributo a su contenedor.
- **Precedencia, de menor a mayor**:

  1. Defaults en `.chatbox` (tema claro).
  2. `@media (prefers-color-scheme: dark) .chatbox` (tema oscuro del sistema).
  3. `[data-theme="dark"] .chatbox` y `[data-theme="light"] .chatbox` (override explícito del host por ancestro).
  4. `@media (forced-colors: active) .chatbox` (system-color keywords del navegador, gana siempre en modo forzado).

- Sin ruta manual propia: el widget no expone `data-theme` propio, no tiene toggle, no escribe clases en su raíz. La SPEC dice "por defecto" y se respeta: si el host no fuerza nada, el widget se comporta según el sistema.

### Accesibilidad del sistema

- `@media (forced-colors: active) { .chatbox { ... } }` con `system-color` keywords (`Canvas`, `CanvasText`, `LinkText`, `Highlight`, `ButtonText`, `ButtonFace`, `GrayText`). Garantiza que el widget se vea legible en Windows High Contrast Mode y en cualquier agente de usuario que fuerce colores del sistema.
- `@media (prefers-contrast: more) { .chatbox { ... } }` con overrides de los 7 tokens para subir contraste cuando el usuario lo solicita sin forzar colores del sistema.

### Paleta por defecto

**Tema claro (sobre `#ffffff`):**

| Token | Valor | Ratio vs surface |
|---|---|---|
| `--chatbox-color-text` | `#222` | 15.9:1 |
| `--chatbox-color-surface` | `#ffffff` | — |
| `--chatbox-color-primary` | `#005fcc` | 5.98:1 |
| `--chatbox-color-link` | `#005fcc` | 5.98:1 |
| `--chatbox-color-border` | `#6b7280` (gray-500) | 4.83:1 |
| `--chatbox-color-focus` | `#005fcc` | 5.98:1 |
| `--chatbox-color-error` | `#b91c1c` (red-700) | 6.47:1 |

**Tema oscuro (sobre `#1a1a1a`):**

| Token | Valor | Ratio vs surface |
|---|---|---|
| `--chatbox-color-text` | `#ccc` | 10.8:1 |
| `--chatbox-color-surface` | `#1a1a1a` | — |
| `--chatbox-color-primary` | `#66b3ff` | 7.84:1 |
| `--chatbox-color-link` | `#66b3ff` | 7.84:1 |
| `--chatbox-color-border` | `#6b7280` (gray-500) | 3.60:1 |
| `--chatbox-color-focus` | `#66b3ff` | 7.84:1 |
| `--chatbox-color-error` | `#fca5a5` (red-300) | 9.17:1 |

Notas:

- `text` y `surface` reusan los valores actuales para no romper visualmente.
- `primary` y `link` comparten hex a propósito: el botón Enviar y los enlaces markdown tiran del mismo azul (RF-F31 ya lo hace así). El label del botón reusa `--chatbox-color-surface` como tinta: blanco en light (5.98:1) y `#1a1a1a` en dark (7.84:1). No se añade un 8º token `on-primary`; un blanco fijo fallaría en dark (2.22:1 sobre `#66b3ff`).
- `border` se queda en gray-500 en ambos temas: 4.83:1 en light y 3.60:1 en dark, cumple AA 1.4.11 non-text (3:1). WCAG no tiene AAA non-text separado, así que este token no baja el target. Si más adelante se necesita un separador más sutil, se introduce un token extra, no se relaja este.
- `error` usa red-700 en claro (6.47:1, AA) y red-300 en oscuro (9.17:1, AAA). Los tokens cromáticos del tema claro se quedan en AA por decisión de T2 (ver L3).
- Ratios calculados con WCAG 2.x. Si se prefiere WCAG 3 (APCA), recalibrar antes de tocar la paleta.

### Layout de archivos

- Estilos del chatbox migran a `src/components/Chatbox.css` (nuevo, colocalizado con `Chatbox.tsx`). Consistente con `frontend/AGENTS.md` ("`components/` reservado al entry point").
- `src/style.css` se queda mínimo (reset de Vite para `body`/`#app`). Se elimina el bloque `.chatbox a` (migrado a `Chatbox.css`).
- `src/index.tsx` sigue importando `./style.css` sin cambios. `src/components/Chatbox.tsx` añade `import './Chatbox.css'`. `src/chat/components/AssistantMarkdown.tsx` y `src/chat/components/ExternalLink.tsx` no importan CSS: heredan por cascada de `.chatbox a`.

### Cambios en código

- `src/components/Chatbox.tsx`: añade `import './Chatbox.css'`. El resto del componente no cambia: los tokens se aplican vía clases `.chatbox__*` ya presentes.
- `src/components/Chatbox.css`: defaults en `.chatbox`, que además **consume** los tokens con `color: var(--chatbox-color-text)` y `background-color: var(--chatbox-color-surface)`; `@media (prefers-color-scheme: dark)` que redeclara los 7 tokens oscuros; selectores `[data-theme="dark"] .chatbox` y `[data-theme="light"] .chatbox` (T3, con precedencia sobre la media query); `@media (forced-colors: active)` y `@media (prefers-contrast: more)` (T4); el bloque `.chatbox a` migrado con `var(--chatbox-color-link)`; y el label del submit con `var(--chatbox-color-surface)`.
- `src/style.css`: el bloque `.chatbox a` se elimina. Se queda solo el reset de Vite.
- `src/components/ExternalLink.tsx`: sin cambios (estilizado por `.chatbox a`).
- `src/chat/components/AssistantMarkdown.tsx`: sin cambios (los enlaces heredan color de `.chatbox a`).
- `src/index.tsx`: sin cambios.

## Testing Decisions

### Test seam

Renderizar `<Chatbox>` con `@testing-library/preact` y comprobar el **mecanismo** (la hoja importada está en `document.styleSheets` con las reglas esperadas, y el computed de las propiedades es el `var()` crudo). Es el seam más alto disponible en jsdom; la **resolución** de los valores se verifica en navegador real en #62. Complementado con un test unitario que parsea `Chatbox.css` con `postcss` y assertea los 7 tokens en cada tema (regresión de valores).

### Tests unitarios (`test/unit/`)

- `Chatbox.css` estructural con `postcss`: `.chatbox` declara exactamente los 7 tokens claros y los consume con `var()`; el bloque dentro de `@media (prefers-color-scheme: dark)` declara exactamente los 7 tokens oscuros (hex exactos, sin `color` ni `background-color`), y su `offset` es mayor que el del bloque base. Los selectores `[data-theme]` (T3) y `forced-colors` (T4) extienden el mismo test. Regresión de paleta y de precedencia.
- Contraste (umbrales WCAG 2.x sobre los tokens parseados): texto de cuerpo ≥7:1; `link`/`primary`/`focus`/`error` ≥4.5:1; `border` ≥3:1; label del botón ≥4.5:1, en ambos temas. Sin números mágicos de ratio: los hex ya están asserteados aparte.
- Override: aplicar `style="--chatbox-color-primary: red"` a un ancestro del `<Chatbox>` y verificar que la custom property llega al ancestro y que la regla del botón sigue declarando `var(--chatbox-color-primary)`. La resolución real a `red` se verifica en navegador en #62.
- Precedencia `data-theme` sobre `prefers-color-scheme` (T3): assertear estructuralmente la presencia y el orden posterior a la media query de los selectores `[data-theme]`; la resolución real de la precedencia se verifica en navegador en #62.
- Prior art: la estructura sigue los tests existentes para `sse.ts` y `trimHistory` en `test/unit/` (Vitest).

### Tests de componente (`test/component/`)

En jsdom, `getComputedStyle` devuelve `var(--chatbox-color-*)` sin resolver y **no evalúa `@media`**: verificado el 2026-10-17, con `matchMedia('(prefers-color-scheme: dark)')` devolviendo `true` el computed sigue mostrando el valor del bloque base. Por eso aquí se assertea el **mecanismo** (la hoja importada por `Chatbox.tsx` está en `document.styleSheets`, contiene las reglas esperadas y los valores crudos de las propiedades). Los valores resueltos se verifican en navegador real en el ticket T5.

- Light mode: `.chatbox` computa `color: var(--chatbox-color-text)` y `background-color: var(--chatbox-color-surface)` (crudo) y las reglas base declaran los 7 tokens claros.
- Dark mode: `document.styleSheets` contiene una `CSSMediaRule` con `(prefers-color-scheme: dark)` y dentro una regla `.chatbox` con los 7 tokens oscuros; sin evaluación de la cascada.
- Override del host: aplicar CSS externo que pise `--chatbox-color-link` y verificar que la custom property llega al ancestro y la regla sigue declarando `var()`.
- Sincronía con `data-theme`: assertear la presencia y el orden posterior a la media query de los selectores `[data-theme="dark"] .chatbox` / `[data-theme="light"] .chatbox` (T3).
- `forced-colors`: assertear la estructura del bloque y el uso de keywords de sistema (T4).
- Contraste: cubierto por el unit test de umbrales; axe-core y resolución real pertenecen a T5.
- Prior art: tests de `@testing-library/preact` en `test/component/` para Enter/Shift+Enter, Enviar↔Detener, estado vacío.

### Lo que NO se testea

- Implementación interna (especificidad exacta, shorthand `background` vs `background-color`). El **orden de las capas de tema sí se assertea estructuralmente** en el test unitario: es el mecanismo del que depende la precedencia y jsdom no puede ejercitar la cascada.
- Defaults del navegador (`:focus-visible`, scrollbars, etc.).
- Cascada más allá de un nivel (es responsabilidad del host).
- El contenido textual de los mensajes.

## Out of Scope

- Tokens de spacing, radius, tipografía. Son decisión interna del chatbox; el SPEC no los pide y la entrevista los dejó fuera del contrato.
- Toggle manual de tema en el widget. El widget no tiene UI de toggle; si el sitio host tiene uno, propaga `data-theme` al subtree.
- Múltiples paletas configurables (temas "brand A" vs "brand B"). El host puede definirlas en su hoja y mapear a los 7 tokens.
- Internacionalización de los nombres de tokens. Prefijo `--chatbox-color-*` en inglés, alineado con el resto del naming del proyecto (`ChatMessage`, `ChatSource`, `useChatStream`).
- Animaciones de transición entre temas.

## Further Notes

- RF-F62 (textos centralizados en `strings.es.ts`) se puede tocar en el mismo PR si tiene sentido, pero queda fuera de este spec.
- RF-F60 (enlace de contacto) y RF-F31 (enlaces markdown) ahora comparten `--chatbox-color-link` automáticamente; no se introduce token separado.
- Precedencia de capas de tema, de menor a mayor: defaults en `.chatbox` < `@media (prefers-color-scheme: dark)` < `[data-theme]` (atributo en ancestro) < `@media (forced-colors: active)` (system-color keywords del navegador).
- Si en el futuro se introduce un toggle de tema en el sitio host, basta con propagar `data-theme` al subtree del widget — no se necesita mapping de variables. El contrato del widget no cambia.
- Los ratios de contraste están calculados con WCAG 2.x y asserteados por umbral en `test/unit/chatbox-theming.test.ts`. Si se prefiere WCAG 3 (APCA), recalibrar antes de tocar la paleta.
- La verificación de valores resueltos (tema oscuro, `data-theme`, `forced-colors`, contraste con axe) se hace en navegador real en el ticket **RF-F61/T5** (#62), porque jsdom no evalúa `@media` ni resuelve `var()`.
- El spec no introduce dependencias de runtime. La única dependencia nueva es `postcss` como **devDependency** del frontend, usada por los tests unitarios para parsear `Chatbox.css` (ver `docs/decisions/002-css-theming-test-strategy.md`).
- Inconsistencia documental del repo (no bloqueante para F61): `AGENTS.md` raíz y `docs/agents/domain.md` mencionan `docs/adr/`, pero el folder real es `docs/decisions/`. Queda como tarea de limpieza aparte.

## Términos fijados (L5)

- **Tema (chatbox)**: combinación de los 7 tokens semánticos de color del widget, expresada como defaults en `.chatbox` y override por cascada desde cualquier ancestro.
- **Sitio host**: sitio web que embebe el widget del chatbox. En MVP es una página Astro, pero el contrato no acopla a Astro.
- **Self-contained**: el widget no escribe en `:root` ni depende de variables globales del sitio host. Sus defaults viven dentro de `.chatbox` y son portables entre hosts.
- **Override por cascada**: mecanismo por el cual el sitio host sobrescribe los tokens del chatbox desde cualquier ancestro del subtree, aprovechando la cascada CSS. El host puede mapear sus propias variables a las del chatbox o pisar valores literales; el chatbox no consulta directamente las variables del host.
- **Por defecto (tema)**: comportamiento base cuando ni el usuario ni el sitio fuerzan nada. Defaults claros y `@media (prefers-color-scheme: dark)` para los oscuros. Sin ruta manual en el widget.
- **Token semántico**: nombre CSS (`--chatbox-color-text`, `--chatbox-color-link`, etc.) que describe un rol, no un valor. El host lo pisa; el componente lo consume.
- **Verificación de mecanismo**: assertar la estructura del CSS (declaraciones, orden de capas, selectores) con un parser. Prueba que el mecanismo está bien montado, no que el navegador resuelva el valor final. Es lo máximo que permite jsdom.
- **Verificación de resolución**: assertar el valor computado final (`getComputedStyle`) en un navegador real. Imposible en jsdom para `var()` y `@media`; vive en el ticket T5.

