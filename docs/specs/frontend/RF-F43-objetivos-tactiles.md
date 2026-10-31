# RF-F43 — Objetivos táctiles del chatbox

> Convención del proyecto: un spec por RF en `docs/specs/frontend/`, decisiones de proceso en
> `docs/decisions/` de la raíz, glosario en `GLOSSARY.md` de la raíz.
>
> Spec confirmado el 2026-10-21 tras sesión de `grill-with-docs`. Decisión de verificación
> en `docs/decisions/007-objetivos-tactiles.md`. Issue: #98.

## Síntesis de la entrevista (decisiones acordadas, 2026-10-21)

- **D1 — Alcance del trabajo**: **contrato + guarda**, patrón RF-F42. No es un retoque de CSS.
- **D2 — Qué se mide**: la **caja del control** (*border-box*). El botón visible mide 44×44 y lo
  que ve la persona es lo que recibe el puntero. Sin áreas de golpeo invisibles.
- **D3 — Unidad**: **px CSS absolutos**. El suelo deja de depender del `font-size` del host.
- **D4 — El 44 px no es un token del tema**: es una garantía del widget, no una propiedad
  estilable por el host.
- **D5 — Alcance del contrato**: los **botones accionables** del widget. Quedan fuera, con su
  motivo declarado en el contrato: los enlaces en línea (excepción *inline* de WCAG 2.5.8),
  los controles deshabilitados (exención de WCAG 2.5.8) y el campo de texto (campo de texto, no
  control de activación; la especificación no lo enumera). Un elemento excluido no desaparece
  del detector: declara su identidad y su motivo, que es lo que lo distingue de uno que se
  cuela sin decir nada.
- **D6 — Identidad de cada control**: `data-chatbox-control` en el markup. Es el único punto del
  trabajo que toca markup de producción.
- **D7 — Inventario fuente única**: `test/touch-targets.ts`, con id, control y estados en que
  aparece. Lo comparten los dos niveles, como `test/contrast.ts` en RF-F42.
- **D8 — Guarda**: se escanea **todo** `src/**/*.tsx` salvo `src/dev/` (fixtures que no se
  distribuyen) con `@babel/parser`, el mismo patrón que el inventario de textos de RF-F62. Todo
  elemento interactivo —`a`, `button`, `input`, `select`, `textarea` o con `role="button"`— tiene
  que declarar una identidad presente en el inventario, y una identidad no puede declarar dos
  controles: el nivel de resolución busca por identidad, así que dos controles gemelos harían
  medir el primero en el escenario del segundo.
- **D9 — Dos niveles de verificación**, con el nivel declarado en cada aserto: mecanismo en
  jsdom, resolución en Chromium. **Sin nivel manual**: el tamaño se resuelve con números.
- **D10 — Los dos niveles no son redundantes**: el navegador de test tiene la raíz a 16 px, así
  que un `2.75rem` **pasa** el test de Chromium y falla en un host con raíz de 14 px. Solo el
  nivel de jsdom ve esa regresión.
- **D11 — Estados medidos**: estado vacío, turno en curso, confirmación de «Nueva conversación»
  abierta y «Ir al final» visible. Un control que no está en pantalla no se mide.
- **D12 — Controles deshabilitados**: no se miden, y se comprueba que no se miden.
- **D13 — Límite del host**: un `!important` sobre `button` puede bajar el suelo. Se documenta
  como límite explícito, igual que el *override por cascada* de RF-F61.
- **D14 — Botón de icono futuro**: entra por la vía normal (identidad + medición). Si no cabe en
  44×44 sin romper el diseño, la salida es una **excepción documentada con su motivo** en el
  inventario, no un suelo degradado en silencio.
- **D15 — El contrato tiene seis controles y la especificación enumera cuatro**: la
  enumeración de la especificación es de ejemplos; el widget decide.
- **D16 — Los valores de `data-chatbox-control` se declaran en la lista blanca** del inventario
  de textos (RF-F62), porque aquel escáner los detectaría como literales sin centralizar.
- **D17 — Glosario**: entran *objetivo táctil*, *control táctil*, *caja del control*,
  *exención de control inactivo* y *contrato de objetivos táctiles*.
- **D18 — Una issue (#98) y una decisión nueva (007)**. El commit es del paso de implementación.

## Auditoría (por qué no es un retoque de CSS)

| Hecho | Consecuencia |
|---|---|
| `.chatbox button { min-height: 2.75rem }` | 44 px solo con raíz de 16 px; con raíz de 14 px el control mide 38,5 px |
| No hay `min-width` | El ancho depende del texto: un botón de icono queda por debajo de 44 px y nada lo detecta |
| La especificación enumera 4 controles y hay 6 | Aceptar, cancelar e «Ir al final» no tienen contrato |
| No hay medición ni inventario | El cumplimiento es accidental, igual que el contraste antes de RF-F42 |

## Inventario de controles

| id | Control | Dónde | Estados en que aparece |
|---|---|---|---|
| `send` | Enviar / Detener | footer | siempre; deshabilitado con el campo vacío |
| `new-conversation` | Nueva conversación | footer | siempre |
| `confirm-accept` | Aceptar | fila de confirmación | con la confirmación abierta |
| `confirm-cancel` | Cancelar | fila de confirmación | con la confirmación abierta |
| `suggestion` | Sugerencia | estado vacío | con la conversación vacía |
| `scroll-to-end` | Ir al final | conversación | al alejarse del final |

Exento, declarado y **no** medido:

| id | Control | Motivo |
|---|---|---|
| `inline-link` | Enlaces en línea (`ExternalLink`) | excepción *inline* de WCAG 2.5.8 |
| `question-field` | Campo de texto | un campo no es un control de activación |

## Diseño

### CSS

```css
.chatbox button {
	min-height: 44px;
	min-width: 44px;
}
```

El suelo sustituye a `min-height: 2.75rem`. Se aplica a todos los botones del widget, que es
exactamente el alcance del contrato: no hay un selector que alcance a unos y no a otros.

### Inventario y guarda

- `test/touch-targets.ts`: fuente única del umbral, del inventario (id, control, estados) y del
  mapa de exenciones con su motivo. Una identidad del mapa está fuera de la medición y dentro
  de la guarda: el elemento sigue vigilado, solo deja de medirse.
- `test/unit/chatbox-touch-targets.test.ts` (**mecanismo**):
  - el suelo está declarado en px absolutos, y **ninguna** regla que apunte a botones lo vuelve a
    declarar en una unidad relativa (una regla más específica ganaría por orden de cascada);
  - la guarda de inventario: todo elemento interactivo de `src/components/*.tsx` declara
    `data-chatbox-control` con un id del inventario. El test **rechaza**: sin el atributo, o con
    un id desconocido, la compilación falla.
- `test/browser/touch-targets.spec.ts` (**resolución**): por cada control del inventario, en cada
  estado en que aparece, `getBoundingClientRect()` mide al menos 44×44 px CSS. Los controles
  deshabilitados no se miden, y el test lo comprueba. Cada escenario comprueba además, en los
  dos sentidos, que los controles que encuentra activos **declaran** ese estado: `states` es un
  contrato verificado y no una descripción que se pueda quedar vieja. Los escenarios cubren
  también el **viewport estrecho**, que es donde el `min-width` del suelo se come el footer.

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/components/Chatbox.css` | Suelo `min-height: 44px; min-width: 44px` en px absolutos |
| `src/components/Chatbox.tsx` | `data-chatbox-control` de «Ir al final» |
| `src/components/ChatInput.tsx` | `data-chatbox-control` de enviar/detener y del campo de texto (exento) |
| `src/components/NewConversation.tsx` | `data-chatbox-control` de los tres botones |
| `src/chat/components/ExternalLink.tsx` | `data-chatbox-control` de los enlaces en línea (exento) |
| `src/components/EmptyState.tsx` | `data-chatbox-control` de las sugerencias |
| `test/touch-targets.ts` | Nuevo: inventario y umbral |
| `test/unit/chatbox-touch-targets.test.ts` | Nuevo: mecanismo y guarda |
| `test/browser/touch-targets.spec.ts` | Nuevo: resolución |
| `test/unit/strings-inventory.test.ts` | Lista blanca: valores de `data-chatbox-control` |
| `TODO.md` | Marcar RF-F43 al cerrar |

## Criterios de aceptación

1. La hoja de estilos declara `min-height: 44px` y `min-width: 44px` en px absolutos, y ninguna
   regla que apunte a botones declara un suelo en `rem` ni en otra unidad relativa.
2. Los seis controles del inventario llevan `data-chatbox-control` con su identidad.
3. La guarda de nivel jsdom falla si aparece un control interactivo sin inventariar, y el test
   tiene una entrada que rechaza de verdad.
4. En Chromium, cada control del inventario mide al menos 44×44 px en cada estado en que
   aparece, y ningún control se mide en un estado que el inventario no declare.
5. Los controles deshabilitados no se miden, y el test lo comprueba.
6. `npm run verify` y `npm run test:browser` en verde.

## Riesgos

- **La guarda puede ser estricta de más**: un control legítimo sin inventariar rompe la
  compilación. Es el comportamiento buscado, y la salida es la excepción documentada (D14).
- **`min-width: 44px` en un contenedor estrecho**: revisar el comportamiento en el test de
  navegador con viewport pequeño, junto con el teclado virtual (RF-F51, todavía pendiente).
- **jsdom no mide**: todo lo que sea tamaño real es trabajo del nivel de Chromium.
- **Los valores nuevos del atributo entran en el escáner de textos**: hay que declararlos en la
  lista blanca, o el inventario de RF-F62 falla.

## Verificación

```bash
npm run verify        # lint + typecheck + build + test -- --run
npm run test:browser  # suite de Playwright (Chromium)
```

Los tests de navegador necesitan Chromium instalado. Es el mismo par de comandos que ejecutan el
hook pre-commit y CI.

## Plan de commits

1. `style(frontend): suelo táctil de 44 px en px absolutos`
2. `feat(frontend): identidad de control para el contrato de objetivos táctiles`
3. `test(frontend): contrato de objetivos táctiles (mecanismo y guarda)`
4. `test(frontend): resolución de objetivos táctiles en Chromium`
5. `docs(frontend): cerrar RF-F43 en el TODO`

## Referencias

- Requisito: `../../docs/design/SPEC-FRONTEND.md` (RF-F43).
- Decisión: `../../docs/decisions/007-objetivos-tactiles.md`.
- Glosario: `../../GLOSSARY.md` (RF-F43).
- Patrones heredados: `../../docs/decisions/002-css-theming-test-strategy.md`,
  `../../docs/decisions/006-contrato-y-verificacion-de-contraste.md`.
- Issue: #98.
