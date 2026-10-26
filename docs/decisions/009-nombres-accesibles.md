# Decisión 009: contrato y verificación de los nombres accesibles del chatbox

## Estado

Aceptada (2026-10-26).

## Contexto

RF-F45 fija que el campo de texto tenga etiqueta asociada, que los botones solo-icono tengan
`aria-label` y que el componente declare `lang="es"`.

La auditoría del 2026-10-26 sobre el widget real encontró que el widget **cumple el
requisito, y que casi no hay nada que cumplir**:

1. **Las tres cláusulas se cumplen ya en el markup.** El campo de texto tiene su etiqueta
   (`ChatInput.tsx`), y la raíz del widget declara `lang="es"` (`Chatbox.tsx`).
2. **La cláusula de los botones solo-icono no tiene sujeto.** No existe ningún botón de icono
   en el widget: los siete controles tienen texto visible. La regla no puede comprobarse
   porque no hay nada que comprobar.
3. **La comprobación que existía era vacía.** `test/component/chatbox-behavior.test.tsx`
   recorria los botones con `forEach` y comprobaba el `aria-label` **solo en los que no tienen
   texto visible**. Todos lo tienen, así que la rama interior no se ejecutaba nunca: el test
   pasaba con el mecanismo roto.
4. **Solo se miraba el estado vacío.** Los controles que solo existen con la confirmación
   abierta o con el hilo desplazado («Ir al final») no se comprobaban nunca.
5. **Nadie preguntaba al árbol de accesibilidad.** El nombre accesible de un control no lo
   decide el código: lo computa el navegador, con sus reglas de nombre desde el contenido, desde
   `aria-label` y desde la etiqueta asociada. Nada en el repo lo preguntaba.

El problema de fondo era el mismo que resolvieron RF-F42, RF-F43 y RF-F44: **no había
contrato**. Una comprobación suelta se queda vieja en la siguiente modificación, y un RF de
accesibilidad que no puede detectar su propia regresión se cierra con un sello falso. La
Decisión 002 estableció el patrón de dos niveles para el CSS y el theming —verificación de
**mecanismo** en jsdom y de **resolución** en Chromium—, la Decisión 006 lo aplicó al
contraste, la 007 a los objetivos táctiles y la 008 al movimiento reducido. El patrón sigue
vigente y no se toca.

## Decisión

Los nombres accesibles del widget son un **contrato**, no una lista de comprobaciones:

1. **No cambia el markup.** El widget ya cumple RF-F45. Lo que faltaba era la garantía, y
   garantizarla no exige tocar `src/`: la Decisión 007 y la 008 tampoco lo hicieron.
2. **El contrato son reglas, no un inventario de controles.** A diferencia de RF-F43, que
   necesita inventariar cada control porque cada uno tiene su propio estado y su propia medida,
   aquí la regla es uniforme: se aplica a todo control que aparezca. El inventario del widget
   es de *reglas*, y por eso no hay que actualizarlo cada vez que aparece un control nuevo.
3. **La guarda mira el código.** Escanea `src/**/*.tsx` —salvo `src/dev/`, que son fixtures que
   no se distribuyen— con `@babel/parser`, el mismo patrón que el inventario de textos de RF-F62
   y que la guarda de objetivos táctiles de RF-F43. Cuatro reglas:
   - **R1 · Etiqueta asociada**: un campo de formulario tiene nombre por una etiqueta que lo
     asocia, o por `aria-label`/`aria-labelledby`.
   - **R2 · Nombre accesible**: un control activable tiene nombre: texto visible, `aria-label` o
     `aria-labelledby`.
   - **R3 · Botón solo-icono**: un `button` sin texto visible declara `aria-label` o
     `aria-labelledby`.
   - **R4 · Idioma del widget**: la raíz del widget declara `lang="es"`.
4. **R2 y R3 no se solapan.** Un botón sin texto se informa una sola vez, con el mensaje que
   explica qué le falta. Informar dos veces del mismo problema es ruido que esconde el
   problema.
5. **«Tiene texto visible» se decide sin adivinar.** Un hijo cuenta como texto si es `JSXText`
   con contenido o una expresión que no sea un elemento JSX; una expresión que no se puede
   resolver cuenta como texto. Ante la duda se avisa de más: el coste de equivocarse es un
   aviso que se revisa a mano, y el de la otra dirección es un control sin nombre que pasa
   desapercibido. Lo que es `aria-hidden` no cuenta como texto: un `×` decorativo no es el
   nombre de un botón. Se reconocen las dos formas de escribirlo —`aria-hidden="true"` y
   `aria-hidden={true}`—, porque si solo se reconociera la primera, un icono decorativo
   contado como texto dejaría pasar un botón solo-icono sin nombre.
6. **El contrato acepta `aria-label` o `aria-labelledby`.** La especificación dice `aria-label`;
   `aria-labelledby` nombra lo mismo por otra vía y no tiene sentido excluirla de un contrato.
   Los tres niveles —mecanismo, componente y resolución— aplican **la misma regla**, sacada
   del propio contrato: una copia de la regla en cada test es una regla que puede divergir.
7. **Una etiqueta que envuelve al campo también lo nombra.** La guarda acepta las dos formas de
   asociar (`for`/`id` y la etiqueta envolvente). Marcar como falta de etiqueta a un campo
   legítimamente etiquetado sería un falso positivo que enseñaría a ignorar la guarda.
8. **La raíz del widget es la que declara el idioma.** Se comprueba sobre el elemento que lleva
   la clase del widget, no sobre cualquier elemento: un `lang` en una esquina del widget no
   declara el idioma de sus textos. El nivel de resolución comprueba el **idioma efectivo** —el
   `lang` más cercano en el árbol—, y comprueba además que ese `lang` más cercano **sea la raíz
   del widget**: si no lo fuera, el widget estaría heredando el idioma del sitio host, y con un
   host en español la comprobación del valor del atributo habría pasado sin querer.
9. **Dos niveles, con el nivel declarado en cada aserto**, igual que las Decisiones 002, 006, 007
   y 008: **mecanismo** en jsdom (el código nombra todo lo que nombra) y **resolución** en
   Chromium (el árbol de accesibilidad real le pone nombre a todo lo que lo tiene).
10. **Los dos niveles no son redundantes.** El mecanismo ve un `aria-label` declarado con un
    valor que el navegador ignora; la resolución ve el nombre que de verdad se anuncia. Solo la
    resolución ve que un control `aria-hidden` no está en el árbol: `ariaSnapshot()` de un
    control así viene vacío, que es una tercera forma de quedarse mudo.
11. **Los estados salen del contrato, no de los tests.** El contrato declara los estados en los
    que se comprueba (`NAME_STATES`) y los escenarios del navegador son un
    `Record<NameState, …>`: **añadir un estado al contrato rompe la compilación** hasta que
    exista su escenario. La clase del widget y la identidad de control también se toman del
    contrato y del inventario de RF-F43: dos definiciones que divergen son dos contratos.
12. **El caso positivo es obligatorio.** Cada regla tiene su entrada que rechaza de verdad, y se
    comprobó que las guardas muerden: quitar la etiqueta del campo, convertir «Ir al final» en
    un botón solo-icono sin nombre, o quitar el `lang` de la raíz ponen los tests en rojo en los
    dos niveles. El nivel de resolución **no tiene sujeto en el widget real** —no hay ningún
    botón solo-icono—, así que su entrada que rechaza **inyecta** uno en el DOM; el nivel de
    componente hace lo mismo con un botón de icono. Sin ese aserto, el test negativo pasaría con
    un widget sin contrato, y un detector cuyo test nunca falla no protege nada.
13. **No hay nivel manual.** El nombre accesible se resuelve preguntando al árbol de
    accesibilidad. Lo que queda es si el texto *suena* bien, que es otra cosa: el contrato no
    audita la fonética. RF-F41 se cerró sin nivel manual (issue #113): el texto que se
    anuncia es el mismo que se ve en la burbuja.

## Consecuencias

- El widget cumple RF-F45 de verdad y, sobre todo, **sigue cumpliéndolo**: el cumplimiento deja
  de ser accidental.
- Un botón de icono futuro entra en el widget por la vía normal —si no lo nombra, la guarda
  rompe la compilación— y no necesita una excepción silenciosa.
- La comprobación del test de componente deja de ser un bucle vacío: pasa a ser una aserción
  real sobre todos los botones, verificada en rojo contra un botón sin nombre.
- Ninguna línea de `src/` cambia. El coste del contrato es el escáner y sus dos niveles de
  verificación.
- La regla del idioma depende de la clase raíz: si el widget pasa a montar su raíz con una
  clase dinámica, la guarda deja de encontrarlo y hay que actualizar el contrato. Es un aviso
  explícito, no un silencio.
- El contrato es más estrecho que «todo control tiene nombre» en un punto: no cubre los
  `aria-label` de los enlaces en línea ni los textos decorativos `aria-hidden`, que no son
  controles. Queda escrito aquí para que nadie lo lea como un olvido.

## Alternativas rechazadas

- **Solo tests de componente**: characterizes una instancia afortunada del widget, en un
  estado, y no detectan el código que nombra mal. Es lo que había, y era vacío.
- **Solo axe**: axe detecta contenidos sin nombre, pero no comprueba el idioma del componente, no
  vigila el código y no cubre los estados en los que un control solo aparece.
- **Un inventario de controles con su nombre, como en RF-F43**: un control nuevo obliga a
  actualizar el inventario, y el nombre de un control no es un dato del widget sino el
  resultado de una regla. El inventario de reglas no se queda viejo.
- **Comprobar solo que el `aria-label` existe**: un `aria-label` con un valor vacío o con un
  valor que el navegador ignora no nombra nada. Solo la resolución lo ve.
- **Exigir `aria-label` a los botones con texto visible**: el texto visible *es* el nombre, y
  taparlo con un `aria-label` es peor (rompe el «nombre en la etiqueta» de WCAG 2.5.3).
- **Nivel manual con checklist**: el nombre accesible se resuelve preguntando al árbol de
  accesibilidad. No hay nada que solo una persona pueda comprobar.
