# Decisión 011: contrato y verificación del teclado virtual del chatbox

## Estado

Aceptada (2026-10-27).

## Contexto

RF-F50 fijó tres cosas del widget en móvil: que la altura se dimensione con `dvh`, que se
respeten las `env(safe-area-inset-*)`) y que el campo de texto use un `font-size` ≥ 16 px
para evitar el zoom automático de iOS Safari.

Dejó también un cabo suelto, escrito en su propia decisión: **«RF-F51 (el teclado virtual
y `visualViewport`) sigue pendiente: el teclado todavía puede tapar el campo, y eso no lo
arregla el `dvh`»**. Esta es esa decisión.

El problema de fondo es que **el `dvh` de RF-F50 no ve el teclado virtual**, y el motivo no
es un detalle de implementación:

1. **El navegador tiene dos viewports.** El **de layout** es el que coloca el contenido y el
   que miden las unidades `vh`, `svh`, `lvh` y `dvh`. El **visual** es la parte de ese que
   está de verdad en la pantalla. El teclado virtual encoge **el visual** y deja el de
   layout como estaba: por eso `100dvh` sigue midiendo lo mismo con el teclado abierto, y
   el pie del widget —donde vive el campo de texto— queda bajo el teclado.
2. **La zona visible solo la publica `window.visualViewport`.** Su `height` mengua cuando
   aparece el teclado, y su `offsetTop` dice dónde está el borde superior de lo que se ve.
   Con los dos se sabe exactamente qué franja de la pantalla está tapada.
3. **El navegador no puede arreglarlo por sí solo.** Cuando se enfoca un campo, el navegador
   desplaza la página para dejarlo a la vista. Eso funciona con un widget embebido en una
   página —que forma parte del flujo— y **no** con un widget anclado a la pantalla: un cajón
   a pantalla completa o un panel flotante. En ese caso el widget tiene que apartarse del
   teclado por su cuenta.
4. **El hilo tampoco se entera.** Al encogerse la zona visible, el hilo se encoge y su
   último mensaje se sale de la vista: la persona está escribiendo y no ve la conversación.
5. **No hay contrato.** No hay ninguna comprobación del teclado virtual en el repo. El
   cumplimiento sería accidental, igual que lo era el contraste antes de RF-F42.

La Decisión 002 estableció el patrón de dos niveles para el CSS y el theming —verificación
de **mecanismo** en jsdom y de **resolución** en Chromium—, y las Decisiones 006 a 010 lo
aplicaron al contraste, a los objetivos táctiles, al movimiento reducido, a los nombres
accesibles y al viewport móvil. El patrón sigue vigente y no se toca.

## Decisión

El teclado virtual del widget es un **contrato**, no una lista de comprobaciones:

1. **La zona visible se mide con `visualViewport`, no con `innerHeight`.** La banda que está
   en la pantalla va de `visualViewport.offsetTop` a
   `visualViewport.offsetTop + visualViewport.height`. Todo lo que queda por debajo está bajo
   el teclado. Medirlo con `innerHeight` —el viewport de layout— daría siempre una franja
   de cero, que es exactamente el bug. Y la altura del viewport de layout es la de su bloque
   contenedor inicial (`documentElement.clientHeight`), no `innerHeight`: esa incluye la barra
   de desplazamiento horizontal y el `visualViewport` no, así que con barra horizontal
   `innerHeight` daría una franja de teclado fantasma y el widget reservaría sitio sin que
   haya teclado.
2. **El widget reserva la franja en su raíz.** La raíz declara
   `padding-bottom: var(--chatbox-keyboard-inset, 0px)`, con `box-sizing: border-box`: el
   `padding` recorta la caja de contenido, así que el pie —el último hijo— queda por encima
   del teclado. Se reserva **debajo** del contenido y no moviendo la caja: el sitio host
   manda en el tamaño del widget (RF-F50) y el widget solo se ocupa de su contenido.
3. **La franja es exactamente la que hace falta.** Es la parte del borde inferior del widget
   que queda bajo el teclado. Ni un píxel más —el campo tapado— ni uno menos —un hueco entre
   el pie y el teclado.
4. **El widget solo se ajusta si está anclado al borde inferior de la pantalla.** Es la
   condición que decide si el problema existe: un widget embebido en una página lo
   desplaza el navegador por su cuenta, y reservar franja de más solo encogería el hilo.
   La condición es geométrica y no una bandera que el sitio host pueda forget: el borde
   inferior de la caja del widget llega al borde inferior de la pantalla.
5. **La franja se mide, no se declara.** El valor sale de `visualViewport` en tiempo de
   ejecución y viaja como una variable CSS en la raíz. Declararla en unidades de viewport
   volvería a meter el `dvh` de RF-F50 en un sitio donde no vale.
6. **La variable lleva su valor de reserva.** Sin teclado la franja es cero; sin reserva, un
   `var()` inválido dejaría el pie del widget sin su sitio.
7. **La franja va en la raíz y no en las regiones.** Lo que se sale de debajo de la pantalla
   es la caja entera, y el pie es su último hijo. Es lo contrario de la safe area, que va en
   las regiones (Decisión 010): la safe area la publica el navegador como `env()` y es del
   entorno; la franja del teclado se mide y es de la caja.
8. **El hilo no pierde su final.** Cuando la zona visible se encoge, el hilo vuelve al final
   si la persona lo seguía, y no se la arrastra si se apartó.
9. **El recolocamiento del hilo es un efecto de layout, no uno normal.** Al encogerse el
   hilo, el navegador dispara un `scroll` que parece que la persona se ha apartado —el
   final está más lejos— y ese aviso puede llegar antes que un efecto normal. Con un efecto
   normal, el hilo se quedaría a medias y aparecería el botón «Ir al final» sin motivo.
10. **La regla vive en el dominio, y el contrato con la hoja en los tests.**
    `src/chat/domain/visual-viewport.ts` tiene las reglas puras —zona visible, franja,
    anclaje, inset— porque el widget las necesita en ejecución. `test/virtual-keyboard.ts`
    tiene el nombre de la variable, su valor de reserva y la guarda, como `test/viewport.ts`
    en RF-F50. La guarda alcanza la raíz del widget por su **último compuesto** —`.chatbox`,
    `[data-theme="dark"] .chatbox`, `.chatbox.chatbox--flotante`—, no solo con el selector
    exacto: una regla que la alcance por otro camino también puede volver a declarar el
    padding y ganar por orden de cascada.
11. **Dos niveles, con el nivel declarado en cada aserto**: **mecanismo** en jsdom (las
    unidades, las declaraciones y la guarda) y **resolución** en Chromium (la geometría de
    verdad).
12. **Los dos niveles no son redundantes.** El nivel de mecanismo ve lo que el navegador no
    distingue —que la franja no se declara en unidades de viewport, que solo la declara una
    regla—; el de resolución ve lo que jsdom no mide —dónde queda el pie con el teclado
    abierto— y el escenario le inyecta un `visualViewport` encogido, que en el escritorio no
    ocurre nunca.
13. **Chromium no emula un teclado virtual, y el escenario lo simula.** El sustituto
    encoge la altura del `visualViewport` y dispara su `resize`, que es lo que el navegador
    publica cuando el teclado abre. Es un límite explícito: lo que no cubre —la forma en que
    un iPhone real mueve el viewport visual— no se puede medir en un escritorio.
14. **Cada comprobación tiene su entrada que rechaza.** El nivel de mecanismo, contra hojas
    escritas a mano; el de resolución, inyectando el CSS roto en el navegador. El último
    mensaje se compara con el **teclado** y no con el hilo: comparado con el hilo, la
    comprobación pasaría con el hilo sin encoger, que es justo el defecto que tiene que
    detectar.
15. **No hay nivel manual.** La franja que se reserva, dónde queda el pie y dónde queda el
    último mensaje se resuelven con números. Lo que queda —que el teclado de un iPhone real
    se comporte como dice el estándar— es otra cosa, y no hay forma de medirla aquí.
16. **`interactive-widget=resizes-content` lo pone el sitio host, no el widget.** Esa
    etiqueta de `viewport` haría que el teclado encogiera el viewport de layout —y entonces
    `dvh` valdría—, pero es del sitio host, como `viewport-fit=cover` (Decisión 010), y no
    funciona en Safari. El widget no puede depender de ella, y no la necesita.

## Consecuencias

- El campo de texto y el último mensaje quedan por encima del teclado virtual en un chat
  que ocupa la pantalla, que es el formato en el que el problema se daba.
- El widget no toca su propio tamaño: sigue siendo el sitio host quien lo mide. Lo único que
  hace es dejar de meter contenido bajo el teclado.
- Un widget embebido en una página no se toca: el navegador ya lo desplaza al enfocar el
  campo, y ahora el widget tampoco le reserva franja de más.
- El hilo deja de perder su final cuando la zona visible se encoge, y deja de arrastrar a
  quien se ha apartado.
- El widget tiene una variable CSS más en su raíz. Es del widget —no la puede anular el
  sitio host en silencio, porque la publica el propio widget—, y su valor lo decide el
  navegador.
- El sitio host que embebe el widget puede añadir `interactive-widget=resizes-content` a su
  etiqueta `viewport` y entonces el teclado encogería el viewport de layout. El widget
  reservaría franja de más: el pie quedaría más arriba del teclado, no debajo. No es un
  daño, pero conviene saberlo.
- Un sitio host que le dé al widget una altura automática en vez de una altura —RF-F50 pide
  que la altura la dé el host— hace que la caja del widget crezca al abrir el teclado, con
  el tope de `100dvh` como límite.

## Referencias

- Requisito: RF-F51 de `docs/stitch-frontend-design/SPEC-FRONTEND.md`.
- Spec de implementación: `frontend/.specs/RF-F51-teclado-virtual.md`.
- Issue: #119.

## Alternativas rechazadas

- **`min-height` del viewport visual con `100dvh`**: `dvh` mide el viewport de layout, que
  el teclado no encoge. Es el mismo error que RF-F50 ya corrigió para la barra del
  navegador, repetido con el teclado.
- **`interactive-widget=resizes-content` como solución**: la etiqueta `viewport` la pone el
  sitio host, no el widget —como `viewport-fit=cover`—, y no funciona en Safari. El widget
  tiene que poder resolverlo por su cuenta.
- **Mover la caja del widget con `transform`**: la caja entera se sale de la pantalla por
  arriba, y con ella la cabecera: el aviso de alcance y el título desaparecen. Reservar la
  franja debajo del contenido no sacrifica nada.
- **Bajar el `max-height` de la raíz a la zona visible**: funciona con un widget anclado
  arriba, pero con un panel flotante anclado por su borde inferior la caja crecería hacia
  arriba en vez de subir, y el pie seguiría bajo el teclado.
- **Medir la franja con `innerHeight`**: `innerHeight` es el viewport de layout, que el
  teclado no encoge. La franja saldría cero y el bug seguiría ahí, con un contrato que
  parece cumplirlo.
- **Reservar siempre la franja del teclado, también con el widget embebido**: el navegador
  ya desplaza el widget embebido al enfocar el campo. Reservar de más solo encogería el
  hilo y movería el botón «Ir al final».
- **Un modo «pantalla completa» que active el sitio host**: la condición es geométrica y
  automática. Un widget anclado abajo se ajusta solo, sin que el sitio host tenga que
  acordarse de nada.
- **Un efecto normal para recolocar el hilo**: el `scroll` que dispara el encogimiento del
  hilo puede llegar antes, y el hilo se quedaría a medias con el botón «Ir al final»
  apareciendo sin motivo.
- **Nivel manual con checklist en un móvil real**: lo que se puede medir con números, se
  mide con números. Lo que queda es el comportamiento del teclado de un iPhone real, que no
  se puede medir en un escritorio.
