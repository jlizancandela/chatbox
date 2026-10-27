# RF-F50 — Viewport móvil del chatbox

> Convención del proyecto: un spec por RF en `.specs/`, decisiones de proceso en
> `docs/decisions/` de la raíz, glosario en `GLOSSARY.md` de la raíz.
>
> Spec del 2026-10-27. Decisión de verificación en
> `docs/decisions/010-viewport-movil.md`. Issue: #117.

## Requisito

> RF-F50 | El diseño será fluido, dimensionará la altura con `dvh` y respetará
> `env(safe-area-inset-*)`. El campo de texto usará `font-size` ≥ 16 px para evitar el zoom
> automático de iOS Safari. | I |

## Decisiones

- **D1 — Alcance del trabajo**: **contrato + guarda**, el patrón de RF-F42, RF-F43, RF-F44 y
  RF-F45. No es un retoque de CSS.
- **D2 — La altura la da el host, el tope es del widget**: la raíz declara `height: 100%` y
  `max-height: 100dvh`. El widget llena el contenedor que le den y nunca es más alto que la
  pantalla.
- **D3 — Unidad**: `dvh` y solo `dvh`. `vh` y `lvh` miden el viewport con la barra del
  navegador desplegada —el pie quedaría fuera de la pantalla— y `svh` mide el más bajo: el
  widget no llenaría la pantalla. La guarda mira toda regla que declare una altura.
- **D4 — La safe area se suma al padding base**: `max(<base>, env(safe-area-inset-<edge>))`.
  Un `env()` a secas dejaría el widget sin padding en los móviles sin notch.
- **D5 — El inset va en las regiones, no en la raíz**: en la raíz, el fondo del widget
  desaparecería en la franja del notch.
- **D6 — El suelo de 16 px es absoluto**: `max(1rem, 16px)`. `1rem` a secas vale 16 px solo si
  la raíz del host mide 16 px; con una raíz de 14 px iOS Safari ampliaría la página al
  enfocar el campo. El `rem` se conserva dentro del `max()` para respetar el tamaño de fuente
  que la persona eligió en su navegador.
- **D7 — Una sola regla declara el tamaño del campo**: ni el atajo `font` —que fija también el
  tamaño— ni una segunda regla. Una regla más específica ganaría por orden de cascada.
- **D8 — El atajo `font: inherit` sale**: fija también el tamaño, y con dos declaraciones del
  tamaño el suelo deja de ser decidible. Las propiedades de la fuente se heredan una a una.
  Hoy el atajo no se nota —el `font-size: 1rem` del campo viene después y gana—, pero en
  cuanto cambie el orden de las reglas vuelve a neutro el suelo.
- **D9 — El inset lleva valor de reserva**: `env(safe-area-inset-*, 0px)`. Sin él, un `env()`
  inválido en tiempo de valor calculado dejaría el borde en `unset` —sin padding— en vez de
  perder solo la safe area.
- **D10 — Inventario fuente única**: `test/viewport.ts`, con el suelo, la tabla de safe areas y
  la guarda. Lo comparten los dos niveles, como `test/touch-targets.ts` en RF-F43.
- **D11 — Dos niveles de verificación**, con el nivel declarado en cada aserto: mecanismo en
  jsdom, resolución en Chromium. **Sin nivel manual**.
- **D12 — Los dos niveles no son redundantes, y fallan en direcciones opuestas**: el
  navegador de test tiene la raíz a 16 px, así que un `1rem` **pasa** la comprobación de
  Chromium; el escenario de resolución inyecta una raíz de 14 px y lo ve. Y al revés, Chromium
  no distingue `vh` de `dvh`: solo el nivel de mecanismo ve esa regresión.
- **D13 — Límite declarado**: Chromium no emula safe areas. La rama del inset se verifica en el
  mecanismo; la resolución comprueba que el padding base sobrevive al `max()`.
- **D14 — `viewport-fit=cover` lo pone el sitio host**: el widget no puede declarar la
  etiqueta `viewport` de la página que lo embebe. Sin ella, `env(safe-area-inset-*)` vale cero
  y esta mitad de RF-F50 no tiene efecto.
- **D15 — Sin cambios de markup**: la verificación es de CSS, y el HTML del widget no cambia.
- **D16 — Glosario**: entran *viewport dinámico*, *safe area*, *suelo de tamaño de fuente* y
  *contrato de viewport móvil*.
- **D17 — Una decisión nueva (010)**.

## Auditoría (por qué no es un retoque de CSS)

| Hecho | Consecuencia |
|---|---|
| `.chatbox { height: 100% }`, sin tope | El widget se sale por debajo de la pantalla si el contenedor del host es más alto |
| Ninguna regla usa `env(safe-area-inset-*)` | Con `viewport-fit=cover`, el notch y el indicador de inicio tapan la cabecera y el pie |
| `.chatbox textarea { font-size: 1rem }` | Con la raíz del host a 14 px el campo queda en 14 px y iOS amplía la página al enfocarlo |
| `.chatbox textarea, .chatbox button { font: inherit }` | El atajo fija también el tamaño: neutraliza el suelo en cuanto cambia el orden de las reglas |
| No hay contrato ni detector | El cumplimiento es accidental, igual que el contraste antes de RF-F42 |

## Diseño

### CSS

```css
.chatbox {
	height: 100%;
	max-height: 100dvh;
	min-height: 0;
}

.chatbox__header {
	padding: 0.75rem 1rem;
	padding-top: max(0.75rem, env(safe-area-inset-top, 0px));
	padding-left: max(1rem, env(safe-area-inset-left, 0px));
	padding-right: max(1rem, env(safe-area-inset-right, 0px));
}

.chatbox__conversation {
	padding: 1rem;
	padding-left: max(1rem, env(safe-area-inset-left, 0px));
	padding-right: max(1rem, env(safe-area-inset-right, 0px));
}

.chatbox__footer {
	padding: 0.75rem 1rem;
	padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px));
	padding-left: max(1rem, env(safe-area-inset-left, 0px));
	padding-right: max(1rem, env(safe-area-inset-right, 0px));
}

.chatbox textarea {
	font-size: max(1rem, 16px);
	line-height: 1.375;
}
```

El `padding` base se declara **antes** que los `longhands`: en un navegador que no entienda
`env()` o `max()`, las declaraciones inválidas se descartan y el padding base sobrevive. Y el
`env()` lleva **valor de reserva** (`0px`) para que la declaración sea válida siempre: sin él,
un `env()` inválido en tiempo de valor calculado dejaría el borde en `unset` —sin padding—.

El interlineado es **unitless** (`1.375`): el Stitch pide 22 px sobre 16 px, y un interlineado
en px absolutos contradiría al tamaño de fuente que la persona eligió en su navegador.

El atajo `font: inherit` se sustituye por las propiedades heredadas una a una:

```css
.chatbox textarea,
.chatbox button {
	font-family: inherit;
	font-style: inherit;
	font-variant: inherit;
	font-weight: inherit;
	font-stretch: inherit;
	line-height: inherit;
	letter-spacing: inherit;
	color: inherit;
}
```

### Inventario y guarda

- `test/viewport.ts`: fuente única del suelo, de la tabla de safe areas y de la guarda. Una
  función pura, `findViewportViolations(root)`, que devuelve las razones por las que una hoja
  viola el contrato.
- `test/css-declarations.ts`: la lectura de declaraciones, sin la hoja. Vive aparte de
  `css-layers.ts` porque ese módulo importa el CSS con la consulta `?raw` de Vite, y el
  contrato también lo usan los tests de navegador, que no pasan por Vite. Lo comparten el
  theming y el contrato de viewport: duplicar el parser haría que un cambio en la hoja se
  interpretara de dos maneras.
- `test/unit/chatbox-viewport.test.ts` (**mecanismo**):
  - la raíz declara el tope en `dvh` y ninguna regla declara una altura en `vh`, `svh` o
    `lvh`;
  - cada región de la tabla declara su borde como
    `max(<base>, env(safe-area-inset-<edge>, 0px))`, con el base que declara el contrato, y
    ninguna regla posterior lo vuelve a declarar;
  - el campo de texto declara `max(1rem, 16px)` y es la única declaración de su tamaño: ni el
    atajo `font`, ni una segunda regla, ni una que lo apunte por su id;
  - la guarda **rechaza**: un tope en `vh`, una raíz sin tope, una altura en `vh` en cualquier
    regla, una región que no existe, una región sin padding, un padding que se come el base,
    uno que ignora la safe area, uno que lee la safe area de otro borde, un inset sin valor de
    reserva, un padding que no parte del base del contrato, una regla posterior que vuelve a
    declarar el padding, un tamaño en `rem`, uno por debajo del suelo, uno que ignora el del
    sitio host, un campo sin tamaño, una segunda regla que lo declare y el atajo `font`.
- `test/browser/viewport.spec.ts` (**resolución**): el widget no crece más allá del viewport
  dinámico, llena el contenedor que le da el host, el campo de texto mide al menos 16 px con
  una raíz de host de 14 px, el interlineado acompaña a su tamaño de fuente, cada borde
  conserva su padding base, el widget no se desborda horizontalmente en un viewport estrecho
  y, en un viewport por debajo del mínimo del widget, la cabecera y el pie no se encogen.
  Cada una de esas comprobaciones tiene su **entrada que rechaza**, que inyecta el CSS roto
  y comprueba que entonces sí se rompe: sin `max-height` el widget crece, sin `height` no
  llena el host, con `1rem` el campo baja del suelo, con un interlineado en px el campo deja
  de acompañar a su tamaño, sin padding base el borde queda a cero, con un ancho fijo se
  desborda y con `min-height: 0` la cabecera se encoge. Sin esas entradas, las comprobaciones
  no protegerían nada.
- `test/css-layers.ts`: `declarationsOf` sale de aquí y pasa a `test/css-declarations.ts`, que
  no importa la hoja. La API no cambia para quienes lo usaban.

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/components/Chatbox.css` | Tope `max-height: 100dvh`, safe areas en las regiones, suelo de 16 px en el campo y el atajo `font` fuera |
| `index.html` | `viewport-fit=cover` en la etiqueta `viewport` de la página de demo |
| `test/css-declarations.ts` | Nuevo: lectura de declaraciones, sin la hoja (la comparten el theming y el contrato de viewport) |
| `test/css-layers.ts` | `declarationsOf` sale de aquí y se reexporta desde el módulo nuevo |
| `test/viewport.ts` | Nuevo: suelo, tabla de safe areas y guarda |
| `test/unit/chatbox-viewport.test.ts` | Nuevo: mecanismo y guarda |
| `test/browser/viewport.spec.ts` | Nuevo: resolución |
| `TODO.md` | Marcar RF-F50 al cerrar |

## Criterios de aceptación

1. La raíz declara `max-height: 100dvh`, y ninguna regla de la hoja declara una altura en
   `vh`, `svh` o `lvh`.
2. La cabecera, el hilo y el pie suman la safe area a su padding base en los bordes que tocan
   la pantalla, con un valor de reserva en el `env()` para que la declaración no pueda quedar
   inválida. Ninguna regla —tampoco dentro de un `@media`— vuelve a declarar ese padding.
3. El campo de texto declara `font-size: max(1rem, 16px)` y es la única regla que declara su
   tamaño: ni el atajo `font` ni una segunda regla, ni siquiera una que lo apunte por su id o
   por su identidad del contrato de objetivos táctiles.
4. El interlineado del campo acompaña a su tamaño de fuente: `1.375` sin unidad, y ninguna
   regla que apunte al campo lo fija en px absolutos.
5. La guarda de nivel jsdom falla si se rompe cualquiera de las cuatro cosas, y el test tiene
   una entrada que rechaza de verdad en cada caso.
6. En Chromium, con la raíz del host a 14 px, el campo de texto mide al menos 16 px; el widget
   no crece más allá del viewport dinámico; y cada borde conserva su padding base.
7. El diseño es fluido: el widget se adapta al ancho que le da el contenedor sin desbordarse,
   y su altura la toma del host.
8. Cada comprobación del nivel de resolución tiene su entrada que rechaza, que inyecta el CSS
   roto y comprueba que entonces sí se rompe.
9. `npm run verify` y `npm run test:browser` en verde.

## Riesgos

- **`max-height: 100dvh` en un navegador sin `dvh`**: la declaración se descarta y el widget
  vuelve a no tener tope. Es una mejora sobre el estado anterior, no un empeoramiento: el
  `height: 100%` sigue mandando.
- **`env()` en un navegador que no lo entiende**: se descarta la declaración del `longhand` y
  sobrevive el padding base, que por eso se declara antes.
- **La altura mínima del widget**: a 390 px de ancho, en el estado vacío, la cabecera, el
  padding del hilo y el pie suman unos 320 px; por debajo, el contenido no cabe entero. Es un
  límite del diseño —cambia con el diseño, no con el código—, no del contrato, y el sitio host
  decide el tamaño del contenedor.
- **`viewport-fit=cover` en el sitio host**: sin él, la mitad de RF-F50 no tiene efecto. Está
  escrito en el spec y en la decisión; el sitio Astro del MVP lo tiene que añadir.
- **jsdom no mide**: todo lo que sea tamaño real es trabajo del nivel de Chromium.

## Verificación

```bash
npm run verify        # lint + typecheck + build + test -- --run
npm run test:browser  # suite de Playwright (Chromium)
```

Los tests de navegador necesitan Chromium instalado. Es el mismo par de comandos que ejecutan
el hook pre-commit y CI.

## Referencias

- Requisito: `../../docs/stitch-frontend-design/SPEC-FRONTEND.md` (RF-F50).
- Decisión: `../../docs/decisions/010-viewport-movil.md`.
- Glosario: `../../GLOSSARY.md` (RF-F50).
- Patrones heredados: `../../docs/decisions/002-css-theming-test-strategy.md`,
  `../../docs/decisions/007-objetivos-tactiles.md`,
  `../../docs/decisions/009-nombres-accesibles.md`.
- Issue: #117.
- Pendiente de RF-F50: RF-F51, el teclado virtual y `visualViewport`.
