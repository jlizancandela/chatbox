# RF-F51 — Teclado virtual del chatbox

> Convención del proyecto: un spec por RF en `.specs/`, decisiones de proceso en
> `docs/decisions/` de la raíz, glosario en `GLOSSARY.md` de la raíz.
>
> Spec del 2026-10-27. Decisión de verificación en
> `docs/decisions/011-teclado-virtual.md`. Issue: #119.

## Requisito

> RF-F51 | En móvil, el campo de texto y el último mensaje no quedarán tapados por el teclado
> virtual (ajuste con `visualViewport` si el chat va a pantalla completa o flotante). | I |

## Decisiones

- **D1 — Alcance del trabajo**: **contrato + guarda**, el patrón de RF-F42 a RF-F50. No es un
  retoque de CSS.
- **D2 — El teclado encoge el viewport visual, no el de layout**: por eso `dvh` —la unidad con
  la que RF-F50 topa la altura— no baja cuando se abre el teclado. La zona que de verdad se
  ve la publica `window.visualViewport`: su `height` mengua y su `offsetTop` dice dónde está
  su borde superior.
- **D3 — La zona visible**: la banda del viewport de layout que está en la pantalla, de
  `visualViewport.offsetTop` a `visualViewport.offsetTop + visualViewport.height`. Por debajo
  está el teclado. La altura del viewport de layout es la de su bloque contenedor inicial
  (`documentElement.clientHeight`), no `innerHeight`: esa incluye la barra de
  desplazamiento horizontal y el `visualViewport` no, así que con barra horizontal
  `innerHeight` daría una franja de teclado fantasma.
- **D4 — La franja reservada**: el widget reserva en su raíz el espacio que el teclado le
  tapa a su borde inferior, de modo que su pie —donde vive el campo de texto— quede por
  encima del teclado. Se reserva **debajo** del contenido, no moviendo la caja: el sitio
  host manda en el tamaño del widget (RF-F50) y el widget solo se ocupa de su contenido.
- **D5 — La condición es el teclado, no el widget**: la reserva sale de que el teclado
  llegue al contenido del widget, y no de que el widget esté «anclado abajo». Un widget
  anclado abajo —un cajón a pantalla completa o un panel flotante— es el que el navegador
  no puede desplazar al enfocar el campo, así que es el que reserva; un widget embebido en
  una página lo desplaza el navegador por su cuenta, y su pie queda arriba del teclado, así
  que no reserva nada. La condición es geométrica y se decide sola, sin que el sitio host
  tenga que acordarse de nada.
- **D6 — La franja es exactamente la que hace falta**: el pie del widget tiene que quedar en
  el borde de la zona visible, ni un píxel más abajo (el campo tapado) ni uno más arriba (un
  hueco entre el pie y el teclado). Y no lleva tope: un tope dejaría ese hueco.
- **D7 — La medida se descuenta a sí misma**: la reserva vive en el padding de la raíz, así
  que el borde inferior de su caja de contenido es el de la caja menos lo reservado. Sin
  restarlo, la medida incluiría el efecto de la propia reserva: la caja crecería en cada
  medida y la reserva con ella, hasta dejar al widget sin contenido.
- **D8 — La franja se mide, no se declara**: el valor viene de `visualViewport` en tiempo de
  ejecución y se publica como una variable CSS en la raíz. Declararla en unidades de
  viewport —`dvh`— volvería a meter el `dvh` de RF-F50 en un sitio donde no vale.
- **D9 — La variable lleva su valor de reserva**: sin teclado, la franja es cero; sin
  reserva, un `var()` inválido dejaría el pie del widget sin su sitio.
- **D10 — La franja va en la raíz, no en las regiones**: lo que se sale de debajo de la
  pantalla es la caja entera, y el pie es su último hijo. Es lo contrario de la safe area,
  que sí va en las regiones (RF-F50, D5): la safe area la publica el navegador como `env()`
  y es del entorno; la franja del teclado se mide y es de la caja.
- **D11 — El hilo no pierde su final**: al encogerse la zona visible, el hilo se encoge y su
  último mensaje se sale de la vista. Si la persona lo seguía, vuelve al final; si se apartó,
  no se la arrastra.
- **D12 — El recolocamiento es un efecto de layout**: al encogerse el hilo, el navegador
  avisa con un `scroll` que parece que la persona se ha apartado —el final está más lejos—
  y ese aviso puede llegar antes que un efecto normal. Con un efecto normal, el hilo se
  quedaría a medias y aparecería el botón «Ir al final» sin motivo.
- **D13 — Inventario fuente única**: `test/virtual-keyboard.ts` con el nombre de la variable,
  su valor de reserva y la guarda. La regla de cálculo vive en
  `src/chat/domain/visual-viewport.ts`, porque el widget también la necesita.
- **D14 — Dos niveles de verificación**, con el nivel declarado en cada aserto: mecanismo en
  jsdom, resolución en Chromium. **Sin nivel manual**.
- **D15 — Chromium no emula un teclado virtual**: el escenario de resolución sustituye el
  `visualViewport` por uno cuya altura mengua como lo haría el teclado y dispara su
  `resize`, que es justo lo que el navegador publica cuando el teclado abre. Lo que se
  comprueba es la reacción del widget a ese aviso, con números de verdad.
- **D16 — `interactive-widget=resizes-content` lo pone el sitio host**: esa etiqueta de
  `viewport` haría que el teclado encogiera el viewport de layout —y entonces `dvh` valdría—
  , pero es del sitio host, como `viewport-fit=cover` (RF-F50, D14), y no funciona en
  Safari. El widget no puede depender de ella.
- **D17 — Sin cambios de markup**: el widget ya es una sección con una raíz; lo único nuevo
  es una variable CSS en ella.
- **D18 — Glosario**: entran *zona visible*, *franja del teclado*, *anclaje inferior* y
  *contrato de teclado virtual*.
- **D19 — Una decisión nueva (011)**.

## Auditoría (por qué no es un retoque de CSS)

| Hecho | Consecuencia |
|---|---|
| `max-height: 100dvh` (RF-F50) | `dvh` mide el viewport de layout, que el teclado virtual no encoge: el pie del widget queda bajo el teclado |
| El `visualViewport` no se mira en ningún sitio | La zona que se ve de verdad no se sabe: nadie mide la franja que tapa el teclado |
| Al encogerse el hilo, su final se sale de la vista | El último mensaje desaparece justo cuando la persona está escribiendo |
| No hay contrato ni detector | El cumplimiento es accidental, igual que el contraste antes de RF-F42 |

## Diseño

### La regla, pura

```ts
// src/chat/domain/visual-viewport.ts
visibleArea(visualHeight, visualOffsetTop)  // la banda que está en la pantalla
keyboardStrip(layoutHeight, area)           // la franja que el teclado tapa
coveredByKeyboard(bottom, area)             // la parte del borde que queda bajo el teclado
reservedInset(bottom, applied, layoutHeight, area) // lo que hay que reservar
```

La regla es una frase: **el widget reserva, en su raíz, lo que el teclado tapa al borde
inferior de su contenido.** Y lo que se mide es el borde inferior de la caja de contenido de
la raíz —el de la caja menos lo reservado—, no el de la caja: el pie es lo que tiene que
quedar a la vista.

### CSS

```css
.chatbox {
	height: 100%;
	max-height: 100dvh;
	padding-bottom: var(--chatbox-keyboard-inset, 0px);
}
```

La raíz tiene `box-sizing: border-box`, así que el `padding-bottom` recorta la caja de
contenido: la cabecera, el hilo y el pie se reparten el espacio que queda, y el pie queda
justo encima del teclado. El hilo es lo que cede —tiene `min-height: 0`— y la cabecera y el
pie no se encogen (RF-F50).

La variable la publica el componente en la raíz:

```tsx
<section class="chatbox" style={{ "--chatbox-keyboard-inset": `${keyboardInset}px` }}>
```

### El hook

`useKeyboardInset(root)` mide y devuelve el inset:

- escucha el `resize` y el `scroll` del `visualViewport` (el teclado abre y cierra), y el
  `resize` y el `scroll` de la ventana (la barra del navegador cambia el viewport visual);
- si no hay teclado, no mide la caja: el `getBoundingClientRect()` obliga al navegador a
  recalcular el layout, y no hay nada que reserving;
- publica el inset con un estado, para que el CSS lo aplique y el componente se entere.

### El hilo

```tsx
useLayoutEffect(() => {
	if (previousKeyboardInset.current === keyboardInset) return;
	previousKeyboardInset.current = keyboardInset;
	const element = conversationRef.current;
	if (!element || !following.current) return;
	element.scrollTo({ top: element.scrollHeight, behavior: currentScrollBehavior("seguimiento") });
}, [keyboardInset]);
```

Es un efecto de **layout** y no uno normal (D11): el `scroll` que el navegador dispara al
encogerse el hilo puede llegar antes que un efecto normal, y entonces el hilo se quedaría
a medias.

### Inventario y guarda

- `test/virtual-keyboard.ts`: fuente única del nombre de la variable, de su valor de reserva
  y de la guarda. Una función pura, `findKeyboardViolations(root)`, que devuelve las razones
  por las que una hoja viola el contrato.
- `test/unit/chatbox-virtual-keyboard.test.ts` (**mecanismo**):
  - la raíz declara `padding-bottom: var(--chatbox-keyboard-inset, 0px)`;
  - ninguna otra regla —tampoco dentro de un `@media`— vuelve a declarar ese padding, ni
    el lógico (`padding-block-end`), ni con un atajo (`padding`, `padding-block`);
  - el padding no lee una safe area (la safe area va en las regiones, RF-F50) ni usa
    unidades de viewport (la franja se mide, no se declara);
  - la guarda **rechaza**: una raíz sin franja, una franja con un valor fijo, una sin valor
    de reserva, una que lee una safe area, una en unidades de viewport, una segunda regla
    que la declara —también si la alcanza por otro camino, como `[data-theme="dark"]
    .chatbox` o `.chatbox.chatbox--flotante`—, y el atajo `padding`.
- `test/unit/chat/domain/visual-viewport.test.ts` (**mecanismo**, la regla): la zona
  visible, la franja que tapa el teclado, el anclaje inferior y el inset reservado, con
  una entrada que rechaza en cada caso.
- `test/browser/virtual-keyboard.spec.ts` (**resolución**): con el teclado simulado, el pie y
  el campo de texto quedan por encima del teclado; el pie queda justo en el borde de la zona
  visible; la reserva no desaparece al desplazar la página ni crece con la altura
  automática; con el viewport visual desplazado, el pie queda en el borde de la zona
  visible; un widget cuyo pie queda por encima del teclado no reserva nada; el hilo vuelve al
  final al abrir el teclado —y el último mensaje se compara con el **teclado**, no con el
  hilo, que es lo que lo hace morder— y no arrastra a quien se ha apartado. Cada
  comprobación tiene su **entrada que rechaza**: sin la franja reservada el pie queda bajo el
  teclado y el último mensaje también, con una franja de más queda un hueco, y un apartarse
  del hilo no es seguirlo.

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/chat/domain/visual-viewport.ts` | Nuevo: zona visible, franja, anclaje e inset reservado |
| `src/chat/hooks/useKeyboardInset.ts` | Nuevo: mide con `visualViewport` y publica el inset |
| `src/components/Chatbox.tsx` | La raíz publica el inset y el hilo vuelve al final |
| `src/components/Chatbox.css` | La raíz reserva la franja del teclado |
| `src/style.css` | La demo presenta el chat a pantalla completa, como un sitio host que lo ocupa entero |
| `test/virtual-keyboard.ts` | Nuevo: nombre de la variable, valor de reserva y guarda |
| `test/unit/chatbox-virtual-keyboard.test.ts` | Nuevo: mecanismo y guarda |
| `test/unit/chat/domain/visual-viewport.test.ts` | Nuevo: la regla pura |
| `test/browser/virtual-keyboard.spec.ts` | Nuevo: resolución, con el teclado simulado |
| `test/unit/strings-inventory.test.ts` | La variable CSS entra en la lista blanca, derivada del contrato |
| `test/browser/scroll-follow.spec.ts` | Precondición del apartarse: el hilo tiene que desbordar |
| `TODO.md` | Marcar RF-F51 al cerrar |

## Criterios de aceptación

1. La zona visible se mide con `visualViewport` —`offsetTop` + `height`— y no con
   `innerHeight`: el teclado virtual encoge el viewport visual, no el de layout.
2. El widget reserva la parte de su borde inferior que queda bajo el teclado, y su pie —
   con el campo de texto— queda por encima del teclado.
3. La franja reservada es exacta: el pie queda en el borde de la zona visible.
4. Un widget cuyo pie queda por encima del teclado no reserva nada, y la reserva no
   desaparece al desplazar la página ni crece con la altura automática.
5. El hilo vuelve al final cuando la zona visible se encoge, si la persona lo seguía; y no
   arrastra a quien se ha apartado.
6. La guarda de nivel jsdom falla si se rompe cualquiera de las cosas, y el test tiene una
   entrada que rechaza de verdad en cada caso.
7. En Chromium, con el teclado simulado, el campo y el último mensaje quedan por encima del
   teclado; y cada comprobación tiene su entrada que rechaza.
8. `npm run verify` y `npm run test:browser` en verde.

## Riesgos

- **El sitio host puede poner `interactive-widget=resizes-content`**: entonces el teclado
  encoge el viewport de layout y `dvh` ya valdría. El widget reservaría franja de más. No
  es un daño: el pie quedaría más arriba del teclado, no debajo.
- **La altura automática del host**: el widget reserva espacio debajo de su contenido, así
  que su caja necesita medir lo que el host le da (RF-F50). Un host que le dé una altura
  automática hace que la caja crezca al abrir el teclado —con el tope de `100dvh` como
  límite—.
- **La altura mínima del widget**: con el teclado abierto, la zona visible puede no dar para
  la cabecera y el pie. Es el mismo límite que RF-F50 declara para la altura del widget.
- **jsdom no mide**: todo lo que sea tamaño real es trabajo del nivel de Chromium.
- **Chromium no emula el teclado**: el escenario lo simula. Lo que no cubre —la forma en que
  un iPhone real mueve el viewport visual al abrir el teclado— queda fuera, y es lo que
  RF-F51 deja sin nivel manual.

## Verificación

```bash
npm run verify        # lint + typecheck + build + test -- --run
npm run test:browser  # suite de Playwright (Chromium)
```

Los tests de navegador necesitan Chromium instalado. Es el mismo par de comandos que ejecutan
el hook pre-commit y CI.

## Referencias

- Requisito: `../../docs/stitch-frontend-design/SPEC-FRONTEND.md` (RF-F51).
- Decisión: `../../docs/decisions/011-teclado-virtual.md`.
- Glosario: `../../GLOSSARY.md` (RF-F51).
- Patrones heredados: `../../docs/decisions/002-css-theming-test-strategy.md`,
  `../../docs/decisions/007-objetivos-tactiles.md`,
  `../../docs/decisions/010-viewport-movil.md`.
- Issue: #119.
