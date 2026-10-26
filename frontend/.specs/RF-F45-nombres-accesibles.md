# RF-F45 — Los nombres accesibles del widget son un contrato

> Convención del proyecto: un spec por RF en `.specs/`, decisiones de proceso en
> `docs/decisions/` de la raíz, glosario en `GLOSSARY.md` de la raíz.
>
> Issue: #112.

## Auditoría (por qué no es un retoque de markup)

RF-F45 pide tres cosas: que el campo de texto tenga etiqueta asociada, que los botones
solo-icono tengan `aria-label` y que el componente declare `lang="es"`.

Las tres se cumplen hoy en el widget, y se cumplen **por casualidad**:

| Cláusula | Estado real | Evidencia |
|---|---|---|
| El campo de texto tiene etiqueta asociada | Se cumple | `src/components/ChatInput.tsx`: `<label for="chatbox-question">` + `<textarea id="chatbox-question">` |
| Los botones solo-icono tienen `aria-label` | **Vacuo** | No existe ningún botón solo-icono: los siete controles del widget tienen texto visible |
| El componente declara `lang="es"` | Se cumple | `src/components/Chatbox.tsx`: `<section class="chatbox" lang="es">` |

El problema de fondo es el mismo que resolvieron RF-F42, RF-F43 y RF-F44: **no había
contrato**. Una comprobación suelta se queda vieja en la siguiente modificación, y un RF de
accesibilidad que no puede detectar su propia regresión se cierra con un sello falso.

Dos hechos concretos:

1. **La cláusula de los botones solo-icono no tenía sujeto.** La Decisión 007 ya lo dejó
   escrito: «un botón de icono futuro entra en el contrato por la vía normal». Ese futuro
   llega sin contrato: un botón con un icono entra en el widget y un lector de pantalla
   anuncia «botón», sin más.
2. **La comprobación que existía era vacía.** `test/component/chatbox-behavior.test.tsx`
   recorria los botones con `forEach` y comprobaba `aria-label` **solo en los que no tienen
   texto visible**. Todos lo tienen, así que la rama interior no se ejecutaba nunca: el test
   pasaba con el mecanismo roto. Es exactamente el «detector cuyo test nunca falla no protege
   nada» que `frontend/AGENTS.md` prohíbe.

Además, la cobertura se quedaba en el estado vacío: los controles que solo existen con la
confirmación abierta o con el hilo desplazado («Ir al final») no se comprobaban nunca, y nadie
preguntaba al árbol de accesibilidad qué nombre recibe de verdad cada control.

## Síntesis (decisiones acordadas, 2026-10-26)

- **D1 — Alcance del trabajo**: **contrato + guarda**, patrón RF-F42/RF-F43/RF-F44. No es un
  retoque de markup: el markup ya cumple.
- **D2 — Sin cambios de producción**: ninguna línea de `src/` cambia. RF-F45 ya se cumple; lo
  que faltaba era la garantía.
- **D3 — La guarda mira el código, no una instancia afortunada**. Escanea `src/**/*.tsx` —salvo
  `src/dev/`, que son fixtures que no se distribuyen— con `@babel/parser`, el mismo patrón que
  el inventario de textos de RF-F62 y que la guarda de objetivos táctiles de RF-F43.
- **D4 — Tres reglas, no una lista de controles**. A diferencia de RF-F43, que necesita un
  inventario porque cada control tiene su propio estado y su propia medida, aquí la regla es
  uniforme: se aplica a todo control que aparezca. No hay inventario de controles: hay un
  inventario de *reglas*.
- **D5 — «Tiene texto visible» se decide sin adivinar**. Un hijo cuenta como texto si es
  `JSXText` con contenido o una expresión que no sea un elemento JSX. `<button><Icon/></button>`
  no tiene texto y tiene que declararlo; `<button>{strings.actions.scrollToEnd}</button>` sí lo
  tiene. Lo que es `aria-hidden` no cuenta como texto: un `×` decorativo no es el nombre de un
  botón.
- **D6 — El contrato acepta `aria-label` o `aria-labelledby`**. La especificación dice
  `aria-label`; `aria-labelledby` nombra lo mismo por otra vía y no tiene sentido excluirla.
- **D7 — Una etiqueta que envuelve al campo también lo nombra**. La guarda acepta las dos
  formas de asociar: `for`/`id` y la etiqueta envolvente. Marcar como falta de etiqueta a un
  campo legítimamente etiquetado sería un falso positivo.
- **D8 — La raíz del widget es la que declara el idioma**. Se comprueba sobre el elemento que
  lleva la clase del widget, no sobre cualquier elemento: un `lang` en una esquina del widget
  no declara el idioma de sus textos. El nivel de resolución comprueba el **idioma efectivo**:
  el `lang` más cercano en el árbol tiene que ser la raíz del widget, no el `html` del sitio
  host. Comprobar solo el valor del atributo no bastaba: con un host en español, quitarle el
  `lang` al widget habría dejado el test en verde.
- **D9 — Dos niveles, con el nivel declarado en cada aserto**: **mecanismo** en jsdom (el
  código nombra todo lo que nombra) y **resolución** en Chromium (el árbol de accesibilidad
  real le pone nombre a todo lo que lo tiene).
- **D10 — Los dos niveles no son redundantes**: el mecanismo ve un `aria-label` declarado con
  un valor que el navegador ignora; la resolución ve el nombre que de verdad se anuncia. Solo
  la resolución ve que un control `aria-hidden` no está en el árbol.
- **D11 — Los estados salen del contrato, no de los tests**. El contrato declara los estados
  en los que se comprueba (`NAME_STATES`) y los escenarios del navegador son un
  `Record<NameState, …>`: añadir un estado al contrato rompe la compilación hasta que exista
  su escenario. La clase del widget y la identidad de control también se toman del contrato y
  del inventario de RF-F43, no se escriben a mano en el test: dos definiciones que divergen
  son dos contratos.
- **D12 — Cada regla tiene una entrada que rechaza de verdad**, y se comprobó que las guardas
  muerden: quitar la etiqueta del campo, convertir «Ir al final» en un botón solo-icono sin
  nombre, o quitar el `lang` de la raíz ponen los tests en rojo en los dos niveles. El nivel
  de resolución no tiene un sujeto en el widget real —no hay ningún botón solo-icono—, así que
  su entrada que rechaza **inyecta** uno; el nivel de componente hace lo mismo con un botón de
  icono.
- **D13 — No hay nivel manual**: el nombre accesible se resuelve preguntando al árbol de
  accesibilidad. Lo que queda para la pasada manual de RF-F41 es si el texto *suena* bien, que
  es otra cosa.

## Specs

- **S1 — El campo de texto tiene etiqueta asociada.**
  - Alcance: el campo de la pregunta.
  - Criterio: el `textarea` declara `id` y hay un `label` que lo asocia por `for`/`id` —o una
    etiqueta que lo envuelve—. El nombre accesible del campo es el texto de su etiqueta.
  - Comprobación: mecanismo (guarda de mecanismo) y resolución (nombre accesible del campo en
    Chromium).
- **S2 — Todo control tiene nombre accesible.**
  - Alcance: enlaces, botones, campos y cualquier elemento con `role="button"`.
  - Criterio: cada control tiene nombre por su texto visible, por `aria-label` o por
    `aria-labelledby`. Un control sin nombre se anuncia solo como «botón».
  - Comprobación: mecanismo y resolución. La resolución pregunta al árbol de accesibilidad y
    la entrada que rechaza inyecta un botón sin nombre en el widget.
- **S3 — Un botón solo-icono declara su nombre.**
  - Alcance: los botones sin texto visible.
  - Criterio: un `button` cuyo subárbol no pinta texto visible declara `aria-label` o
    `aria-labelledby`. El texto `aria-hidden` no cuenta como texto visible, y tampoco cuenta
    si va escrito como expresión (`aria-hidden={true}`).
  - Comprobación: mecanismo (caso sintético) y resolución (un botón de icono inyectado en el
    widget: el árbol de accesibilidad lo deja sin nombre y el nivel lo detecta).
- **S4 — El widget declara su idioma.**
  - Alcance: la raíz del componente.
  - Criterio: el elemento raíz declara `lang="es"`, y es el `lang` más cercano en el árbol: el
    widget no hereda el idioma del sitio host.
  - Comprobación: mecanismo (guarda del idioma) y resolución (el `lang` más cercano es la raíz
    del widget, no el `html` del sitio).
- **S5 — La comprobación existente deja de ser vacía.**
  - Alcance: `test/component/chatbox-behavior.test.tsx`.
  - Criterio: la comprobación de los botones es una aserción real sobre todos los botones, no
    un `forEach` cuya rama interior no se ejecuta. La regla que aplica es la del contrato, no
    una copia: un botón con texto visible toma el nombre de ese texto; uno sin él tiene que
    declararlo con `aria-label` o `aria-labelledby`.
  - Comprobación: test de componente, con la entrada que rechaza (un botón de icono sin
    nombre).

## Diseño

### El contrato

`frontend/test/accessible-names.ts` es la fuente única: las reglas, el idioma del widget
(`WIDGET_LANGUAGE`), la clase de la raíz (`ROOT_CLASS`) y los estados en los que se comprueba
(`NAME_STATES`). La comparten los dos niveles, como `test/touch-targets.ts` en RF-F43 y
`test/contrast.ts` en RF-F42.

El contrato trabaja sobre una estructura (`NamedElement`), no sobre un nodo del AST: el
escáner traduce el AST a esa forma y las reglas se pueden probar con un caso escrito a mano.
Eso es lo que hace que un test que las exercise pueda **fallar de verdad**.

### Las reglas

| Regla | Qué exige | Dónde se incumple |
|---|---|---|
| **R1 · Etiqueta asociada** | Un campo de formulario tiene nombre por una etiqueta que lo asocia, o por `aria-label`/`aria-labelledby` | `campo sin etiqueta asociada ni aria-label` |
| **R2 · Nombre accesible** | Un control activable tiene nombre: texto visible, `aria-label` o `aria-labelledby` | `control sin nombre accesible` |
| **R3 · Botón solo-icono** | Un `button` sin texto visible declara `aria-label` o `aria-labelledby` | `botón solo-icono sin aria-label` |
| **R4 · Idioma del widget** | La raíz del widget declara `lang="es"` | `el elemento raíz del widget no declara lang="es"` |

R2 y R3 no se solapan: un botón sin texto se informa una sola vez, con el mensaje que explica
qué le falta.

### El mecanismo

`test/unit/chatbox-accessible-names.test.ts` escanea `src/**/*.tsx` (salvo `src/dev/`) con
`@babel/parser` y afirma que no hay incumplimientos. Cada regla tiene su entrada que
rechaza: un botón con un icono y sin nombre, un enlace sin texto, un campo sin etiqueta, una
etiqueta que apunta a otro campo, una raíz sin `lang` y una raíz con otro idioma.

### La resolución

`test/browser/accessible-names.spec.ts` pregunta al árbol de accesibilidad real: por cada
control del widget, en cada estado en que aparece (vacío, campo lleno, turno en curso,
confirmación abierta, desplazado), el nombre accesible que el navegador le computa no está
vacío, y todo botón sin texto visible declara su nombre.

Un control que `aria-hidden` no está en el árbol: su `ariaSnapshot()` viene vacío, que es una
tercera forma de quedarse mudo y que el mecanismo no puede ver.

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `test/accessible-names.ts` | Nuevo: el contrato (reglas, idioma, estados) |
| `test/unit/chatbox-accessible-names.test.ts` | Nuevo: guarda de mecanismo, con una entrada que rechaza por regla |
| `test/browser/accessible-names.spec.ts` | Nuevo: resolución en Chromium |
| `test/component/chatbox-behavior.test.tsx` | La comprobación de los botones deja de ser un `forEach` vacío y pasa a ser una aserción real |
| `test/browser/motion.spec.ts` | La carrera del scroll: el test pulsaba «Ir al final» mientras el autoscroll suave seguía en marcha |
| `../../docs/decisions/009-nombres-accesibles.md` | Nuevo: la decisión de verificación |
| `../../GLOSSARY.md` | «Nombre accesible», «Botón solo-icono», «Etiqueta asociada» |
| `TODO.md` | RF-F45 |

Ningún archivo de `src/` cambia.

## Riesgos

- **La guarda puede ser estricta de más**: un control legítimo sin nombre rompe la compilación.
  Es el comportamiento buscado, y la salida es `aria-label`, no una excepción silenciosa.
- **El escáner es conservador con las expresiones**: una expresión que no se puede resolver
  cuenta como texto. Ante la duda se avisa de más; el caso real —un botón sin hijos— sí muerde.
- **La resolución depende de Chromium**: es el nivel de resolución. El mecanismo cubre el
  código, que es donde el nombre se pierde.
- **La regla depende de la clase raíz**: si el widget pasa a montar su raíz con una clase
  dinámica, la guarda del idioma deja de encontrarlo y hay que actualizar el contrato. Es un
  aviso explícito, no un silencio.

## Verificación

```bash
npm run verify        # lint + typecheck + build + test -- --run
npm run test:browser  # suite de Playwright (Chromium)
```

Los tests de navegador necesitan Chromium instalado. Es el mismo par de comandos que ejecutan
el hook pre-commit y CI.

## Tareas

| Tarea | Specs | Ruta | Estado |
|---|---|---|---|
| T1 — Contrato y guarda de mecanismo | S1-S4 | inline | hecho |
| T2 — Resolución en Chromium | S1-S4 | inline | hecho |
| T3 — La comprobación de componente deja de ser vacía | S5 | inline | hecho |
| T4 — Spec, decisión, glosario y TODO | S1-S5 | inline | hecho |

## Plan de commits

1. `test(frontend): contrato de nombres accesibles del widget (RF-F45)`
2. `test(frontend): la guarda de nombres accesibles (mecanismo) (RF-F45)`
3. `test(frontend): los nombres accesibles resueltos en Chromium (RF-F45)`
4. `fix(frontend): la comprobación de nombres deja de ser un bucle vacío (RF-F45)`
5. `test(frontend): los estados de nombres salen del contrato (RF-F45)`
6. `test(frontend): el scroll del test de movimiento deja de depender del tiempo (RF-F45)`
7. `docs(frontend): cerrar RF-F45 en el TODO (RF-F45)`
8. `test(frontend): las guardas de nombres tienen entrada que rechaza (RF-F45)`
9. `docs(frontend): la revisión deja el contrato de nombres en una sola fuente (RF-F45)`

## Referencias

- Requisito: `../../docs/stitch-frontend-design/SPEC-FRONTEND.md` (RF-F45).
- Decisión: `../../docs/decisions/009-nombres-accesibles.md`.
- Glosario: `../../GLOSSARY.md`.
- Patrones heredados: `../../docs/decisions/006-contrato-y-verificacion-de-contraste.md`,
  `../../docs/decisions/007-objetivos-tactiles.md`, `../../docs/decisions/008-movimiento-reducido.md`.
- Issue: #112.

## Log

- **L1 (2026-10-26)**: auditoría del widget real. Las tres cláusulas de RF-F45 se cumplen en
  el markup, pero la de los botones solo-icono no tiene sujeto (no existe ningún botón de
  icono) y la comprobación que la cubría —un `forEach` que solo entraba en su rama cuando el
  botón no tenía texto— no se ejecutaba nunca.
- **L2 (2026-10-26)**: se comprobó que las guardas muerden, en los dos niveles. Quitar la
  etiqueta del campo, convertir «Ir al final» en un botón solo-icono sin nombre, o quitar el
  `lang` de la raíz ponen los tests en rojo. El test de componente también: un botón de
  enviar sin texto y sin `aria-label` lo pone en rojo.
- **L3 (2026-10-26)**: el hook pre-commit falló con `test/browser/motion.spec.ts` —«se pide
  suave cuando la persona permite el movimiento»—: el clic en «Ir al final» agotaba el
  tiempo de espera porque el botón se había desmontado. La carrera era **preexistente**: el
  test se apartaba del final con `scrollTop = 0` y esperaba al evento de scroll del
  navegador, que llega en otra tarea; mientras tanto, el autoscroll —que con movimiento
  permitido es **suave** y va al final— podía ganar y desmontar el botón. La carga extra de
  esta RF (seis tests de navegador más) solo la hizo visible. El arreglo quita las dos
  fuentes de indecisión con los mismos idiomas que ya usa `scroll-follow.spec.ts`: esperar a
  que el hilo esté en el final antes de apartarse, y despachar el evento de scroll a mano
  para que el widget deje de seguir el hilo en el momento. No se pudo reproducir la carrera
  de forma aislada, así que el arreglo **endurece el arranque del test** en lugar de
  fijar un fallo concreto: después del cambio, la suite completa pasó 23 veces seguidas.
- **L4 (2026-10-26)**: revisión en dos ejes (estándares y spec). Los hallazgos se corrigieron:
  el test de componente y el nivel de resolución **no tenían entrada que rechaza** —el
  primero solo se ejercitaba en verde y el segundo no tenía sujeto, porque el widget no tiene
  ningún botón solo-icono—; ahora cada uno tiene la suya: un botón de icono inyectado en el
  DOM. El idioma se comprobaba de forma indirecta (`closest("[lang]")` solo mordía porque la
  página de desarrollo declara `lang="en"`): ahora se comprueba que el `lang` más cercano es
  la raíz del widget. El `aria-hidden` solo se reconocía escrito como literal: ahora también
  como expresión. Los estados del contrato se usaban como literales sueltos en el test de
  navegador: ahora los escenarios son un `Record<NameState, …>`, así que añadir un estado al
  contrato rompe la compilación hasta que exista su escenario. Y la clase del widget y la
  identidad de control se toman del contrato y del inventario de RF-F43, no se escriben a mano.
  También se corrigió texto corrupto en esta spec («queresolvedieron», «queForbidden»,
  «distributen»).
