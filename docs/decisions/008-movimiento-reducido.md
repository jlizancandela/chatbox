# Decisión 008: contrato y verificación de movimiento reducido del chatbox

## Estado

Aceptada (2026-10-22).

## Contexto

RF-F44 fija que con `prefers-reduced-motion` el indicador "escribiendo" no se animará y el
scroll no será suave.

La auditoría del 2026-10-22 sobre el widget real encontró que el widget **no cumple el
requisito, y que casi no hay nada que cumplir**:

1. **El widget no tiene ni una animación.** Cero `@keyframes`, cero `transition`, cero
   `animation` en todo `frontend/src/`. El único bloque que menciona movimiento es
   `@media (prefers-reduced-motion: reduce)` en `Chatbox.css:427`, que no desactiva nada
   porque no hay nada que desactivar.
2. **El indicador no es animable.** `ChatMessages.tsx:36` pinta el texto plano "El asistente
   está escribiendo". "El indicador no se animará" no tiene sujeto.
3. **El scroll de «Ir al final» es suave siempre.** `scrollToEnd()` (`Chatbox.tsx:132`) usa
   `behavior: "smooth"` sin mirar la preferencia, y el botón lo llama sin argumentos. Este es
   el incumplimiento real de RF-F44.
4. **El autoscroll sí está condicionado** (`Chatbox.tsx:106`). Los dos caminos de scroll se
   condicionan por separado, y el que se cuidó fue el otro.
5. **El `scroll-behavior: auto` del bloque CSS no puede arreglar el punto 3**: la opción
   `behavior` de `scrollTo()` gana sobre la propiedad CSS.
6. **La regla blanket es frágil**: `.chatbox *` tiene especificidad (0,1,0), y cualquier
   selector más específico la supera. No es una garantía, es una sugerencia.
7. **No existe ninguna comprobación de movimiento en el repo.** El cumplimiento, si lo
   hubiera, sería accidental, igual que el contraste antes de RF-F42 y que los 44 px antes de
   RF-F43.

El problema de fondo no era el movimiento: era que **no había contrato**. Una comprobación
suelta se queda vieja en la siguiente modificación de estilos, y un RF de accesibilidad que
no puede detectar su propia regresión se cierra con un sello falso. La Decisión 002 estableció
el patrón de dos niveles para el CSS y el theming —verificación de **mecanismo** en jsdom y de
**resolución** en Chromium—, la Decisión 006 lo aplicó al contraste y la Decisión 007 a los
objetivos táctiles. El patrón sigue vigente y no se toca.

A esto se suma un vacío de diseño: el export de Stitch lleva tres puntos botando en la
burbuja del asistente vacío, y el widget no los tiene.

## Decisión

El movimiento reducido del widget es un **contrato**, no una lista de comprobaciones:

1. **El requisito se cumple construyendo el indicador que el diseño pide.** Tres puntos
   botando en la burbuja del asistente vacío, como en el export de Stitch. El texto "El
   asistente está escribiendo" deja de pintarse en la burbuja: queda solo en la región de
   estado, que ya lo muestra y ya lo anuncia (RF-F41). Hoy la frase aparece dos veces; con
   los puntos, una sola.
2. **Los puntos son decorativos** (`aria-hidden`). El anuncio vive en la región de estado y no
   se duplica texto audible.
3. **La variante con movimiento reducido son los mismos tres puntos sin animación.** Cambia el
   movimiento, no la forma: no hay un diseño alternativo que mantener.
4. **La animación se declara dentro de `@media (prefers-reduced-motion: no-preference)`.**
   Con movimiento reducido la animación **no se declara**, así que `animation-name` es `none`
   por ausencia y no por sobrescritura. No hay guerra de especificidad: nada que revivir.
   El precio es explícito —un navegador que no conoce la media query no ve la animación— y
   degrada hacia el lado seguro.
5. **La regla blanket se queda, recortada.** `transition: none` y `animation: none` sobre
   `.chatbox *` protegen al subtree del widget frente al CSS que le meta un sitio host; el
   `scroll-behavior` sale de la regla global y pasa a la caja de scroll, que es donde el
   contrato lo necesita.
6. **Hay una sola política de scroll**, usada por el seguimiento del hilo y por el botón
   «Ir al final»: la regla decide en un solo sitio, con la **intención** como parámetro. El
   seguimiento es **instantáneo** —se actualiza con cada token, y una animación se reinicia
   en cada actualización y nunca llega, así que el hilo se quedaría a mitad de la respuesta— y
   el salto explícito es **animado**, salvo que la persona pida menos movimiento. Dos caminos
   con decisiones distintas y aplicadas por separado divergen en el próximo refactor, y el que
   divergió hoy fue el que nadie tocó. *(Enmienda del 2026-10-22: esta decisión decía «suave»
   para los dos. El diagnóstico de RF-F06 —issue #102— midió que con scroll suave el hilo se
   quedaba en el 1% de una respuesta de 8000 px, porque medir la distancia durante una
   animación da un falso «la persona se fue». Ver `docs/specs/frontend/RF-F06-seguimiento-del-hilo.md`.)*
7. **Bajo movimiento reducido el scroll pide `behavior: "auto"`**, no `"instant"`. `auto`
   delega en el `scroll-behavior` computado, y el contrato CSS declara `scroll-behavior: auto`
   en la caja de scroll: el CSS es el que garantiza el salto instantáneo. `"instant"` daría
   una garantía más fuerte, pero no lo garantizan todas las versiones de Safari y un enum
   inválido lanza `TypeError` — en un widget pensado para embeberse en hosts arbitrarios, un
   `TypeError` en un botón es un fallo visible.
8. **La regla de scroll es una función pura** en `src/chat/domain/motion.ts`: traduce "la
   persona pide menos movimiento" a `ScrollBehavior`. El componente lee la preferencia y la
   invoca. La regla se testea sin DOM; el `matchMedia` se queda donde vive, en el componente.
9. **La preferencia se lee al actuar**, sin suscripción a cambios y sin estado. La preferencia
   se cambia en la configuración del sistema operativo, no en caliente: un efecto y un estado
   para ese caso no se justifican.
10. **El contrato es un inventario y una guarda.** `test/motion.ts` declara las dos fuentes de
    movimiento del widget —el indicador de escritura y el scroll suave— y la guarda impide
    que aparezca una tercera: ninguna regla puede declarar `animation`, `transition` o
    `@keyframes` fuera del bloque `no-preference`, ni `scroll-behavior: smooth` en la caja de
    scroll, y el literal `"smooth"` no puede aparecer en `src/` fuera de la regla de scroll.
    La guarda es **bidireccional**: cada fuente del inventario tiene que existir en la hoja
    —*inventariado → declarado*— y nada puede animarse sobre un selector que no esté en el
    inventario —*declarado → inventariado*. Con una sola de las dos direcciones, una animación
    nueva se cuela en silencio: la primera deja pasar un indicador sin animación, la segunda
    deja pasar un tercer elemento que nadie inventarió.
11. **La identidad de cada fuente de movimiento es su selector CSS**, no un atributo de
    markup: el movimiento se declara en CSS y un atributo no añadiría detección.
12. **Dos niveles, con el nivel declarado en cada aserto**, igual que las Decisiones 002, 006 y
    007: **mecanismo** en jsdom/postcss (los bloques del contrato existen, la guarda morder) y
    **resolución** en Chromium (con `emulateMedia({ reducedMotion: "reduce" })`, los puntos no
    tienen `animation-name`, y ninguna llamada de scroll pide `"smooth"`).
13. **El caso positivo es obligatorio.** Con movimiento permitido, los puntos **sí** tienen
    animación. Sin ese aserto, el test negativo pasaría con un widget sin animación, y un
    detector cuyo test nunca falla no protege nada.
14. **No hay nivel manual.** El movimiento se resuelve con números, igual que el contraste y
    que el tamaño de los controles. No hay nada que solo una persona pueda comprobar.

## Consecuencias

- El widget cumple RF-F44 de verdad: con movimiento reducido no hay animación porque no se
  declara, y el scroll no es suave porque la regla lo dice en los dos caminos.
- El cumplimiento deja de ser accidental. La guarda hace que una animación nueva entre por la
  vía normal —dentro del bloque `no-preference`— y que un scroll suave introducido a mano
  rompa la compilación.
- La burbuja del asistente cambia: los puntos sustituyen al texto. La frase "El asistente está
  escribiendo" queda en un solo sitio, la región de estado, que es además la que se anuncia.
- Un navegador sin `prefers-reduced-motion` (Safari < 13, Chrome < 74) no ve la animación. Es
  una degradación hacia el lado seguro, asumida a conciencia y documentada.
- Un sitio host puede animar los elementos del widget con sus propias reglas y el `!important`
  de su hoja; la blanket del bloque `reduce` lo neutraliza mientras no use `!important`. Es un
  límite explícito, del mismo tipo que el `!important` sobre `button` de la Decisión 007.
- El literal `"smooth"` deja de estar libre en `src/`: la lista blanca del inventario de
  textos de RF-F62 lo permite porque es un valor técnico de CSSOM, pero la guarda de
  movimiento lo acota a la regla de scroll.
- El agrupado de tokens por `requestAnimationFrame` (RF-F11) **no** es movimiento: agrupa
  renders, no desplaza nada en pantalla. Queda fuera del RF y escrito, para que no se vuelva a
  abrir por sorpresa.

## Alternativas rechazadas

- **Solo CSS**: no hay detector. Una modificación de estilos posterior puede devolver una
  animación al widget sin que nada se entere, y el RF se cierra con un sello falso.
- **Solo Chromium**: el navegador de test no puede ver la ausencia de una declaración de
  animación que debería estar en el bloque correcto; el nivel de jsdom sí.
- **Solo jsdom**: verifica que el CSS declara la animación donde debe, no que el navegador la
  aplique y que la preferencia la quite.
- **Declarar la animación en la regla base y cancelarla en el bloque `reduce`**: es lo que hay
  hoy, y es frágil —`.chatbox *` (0,1,0) pierde contra cualquier selector más específico.
  Además obliga a que la guarda empareje cada regla animada con su cancelación.
- **Lo mismo, pero con `!important` en la cancelación**: gana a cualquier regla del widget, y
  un host con su propio `!important` puede revocarla. Preserva la animación en navegadores
  antiguos, a cambio de una garantía que deja de ser total.
- **`behavior: "instant"`**: la garantía más fuerte (la opción JS gana sobre cualquier CSS),
  pero con un `TypeError` en el botón «Ir al final» en las versiones de Safari que no lo
  conocen. Un widget universal no puede arriesgar eso.
- **Declarar `scroll-behavior: smooth` en la base y cancelarlo en el bloque `reduce`**: mismo
  problema de especificidad, y el valor inicial de `scroll-behavior` ya es `auto`, que ya
  significa salto instantáneo. La regla explícita solo sirve para tapar lo que el widget
  declare, y por eso la guarda vigila el `smooth`.
- **Una regla global `.chatbox * { scroll-behavior: auto }`**: reparte una propiedad global
  para resolver un problema local.
- **Suscribirse a los cambios de la preferencia** (`addEventListener("change")`): estado y
  efecto de suscripción para un caso que casi no ocurre —la preferencia se cambia en la
  configuración del sistema, no en caliente.
- **Un atributo de markup para identificar el indicador** (`data-chatbox-motion`): tres
  elementos decorativos con un atributo que no detecta nada que la guarda del CSS no detecte
  ya.
- **Contar el agrupado de tokens como movimiento**: destruiría el streaming a cambio de nada.
- **Nivel manual con checklist**: no hay nada que solo una persona pueda comprobar.
