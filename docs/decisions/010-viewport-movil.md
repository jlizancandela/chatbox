# Decisión 010: contrato y verificación del viewport móvil del chatbox

## Estado

Aceptada (2026-10-27).

## Contexto

RF-F50 fija tres cosas del widget en móvil: que la altura se dimensione con `dvh`, que se
respeten las `env(safe-area-inset-*)` y que el campo de texto use un `font-size` ≥ 16 px para
evitar el zoom automático de iOS Safari.

La auditoría sobre el widget real encontró que **las tres se cumplen a medias, y que ninguna
tiene contrato**:

1. **La altura no tiene tope.** La raíz declara `height: 100%` y nada más. La altura la da el
   contenedor del sitio host, que puede ser más alto que la pantalla: en un drawer a pantalla
   completa sobre un móvil, el pie del widget quedaría por debajo del borde visible. Y donde sí
   se declaraba una altura en unidades de viewport, la unidad correcta importa: `vh` mide el
   viewport con la barra del navegador **desplegada**, `dvh` la acompaña.
2. **`env(safe-area-inset-*)` no aparece en ninguna regla.** Con `viewport-fit=cover` —que es
   lo que hace falta para que el modo drawer llegue al borde de la pantalla— el notch y el
   indicador de inicio se comen el aviso de alcance de la cabecera y el botón de «Nueva
   conversación» del pie.
3. **El campo de texto declara `font-size: 1rem`.** 16 px, pero solo si la raíz del documento
   mide 16 px. `rem` se resuelve contra `:root`, y el widget está pensado para incrustarse en
   sitios arbitrarios (Paso 7 del TODO): un host con `html { font-size: 14px }` deja el campo en
   14 px, y iOS Safari amplía la página al enfocarlo.
4. **El atajo `font: inherit` fija también el tamaño.** La propiedad `font` incluye el tamaño,
   así que el atajo hereda también el 0.875rem del widget —14 px— al campo. Hoy no se nota: el
   `font-size: 1rem` de la regla del campo viene después y gana por orden de cascada, y el
   campo **medía 16 px** con una raíz de 16 px. Pero es un atajo que vuelve a neutro el suelo
   en cuanto cambie el orden de las reglas, y hace que «el tamaño del campo lo declara una
   sola regla» no sea decidible: dos declaraciones fijan el tamaño, y solo una gana.
5. **No hay contrato.** No hay ninguna comprobación de altura, de safe area ni de tamaño de
   fuente en el repo. El cumplimiento es accidental, igual que lo era el contraste antes de
   RF-F42.

El problema de fondo no era el CSS: era que **no había contrato**. Una comprobación suelta se
queda vieja en la siguiente modificación de estilos, y un RF que no puede detectar su propia
regresión se cierra con un sello falso. La Decisión 002 estableció el patrón de dos niveles
para el CSS y el theming —verificación de **mecanismo** en jsdom y de **resolución** en
Chromium—, y las Decisiones 006, 007, 008 y 009 lo aplicaron al contraste, a los objetivos
táctiles, al movimiento reducido y a los nombres accesibles. El patrón sigue vigente y no se
toca.

## Decisión

El viewport móvil del widget es un **contrato**, no una lista de comprobaciones:

1. **La altura la da el sitio host y el tope es el viewport dinámico.** La raíz declara
   `height: 100%` —el widget llena el contenedor que le den— y `max-height: 100dvh`: nunca es
   más alto que la pantalla, y el tope se ajusta con la barra del navegador. Es la misma
   asimetría que en el resto del widget: el host decide el tamaño, el widget garantiza el
   límite.
2. **`vh`, `svh` y `lvh` están prohibidas** para cualquier altura de la hoja del widget.
   `vh` y `lvh` miden el viewport con la barra desplegada —el pie quedaría fuera de la
   pantalla— y `svh` mide el más bajo: el widget no llenaría la pantalla cuando la barra se
   recoge. Solo `dvh` sigue a la barra. La guarda mira **toda** regla que declare una altura,
   no solo la de la raíz: una regla más específica ganaría por orden de cascada.
3. **La safe area se suma al padding base, nunca lo sustituye.** Cada región que toca un
   borde de la pantalla declara `max(<padding base>, env(safe-area-inset-<edge>, 0px))`. El
   notch empuja el contenido, pero el widget no pierde su propio espaciado: un `env()` a secas
   dejaría el widget sin padding en todos los móviles sin notch, que son la mayoría. El valor
   de reserva importa: sin él, un `env()` inválido en tiempo de valor calculado dejaría el
   borde en `unset` —es decir, sin padding— en vez de perder solo la safe area.
4. **El inset se aplica en las regiones, no en la raíz.** Ponerlo en el padding de la raíz
   escondería el fondo del widget en la franja del notch; en las regiones, el fondo llega al
   borde y el contenido se separa.
5. **El suelo de 16 px del campo de texto es absoluto.** La declaración es `max(1rem, 16px)`:
   nunca menos de 16 px —con la raíz del host a 14 px, `1rem` a secas no vale— y nunca menos de
   lo que la persona eligió en su navegador, que se respeta a través del `rem`.
6. **Una sola regla declara el tamaño del campo.** Ni el atajo `font` —que fija también el
   tamaño— ni una segunda regla. Una regla más específica, aunque llegue después, ganaría por
   orden de cascada y dejaría el campo por debajo del suelo sin que ninguno de los dos
   niveles se entere. Por eso el atajo `font: inherit` se sustituyó por las propiedades de la
   fuente heredadas una a una: el atajo fija el tamaño del campo y vuelve a neutro el suelo
   en cuanto el orden de las reglas cambia.
7. **La raíz del documento deja de ser una variable del contrato.** El widget cumple el suelo
   con cualquier `font-size` del host, igual que los 44 px de la Decisión 007.
8. **El suelo del campo tiene la forma `max(1rem, 16px)`, no cualquier suelo de 16 px.**
   `16px` a secas cumpliría el mínimo, pero ignoraría el tamaño de fuente que la persona
   eligió en su navegador. Y el término relativo tiene que ser `1rem` —el tamaño de la
   raíz—: `0.5rem` nunca valdría más que el suelo.
9. **El interlineado del campo acompaña a su tamaño.** La línea es `1.375`, sin unidad: el
   Stitch pide 22 px sobre 16 px, y un interlineado en px absolutos contradiría al tamaño de
   fuente que la persona eligió en su navegador. Ninguna regla que apunte al campo puede
   fijarlo en px absolutos.
10. **La guarda mira las reglas anidadas.** Una regla dentro de un `@media` que vuelva a
    declarar el padding de una región gana dentro de su media query, y dejaría el widget sin
    safe area. La guarda, por tanto, no se limita a las reglas de primer nivel: recorre
    todas, y calcula el padding efectivo en orden de cascada.
11. **El campo de texto se busca por sus tres nombres.** La etiqueta (`textarea`), el id que
    le pone el widget (`chatbox-question`) y la identidad del contrato de objetivos táctiles
    (`question-field`). Buscar solo uno dejaría fuera a los otros dos. Y se busca por patrón y
    no por trozo de texto: una clase que se llamara `chatbox__textarea` no es el campo, y una
    guarda que la tomara por el campo avisaría de algo que no es.
12. **Dos niveles, con el nivel declarado en cada aserto**: **mecanismo** en jsdom (las
    unidades, las declaraciones y la guarda) y **resolución** en Chromium (el tamaño de verdad).
13. **Los dos niveles no son redundantes, y fallan en direcciones opuestas.** El navegador de
    test tiene la raíz a 16 px, así que un `1rem` **pasa** la comprobación de Chromium y falla
    en un host con raíz de 14 px: solo el nivel de resolución lo ve, y lo ve porque el
    escenario inyecta una raíz de 14 px. Y al revés: Chromium no puede distinguir `vh` de
    `dvh` —no hay barra de navegador que se recoja en un escritorio—, así que solo el nivel de
    mecanismo ve esa regresión.
14. **La rama del inset solo se verifica en el nivel de mecanismo.** Chromium no emula safe
    areas: `env(safe-area-inset-*)` vale cero en todos los navegadores de escritorio. El nivel
    de resolución comprueba lo que sí puede —que el padding base sobrevive al `max()`—, y el
    mecanismo comprueba que el inset está en la declaración y que se suma al base. Es un
    límite explícito, no un hueco silencioso.
15. **`viewport-fit=cover` lo pone el sitio host, no el widget.** El widget no puede declarar
    la etiqueta `viewport` de la página que lo embebe. Sin ella, el navegador mantiene el
    contenido dentro de la zona segura y `env(safe-area-inset-*)` vale cero: el widget no
    tiene nada que separar. Es un requisito del sitio host, y está escrito.
16. **Cada comprobación tiene su entrada que rechaza.** El nivel de mecanismo, contra hojas
    escritas a mano; el nivel de resolución, inyectando el CSS roto en el navegador. Un
    detector cuyo test nunca falla no protege nada, y el repositorio lo exige desde RF-F43.
17. **No hay nivel manual.** La altura, el padding y el tamaño de fuente se resuelven con
    números. Lo que queda —que el notch no tape el texto en un iPhone real— es otra cosa, y
    pertenece a RF-F51.

## Consecuencias

- El widget no se sale por debajo de la pantalla aunque el contenedor del sitio host sea más
  alto, y su tope se ajusta con la barra del navegador en lugar de quedarse corto.
- El notch y el indicador de inicio ya no tapan el contenido, y el widget conserva su
  espaciado propio en los móviles que no tienen notch.
- El campo de texto ya no amplía la página en un sitio host con la raíz a 14 px, y sigue
  respetando el tamaño de fuente que la persona eligió en su navegador.
- La hoja del widget hereda las propiedades de la fuente una a una en lugar de con el atajo
  `font`. No se ve, pero es lo que hace el suelo decidible: el atajo queda prohibido en el
  campo, porque fija también el tamaño.
- El interlineado del campo pasa a ser unitless. Con el Stitch, 22 px sobre 16 px.
- El widget tiene una **altura mínima** por debajo de la cual su contenido no cabe entero: a
  390 px de ancho, en el estado vacío, la cabecera, el padding del hilo y el pie suman unos
  320 px. Es un límite del diseño, no del contrato —cambia con el diseño, no con el código— y
  el sitio host es quien decide el tamaño del contenedor.
- El sitio host que embebe el widget tiene que añadir `viewport-fit=cover` a su etiqueta
  `viewport`; sin eso, la mitad de RF-F50 no tiene efecto.
- RF-F51 (el teclado virtual y `visualViewport`) sigue pendiente: el teclado todavía puede
  tapar el campo, y eso no lo arregla el `dvh`.

## Referencias

- Requisito: RF-F50 de `docs/stitch-frontend-design/SPEC-FRONTEND.md`.
- Spec de implementación: `frontend/.specs/RF-F50-viewport-movil.md`.
- Issue: #117.

## Alternativas rechazadas

- **`height: 100dvh` en la raíz**: el widget se saldría de su contenedor en cualquier sitio
  host que lo embeba en una caja de altura propia. El tope es lo que se necesita, no la
  altura.
- **`max-height: 100vh`**: es el viewport con la barra desplegada, o sea el más alto de los
  tres. En móvil deja el pie fuera de la pantalla, que es exactamente lo que RF-F50 viene a
  arreglar.
- **`env(safe-area-inset-*)` sin `max()`**: el widget perdería su padding en todos los
  dispositivos sin notch, que son la mayoría. La safe area es una restricción del entorno,
  no un sustituto del diseño.
- **`env()` sin valor de reserva**: un `env()` inválido en tiempo de valor calculado deja la
  declaración en `unset`, y el borde se queda sin padding en vez de perder solo la safe area.
  Con la reserva, la declaración es válida siempre.
- **La safe area en el padding de la raíz**: escondería el fondo del widget en la franja del
  notch y dejaría un escalón visible entre la cabecera y el borde de la pantalla.
- **Un token `--chatbox-safe-area-*`**: el sitio host podría anular la safe area en silencio.
  El inset es del entorno, no del tema. El suelo —el padding base— sí es del widget, y vive
  dentro del `max()`, donde nadie lo toca.
- **`font-size: 16px` a secas**: cumple el suelo, pero ignora el tamaño de fuente que la
  persona eligió en su navegador, que es una preferencia de accesibilidad.
- **`font-size: 1rem`**: vuelve a depender de la raíz del sitio host, que es justo el
  problema.
- **Dejar el `font: inherit` y confiar en la cascada**: el atajo fija también el tamaño del
  campo, así que vuelve a neutro el suelo en cuanto el orden de las reglas cambia. Y con dos
  declaraciones del tamaño, «el suelo lo declara una sola regla» deja de ser decidible.
- **Nivel manual con checklist en un iPhone real**: lo que se puede medir con números, se
  mide con números. Lo que queda es para RF-F51.
