# RF-F61 — Theming del chatbox

> Estructura del template `to-spec` adaptada a la convención del proyecto (`.specs/` por RF, decisiones de proceso en `../docs/decisions/`).
>
> Spec confirmado el 2026-10-17 tras sesión de `grill-with-docs`. Cambios respecto al borrador inicial: US #7 reescrita a lectura (a), L2 honra `data-theme` en ancestros (antes se rechazaba), `forced-colors: active` y `prefers-contrast: more` entran en scope (antes fuera), target sube a WCAG 2.x AAA, layout de archivos a `src/components/Chatbox.css` (antes `src/components/chatbox/chatbox.css`), glosario renombrado.

## Síntesis de la entrevista (decisiones acordadas, 2026-10-17)

- **L0 — Superficie pública**: 7 tokens semánticos `--chatbox-color-*` (text, surface, primary, link, border, focus, error). Lista cerrada. Burbujas user/assistant mismo color (sin `surface-elevated`). Estados de link reusan `--chatbox-color-link` (sin `link-hover`/`link-visited`). Sin `text-muted`, `success`, `warning` ni "on-primary" dedicado.
- **L1 — Scoping**: defaults declarados dentro de `.chatbox` (no en `:root`), self-contained, override por cascada desde cualquier ancestro. US #7 reescrita: "los defaults del chatbox son razonables y se ven neutros; alinear con la marca del sitio es opt-in vía mapping explícito de los 7 tokens en la hoja del host". Scope raíz único: `.chatbox`.
- **L2 — Estrategia de tema**: el widget honra `data-theme="dark"` y `data-theme="light"` cuando un ancestro del subtree del widget lo declara. Sin `data-theme`, cae a `@media (prefers-color-scheme: dark)` para los defaults oscuros. `data-theme` gana sobre `prefers-color-scheme` por especificidad. `forced-colors: active` y `prefers-contrast: more` entran en scope.
- **L3 — Paleta y conformidad**: las dos tablas del borrador se confirman. Target sube a **WCAG 2.x AAA** (7:1 texto normal, 4.5:1 texto grande). Texto light 17.4:1, dark 11.2:1. `--chatbox-color-border` en dark queda en 3.7:1 (gray-500): pasa AA 1.4.11 non-text (3:1); WCAG no tiene AAA non-text separado, así que el spec cumple AAA estricto.
- **L4 — Layout de archivos**: CSS del chatbox en `src/components/Chatbox.css` (nuevo, colocalizado con `Chatbox.tsx`). `src/style.css` mínimo (solo reset de Vite, sin reglas `.chatbox`). Migración del bloque `.chatbox a` desde `src/style.css` al nuevo `Chatbox.css` con `var(--chatbox-color-link)`. `src/index.tsx` sin cambios; `src/components/Chatbox.tsx` añade `import './Chatbox.css'`.
- **L5 — Glosario**: "Heredado del sitio" renombrado a "Override por cascada". Se añaden "Sitio host" y "Self-contained". Glosario dentro del spec; sin `GLOSSARY.md` raíz.

## Problem Statement

El widget de chatbox se incrusta en un sitio host (Astro en MVP) y hoy no expone contrato de tema. La paleta vive en `src/style.css` mezclada con los estilos por defecto de Vite, los enlaces tienen colores hardcodeados (`#005fcc` / `#66b3ff`), y no hay defaults propios del chatbox. Un sitio que quiere alinear el widget con su marca tiene que patchear el archivo o pisar todo a mano. Además, los requisitos RF-F31 (enlaces contrastantes) y RF-F42 (contraste 4.5:1 / 3:1) están parcialmente implementados con valores fijos, lo que dificulta auditarlos y cambiarlos.

## Solution

El chatbox expone un contrato de tema mínimo basado en 7 tokens semánticos CSS: `--chatbox-color-text`, `--chatbox-color-surface`, `--chatbox-color-primary`, `--chatbox-color-link`, `--chatbox-color-border`, `--chatbox-color-focus`, `--chatbox-color-error`. Los defaults se declaran dentro de `.chatbox` para que el widget sea self-contained; el sitio host los pisa por cascada desde cualquier ancestro. El tema oscuro se activa con `@media (prefers-color-scheme: dark)` y, además, el widget honra `data-theme` en ancestros del subtree para sincronizarse con toggles del host. `forced-colors: active` y `prefers-contrast: more` adaptan el widget a las preferencias de accesibilidad del sistema. Los defaults de ambos temas pasan WCAG 2.x AAA para texto (≥7:1) y AA non-text (3:1) para componentes y foco. Los enlaces y los acentos usan los tokens en vez de hex hardcodeados (RF-F31, RF-F61).

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
| `--chatbox-color-text` | `#222` | 17.4:1 |
| `--chatbox-color-surface` | `#ffffff` | — |
| `--chatbox-color-primary` | `#005fcc` | 6.0:1 |
| `--chatbox-color-link` | `#005fcc` | 6.0:1 |
| `--chatbox-color-border` | `#6b7280` (gray-500) | 4.9:1 |
| `--chatbox-color-focus` | `#005fcc` | 6.0:1 |
| `--chatbox-color-error` | `#b91c1c` (red-700) | 6.6:1 |

**Tema oscuro (sobre `#1a1a1a`):**

| Token | Valor | Ratio vs surface |
|---|---|---|
| `--chatbox-color-text` | `#ccc` | 11.2:1 |
| `--chatbox-color-surface` | `#1a1a1a` | — |
| `--chatbox-color-primary` | `#66b3ff` | 8.1:1 |
| `--chatbox-color-link` | `#66b3ff` | 8.1:1 |
| `--chatbox-color-border` | `#6b7280` (gray-500) | 3.7:1 |
| `--chatbox-color-focus` | `#66b3ff` | 8.1:1 |
| `--chatbox-color-error` | `#fca5a5` (red-300) | 9.5:1 |

Notas:

- `text` y `surface` reusan los valores actuales para no romper visualmente.
- `primary` y `link` comparten hex a propósito: el botón Enviar y los enlaces markdown tiran del mismo azul (RF-F31 ya lo hace así). El texto del botón sobre `primary` es blanco sin token dedicado (incidental, no es texto de cuerpo).
- `border` se queda en gray-500 en ambos temas. Pasa AA 1.4.11 non-text (3:1) en dark con 3.7:1; WCAG no tiene AAA non-text separado, así que el spec cumple AAA estricto. Si más adelante se necesita un separador más sutil, se introduce un token extra, no se relaja este.
- `error` usa red-700 en claro y red-300 en oscuro: ambos pasan 7:1 sobre la surface correspondiente.
- Ratios calculados con WCAG 2.x. Si se prefiere WCAG 3 (APCA), recalibrar antes de tocar la paleta.

### Layout de archivos

- Estilos del chatbox migran a `src/components/Chatbox.css` (nuevo, colocalizado con `Chatbox.tsx`). Consistente con `frontend/AGENTS.md` ("`components/` reservado al entry point").
- `src/style.css` se queda mínimo (reset de Vite para `body`/`#app`). Se elimina el bloque `.chatbox a` (migrado a `Chatbox.css`).
- `src/index.tsx` sigue importando `./style.css` sin cambios. `src/components/Chatbox.tsx` añade `import './Chatbox.css'`. `src/chat/components/AssistantMarkdown.tsx` y `src/chat/components/ExternalLink.tsx` no importan CSS: heredan por cascada de `.chatbox a`.

### Cambios en código

- `src/components/Chatbox.tsx`: añade `import './Chatbox.css'`. El resto del componente no cambia: los tokens se aplican vía clases `.chatbox__*` ya presentes.
- `src/components/Chatbox.css` (nuevo): defaults en `.chatbox`, `@media (prefers-color-scheme: dark)`, selectores `[data-theme="dark"] .chatbox` y `[data-theme="light"] .chatbox` (con precedencia sobre la media query), `@media (forced-colors: active)`, `@media (prefers-contrast: more)`, y el bloque `.chatbox a` migrado con `var(--chatbox-color-link)`.
- `src/style.css`: el bloque `.chatbox a` se elimina. Se queda solo el reset de Vite.
- `src/components/ExternalLink.tsx`: sin cambios (estilizado por `.chatbox a`).
- `src/chat/components/AssistantMarkdown.tsx`: sin cambios (los enlaces heredan color de `.chatbox a`).
- `src/index.tsx`: sin cambios.

## Testing Decisions

### Test seam

Renderizar `<Chatbox>` con `@testing-library/preact` y leer `getComputedStyle` sobre `.chatbox` y elementos clave (link, button, input). Es el seam más alto disponible; captura tanto el CSS como la lógica de cascada. Complementado con un test unitario que parsea el `Chatbox.css` y assertea los 7 tokens en cada tema (regresión de valores).

### Tests unitarios (`test/unit/`)

- `Chatbox.css` snapshot: el parser verifica que `.chatbox` declara los 7 tokens de tema claro, que `@media (prefers-color-scheme: dark) .chatbox` declara los 7 tokens de tema oscuro, que los selectores `[data-theme="dark"] .chatbox` y `[data-theme="light"] .chatbox` declaran los tokens correspondientes, y que `@media (forced-colors: active) .chatbox` usa `system-color` keywords. Hex exactos asserteados. Regresión de paleta.
- Override: aplicar `style="--chatbox-color-primary: red"` a un ancestro del `<Chatbox>` y verificar que el botón Enviar usa el color override vía `getComputedStyle`.
- Precedencia `data-theme` sobre `prefers-color-scheme`: simular `matchMedia('(prefers-color-scheme: dark)')` devolviendo `true` y a la vez un ancestro con `data-theme="light"`; verificar que gana el light.
- Prior art: la estructura sigue los tests existentes para `sse.ts` y `trimHistory` en `test/unit/` (Vitest).

### Tests de componente (`test/component/`)

- Light mode: tokens claros aplicados a `color` y `background` de `.chatbox`.
- Dark mode: mockear `window.matchMedia('(prefers-color-scheme: dark)')` y verificar tokens oscuros.
- Override del host: aplicar CSS externo que pise `--chatbox-color-link` y verificar que `getComputedStyle` lo refleja.
- Sincronía con `data-theme`: renderizar `<Chatbox>` dentro de `<div data-theme="dark">` con `matchMedia` reportando light; verificar tokens oscuros. Repetir con `data-theme="light"` y `matchMedia` reportando dark; verificar tokens claros.
- `forced-colors`: simular `matchMedia('(forced-colors: active)')` y verificar que los tokens se resuelven a `system-color` keywords.
- Contraste: axe-core en `.chatbox` sin violaciones de contraste (asume axe configurado para AAA o para el nivel que se quiera auditar).
- Prior art: tests de `@testing-library/preact` en `test/component/` para Enter/Shift+Enter, Enviar↔Detener, estado vacío.

### Lo que NO se testea

- Implementación interna (orden de media queries, especificidad exacta, shorthand `background` vs `background-color`).
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
- Los ratios de contraste están calculados con WCAG 2.x. Si se prefiere WCAG 3 (APCA), recalibrar antes de tocar la paleta.
- El spec no introduce dependencias nuevas. La migración es CSS + reordenación de archivos.
- Inconsistencia documental del repo (no bloqueante para F61): `AGENTS.md` raíz y `docs/agents/domain.md` mencionan `docs/adr/`, pero el folder real es `docs/decisions/`. Queda como tarea de limpieza aparte.

## Términos fijados (L5)

- **Tema (chatbox)**: combinación de los 7 tokens semánticos de color del widget, expresada como defaults en `.chatbox` y override por cascada desde cualquier ancestro.
- **Sitio host**: sitio web que embebe el widget del chatbox. En MVP es una página Astro, pero el contrato no acopla a Astro.
- **Self-contained**: el widget no escribe en `:root` ni depende de variables globales del sitio host. Sus defaults viven dentro de `.chatbox` y son portables entre hosts.
- **Override por cascada**: mecanismo por el cual el sitio host sobrescribe los tokens del chatbox desde cualquier ancestro del subtree, aprovechando la cascada CSS. El host puede mapear sus propias variables a las del chatbox o pisar valores literales; el chatbox no consulta directamente las variables del host.
- **Por defecto (tema)**: comportamiento base cuando ni el usuario ni el sitio fuerzan nada. Defaults claros y `@media (prefers-color-scheme: dark)` para los oscuros. Sin ruta manual en el widget.
- **Token semántico**: nombre CSS (`--chatbox-color-text`, `--chatbox-color-link`, etc.) que describe un rol, no un valor. El host lo pisa; el componente lo consume.

