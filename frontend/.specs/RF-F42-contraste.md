# RF-F42 — Contraste del chatbox

> Convención del proyecto: un spec por RF en `.specs/`, decisiones de proceso en
> `docs/decisions/` de la raíz, glosario en `GLOSSARY.md` de la raíz.
>
> Spec confirmado el 2026-10-21 tras sesión de `grill-with-docs`. Decisión de verificación
> en `docs/decisions/006-contrato-y-verificacion-de-contraste.md`. Issue: #96.

## Síntesis de la entrevista (decisiones acordadas, 2026-10-21)

- **D1 — Alcance**: verificar **y** corregir. La auditoría encontró cinco defectos reales, y
  cerrar el RF con un sello sobre un cumplimiento accidental dejaría el contrato sin respaldo.
- **D2 — Capas cubiertas**: las dos paletas (defaults del widget y su equivalente oscuro, con
  sus equivalentes de tema explícito del host) **más** la capa `prefers-contrast: more`. La
  paleta de `forced-colors` queda **fuera** del contrato: en ese modo manda el sistema.
- **D3 — Pisos**: 4.5:1 para el texto y 3:1 para componentes y foco.
- **D4 — «Componente visual» es una regla, no una lista**: todo elemento con borde visible o
  con anillo de foco. Los controles deshabilitados quedan fuera, porque WCAG exime a los
  componentes inactivos.
- **D5 — El anillo de foco se mide contra las superficies del propio widget**, nunca contra
  el fondo del sitio host. El widget no puede garantizar el contraste de un fondo que no
  controla.
- **D6 — La garantía se refiere a los tokens por defecto**. Un host que sobrescriba un token es
  responsable de su contraste. Se documenta como límite explícito, con la misma postura que ya
  tiene el *override por cascada*.
- **D7 — El contrato es una tabla de pares** (tinta, fondo, piso) **más una guarda**: todo
  token consumido como tinta tiene que existir en la tabla como fila, y todo token consumido
  como fondo, como columna.
- **D8 — El objetivo de 7:1 del texto del cuerpo sigue como aserto duro**, en su propio
  bloque rotulado como objetivo de paleta, no como criterio de aceptación del RF. Sigue
  bloqueando la compilación: es la diferencia entre un objetivo que informa y una promesa que
  se rompe sola.
- **D9 — La capa de contraste alto deja de repintar la paleta cuando el esquema efectivo es
  oscuro**: esa paleta ya supera todos los pisos, así que no hay nada que sustituir. En esquema
  claro mantiene su variante de alto contraste. En ambos conserva la regla que sustituye la
  separación tonal por un borde explícito en las burbujas.
- **D10 — Las capas de accesibilidad ganan al tema del host donde tienen algo que decir**:
  `prefers-contrast` y `forced-colors` repiten los selectores de tema del host con la misma
  especificidad pero más tarde en el código fuente, así que un `data-theme` no puede
  silenciarlas. La capa de contraste alto solo sustituye tokens cuando el esquema efectivo es
  claro (D9): con un tema oscuro en el host el esquema efectivo es el oscuro, y esa paleta ya
  supera todos los pisos, así que no hay nada que sustituir.
- **D11 — El token de error deja de estar muerto**: la región de estado gana una variante que
  aplica **solo** al caso de error, porque la región también pinta la respuesta completa y el
  aviso de «escribiendo». El texto anunciado no cambia ni una palabra.
- **D12 — El anillo de foco se verifica con cálculo propio en navegador**: para cada control
  enfocable, el color de `outline` ya resuelto, comparado con el fondo efectivo que queda
  detrás del anillo.
- **D13 — Un solo cálculo del ratio WCAG**, compartido por los dos niveles de verificación.
- **D14 — El nivel de navegador llega al estado con conversación por un endpoint SSE
  simulado**, reutilizando el ayudante de intercepción de peticiones que ya usa la verificación
  de la región de estado.
- **D15 — `axe` corre en claro y en oscuro, en estado vacío y con conversación**. Hoy corre
  solo en claro y vacío.
- **D16 — No hay nivel manual**: el contraste es automatizable por completo.
- **D17 — Glosario**: entran *piso de contraste*, *componente visual*, *anillo de foco*,
  *token por defecto* y *contrato de contraste*.
- **D18 — Una sola issue** (#96), con el trabajo repartido en commits de correcciones,
  contrato de verificación y documentación.
- **D19 — Una decisión nueva en `docs/decisions/`**. La decisión 002 (estrategia de tests para
  CSS y theming) sigue siendo cierta y no se toca: su contenido es de otra naturaleza.
- **D20 — `docs/stitch-frontend-design/SPEC-FRONTEND.md` no se toca**: los IDs `RF-Fxx` son la
  referencia estable entre `TODO.md` y la spec de diseño; la ampliación de RF-F42 vive aquí.
- **D21 — La burbuja del asistente no es un componente visual**: su separación es solo tonal
  (1.16:1 en claro, 1.18:1 en oscuro) y la sombra al 5 % de negro aporta 1.12:1. Se
  **documenta** como límite conocido en lugar de corregirlo.
- **D22 — La insignia «IA» se queda en 4.65:1**: cumple el piso con 0.15 de margen y el
  contrato la vigila.

## Problem Statement

`SPEC-FRONTEND.md` §E fija para RF-F42: *«Contraste mínimo 4.5:1 en texto y 3:1 en
componentes y foco, en tema claro y oscuro»*. En `frontend/TODO.md` (Paso 5 — Accesibilidad)
la casilla sigue abierta.

El widget **ya cumple casi todo**. Medido en Chromium (Playwright) sobre el widget real, con y
sin conversación, `axe` con las etiquetas `wcag2a/2aa/21a/21aa/22aa` **no encuentra ninguna
violación de contraste** en tema claro ni en oscuro. Y los ratios de la paleta actual superan
los pisos de RF-F42 con holgura en todas las combinaciones que importan.

El problema es que ese cumplimiento es **accidental, no un contrato**:

1. **No hay contrato.** Las comprobaciones que existen se escribieron para la paleta de RF-F61
   y usan umbrales propios —7:1 para el texto del cuerpo, 4.5:1 para el foco— que no son los
   de RF-F42. Nada traza hasta el RF, y el `TODO.md` no puede marcarse con honestidad.
2. **El anillo de foco no lo verifica nadie.** `axe` no tiene regla para el contraste del
   indicador de foco, y el test de tokens solo mira el *token*, no el anillo que se dibuja.
3. **`axe` corre solo en claro y en estado vacío.** La burbuja del usuario, la del asistente con
   un enlace dentro y el estado de error —los estados que la gente ve de verdad— no se auditan
   nunca.
4. **El token de error está muerto.** `--chatbox-color-error` se declara en las seis capas de
   tokens y lo consume **cero** reglas: los errores se pintan con el color de texto normal, y
   su contraste nunca se verifica.
5. **La capa de contraste alto se comporta mal.** Con el sistema en oscuro,
   `prefers-contrast: more` repinta el widget entero con la paleta **clara** (medido: texto
   `#000000` sobre superficie `#ffffff`). Y con un tema explícito en el sitio host, esa capa —y
   la de colores forzados— quedan **anuladas por especificidad** (0,1,0 contra 0,2,0), así que
   la preferencia de accesibilidad del usuario se ignora en silencio. El propio comentario del
   CSS afirma lo contrario: *«forced colors must be the final layer so user-selected system
   colors always win»*.
6. **El anillo se dibuja desplazado.** Con `outline-offset: 2px`, el anillo cae sobre el fondo
   del **contenedor**, no sobre el control, así que la medición necesita saber contra qué fondo
   se compara.
7. **El widget no controla el contraste de lo que decide el host.** Cualquier token puede ser
   sobrescrito desde la cascada, y nada dice hasta dónde llega la garantía.

Para quien usa el widget, la promesa de RF-F42 no está respaldada por nada verificable. Para
quien mantiene el repo, el RF se cerraría con un sello sobre un cumplimiento por casualidad, y
el siguiente retoque de paleta podría tumbar un requisito de accesibilidad sin que nada se
entere.

## Solution

Un **contrato de contraste** para el widget: una tabla explícita de tinta × fondo × piso, con
una guarda que impide que un color nuevo entre al widget sin su fila, verificada en dos
niveles —mecanismo en la suite unitaria, resolución en un navegador real— y las correcciones
para que el widget se comporte como el contrato dice:

- La capa de contraste alto deja de repintar la paleta cuando el esquema efectivo es oscuro.
- Las capas de accesibilidad no se pueden silenciar desde el sitio host.
- El error se pinta por fin con su color, y ese color entra en el contrato.

## User Stories

1. Como visitante con baja visión, quiero que el texto del chat alcance 4.5:1 sobre cualquier
   superficie del widget, para que pueda leer las respuestas sin forzar la vista.
2. Como visitante con baja visión, quiero que los enlaces del chat —incluidos los que vienen
   dentro de una respuesta— contrasten 4.5:1, para no perderlos de vista.
3. Como visitante con baja visión, quiero que la etiqueta del botón de envío y el texto de mi
   propia burbuja contrasten 4.5:1 sobre el color de marca, para que no me cueste leerlos.
4. Como visitante que usa el tema oscuro, quiero los mismos niveles de contraste que en claro,
   para que cambiar de tema no me cambie la legibilidad.
5. Como visitante que usa el tema oscuro, quiero que los bordes de los controles y el anillo de
   foco mantengan 3:1, para que los distinga sobre el fondo oscuro.
6. Como visitante cuyo sistema pide más contraste, quiero que el widget lo tenga en cuenta en
   vez de ignorarlo, para no quedarme con una paleta que no he pedido.
7. Como visitante cuyo sistema fuerza los colores del sistema, quiero que el widget no le
   imponga su propia paleta, para que el sistema pueda pintar lo que yo elija.
8. Como visitante que usa el widget dentro de un sitio con un tema propio, quiero que el widget
   no anule mis preferencias de accesibilidad por el hecho de que mi sitio declare un tema,
   para que la configuración de mi sistema no dependa del sitio.
9. Como visitante que navega con teclado, quiero ver un anillo de foco con 3:1 frente al fondo
   sobre el que se dibuja, para saber dónde estoy.
10. Como visitante que navega con teclado, quiero que el anillo de foco se distinga también
    cuando el control está cerca del borde del widget, para no perderlo.
11. Como visitante que usa lector de pantalla, quiero que el texto de error siga siendo
    exactamente el que se anuncia, para que el aviso no cambie por pintarse de otro color.
12. Como visitante, quiero que un error se distinga visualmente de una respuesta, para no leer
    un fallo como si fuera una respuesta del asistente.
13. Como visitante, quiero que un error se distinga por su texto y no solo por su color, para que
    lo entienda también quien no distingue ese color.
14. Como visitante, quiero que los controles deshabilitados se reconozcan como deshabilitados
    sin que parezca un texto ilegible por error, para saber si puedo pulsarlos.
15. Como visitante con baja visión, quiero distinguir la burbuja del asistente de la mía, para
    saber de quién es cada turno.
16. Como sitio host, quiero saber qué garantiza el widget y qué no, para no prometer en mi sitio
    algo que el widget no cumple.
17. Como sitio host, quiero que sobrescribir mis tokens siga funcionando, para que mi diseño no
    dependa de lo que el widget decida por su cuenta.
18. Como sitio host, quiero que mis valores de color no cambien de aspecto al menos que el
    widget cambie, para no tener que revisar mi sitio en cada versión.
19. Como mantenedor, quiero que un color nuevo no pueda entrar en el widget sin fila en el
    contrato, para que el contraste no se degrade por descuido.
20. Como mantenedor, quiero saber qué verifica cada prueba, para no leer un verde sobre jsdom
    como prueba de que algo se ve bien.
21. Como mantenedor, quiero que la auditoría de contraste cubra el estado real —una
    conversación con respuesta, enlace y error— y no solo la pantalla de bienvenida, para que
    lo que se mide sea lo que la gente ve.
22. Como mantenedor, quiero que la auditoría de contraste cubra el tema oscuro, para no dejar
    medio tema sin vigilar.
23. Como mantenedor, quiero que exista un solo cálculo del ratio de contraste, para que los dos
    niveles de verificación no puedan discrepar.
24. Como mantenedor, quiero que los umbrales se lean como pisos y no como números mágicos, para
    entender qué se está exigiendo.
25. Como mantenedor, quiero que un cambio de paleta que baje el contraste se detecte antes de
    publicarse, para no publicar una regresión de accesibilidad.
26. Como mantenedor, quiero que la insignia «IA» no quede al borde del suelo de contraste, para
    que un retoque de la paleta no la tumbe.
27. Como mantenedor, quiero saber qué queda fuera del contrato de contraste, para no creerse una
    garantía que no existe.
28. Como mantenedor, quiero que RF-F42 sea trazable desde el TODO del frontend y desde una
    decisión documentada, para no perder el criterio con el tiempo.

## Implementation Decisions

### El contrato es una tabla, y la tabla está guardada

El contrato de contraste es una tabla de pares **(tinta, fondo, piso)** que enumera las
combinaciones que el widget usa de verdad:

| Tinta sobre fondo | Piso | Claro | Oscuro | Dónde aparece |
|---|---|---|---|---|
| texto sobre superficie | 4.5 | 17.16 | 11.54 | cuerpo del widget, mensajes |
| texto sobre superficie tonal | 4.5 | 14.78 | 9.78 | burbuja del asistente, aviso de cabecera |
| texto sobre superficie elevada | 4.5 | 14.00 | 8.24 | chip de sugerencia al pasar el ratón |
| enlace sobre superficie | 4.5 | 6.49 | 7.70 | enlace de contacto del pie |
| enlace sobre superficie tonal | 4.5 | 5.59 | 6.52 | enlace dentro de la respuesta |
| tinta de superficie sobre color de marca | 4.5 | 6.68 | 7.69 | burbuja propia, botón «Enviar» |
| tinta de superficie sobre contenedor de acento | 4.5 | 4.65 | 10.17 | insignia «IA» |
| tinta de error sobre superficie | 4.5 | 6.46 | 6.91 | **nuevo**: región de estado en error |
| anillo de foco sobre superficie | 3 | 6.49 | 7.70 | foco visible del control |
| anillo de foco sobre superficie tonal | 3 | 5.59 | 6.52 | foco de un control sobre superficie tonal |
| anillo de foco sobre superficie elevada | 3 | 5.29 | 5.50 | foco de un control sobre superficie elevada |
| borde de componente sobre superficie | 3 | 4.47 | 7.69 | botones, campo de texto |
| borde de componente sobre superficie tonal | 3 | 3.85 | 6.52 | borde sobre superficie tonal |
| borde de componente sobre superficie elevada | 3 | 3.64 | 5.49 | borde sobre superficie elevada |
| color de marca sobre superficie elevada | 3 | 5.45 | 5.49 | borde del chip de sugerencia al pasar el ratón |

Los valores de la tabla son **contexto medido**, no el contrato: el contrato son los **pisos**.
Lo que vigila los pisos es el test, y lo que vigila que la tabla no se quede vieja es la
**guarda**.

La guarda se apoya en el mismo precedente que el inventario de RF-F62 y la guarda de estilos
con ámbito: se parsea la hoja de estilos del widget y se listan los tokens de color que aparecen
como tinta (`color`, `border-color`, `outline-color`) y como fondo (`background-color`). Todo
token usado como **tinta** tiene que existir en la tabla como fila, y todo token usado como
**fondo**, como columna. Un color nuevo que entre al widget sin fila rompe la compilación.

Una lista fija se queda atrás en cuanto alguien añade un componente; la regla se sostiene sola.

### Qué es un componente visual

**Regla**: todo elemento con borde visible o con anillo de foco. **No** una lista de
selectores.

Los controles deshabilitados quedan fuera: WCAG exime del contraste a los componentes
inactivos, y `axe` tampoco los exige.

### Los pisos

4.5:1 para el texto y 3:1 para componentes y foco. El texto grande (≥24 px, o ≥18.66 px en
negrita) conserva su piso propio de 3:1 según WCAG; el widget no lo usa salvo el título.

El objetivo de 7:1 para el texto del cuerpo —que viene de la paleta de RF-F61 y que el test
actual ya exige— **no desaparece**: pasa a su propio bloque, rotulado como objetivo de paleta y
no como criterio de aceptación de RF-F42. Sigue siendo un aserto duro: sigue bloqueando
`npm run verify`. Es la diferencia entre un objetivo que informa y una promesa que se rompe
sola. Un cambio de paleta que lo tumbe tiene que ser una decisión consciente, no un descuido.

### Las correcciones de las capas de tema

La hoja de estilos del widget declara tokens en **seis capas**: los defaults del widget, el
esquema oscuro del sistema, el tema oscuro explícito del host, el tema claro explícito del host,
el contraste alto y los colores forzados.

**El contraste alto deja de repintar la paleta.** Hoy la capa declara una paleta clara de alto
contraste sin mirar el esquema, así que con el sistema en oscuro el widget se pone blanco. La
capa debe aplicarse solo cuando el **esquema efectivo** es claro. Cuando es oscuro, no sustituye
nada: la paleta oscura ya supera todos los pisos (texto 11.54, enlace 7.70, borde 7.69, foco
7.70, error 6.91), así que no hay nada que arreglar. Lo que la capa sí aporta en ambos esquemas
es la regla que sustituye la separación tonal por un borde explícito en las burbujas.

Expresar «el esquema efectivo es claro» en CSS puro no es trivial: hay que combinar la
preferencia del sistema con el tema que declara el sitio host, y el orden de fuente y la
especificidad no siempre coinciden. **Plan B**: como ambas paletas superan ya todos los pisos,
la capa puede reducirse a su regla del borde y dejar de sustituir tokens; el contrato no depende
de esa parte.

**Las capas de accesibilidad ganan al host.** `prefers-contrast` y `forced-colors` suben de
especificidad para que un tema explícito del sitio host no las silencie. Es la intención que el
propio CSS ya declara en su comentario y que el código no cumplía. La paleta de colores
forzados sigue **fuera del contrato de contraste** —lo que se corrige es el mecanismo de
precedencia, no su verificación.

### El token de error deja de estar muerto

`--chatbox-color-error` se declara en las seis capas y lo consume cero reglas. Pasa a
consumirse: la región de estado gana una variante que aplica **solo** al caso de error, porque
la región también pinta la respuesta completa y el aviso de «escribiendo».

El texto anunciado **no cambia ni una palabra**: el RF-F41 sigue intacto, y su verificación
—que fija la secuencia de textos de la región— es la red de seguridad de este cambio. La
variante solo puede tocar el color.

El error se distingue por su texto y por su color, no por el color solo: el copy ya dice qué ha
pasado.

### Los límites de la garantía

Dos límites, y los dos se escriben:

1. **La garantía se refiere a los tokens por defecto.** Un sitio host que sobrescriba un token
   es responsable de su contraste. Es la misma postura que ya tiene el *override por cascada*:
   el host es dueño de sus valores.
2. **El fondo del sitio host queda fuera.** El anillo de foco se mide contra las superficies
   del propio widget, nunca contra el fondo del host: el widget no puede garantizar el
   contraste de un fondo que no controla, y prometerlo en el contrato sería una promesa falsa.

### El anillo de foco se verifica por cálculo propio

`axe` no tiene regla para el contraste del indicador de foco, y el test de tokens solo mira el
token. Así que el nivel de navegador calcula: para cada control enfocable, toma el color de
`outline` **ya resuelto** y lo compara con el fondo efectivo que queda detrás del anillo.

Como el anillo se dibuja con `outline-offset: 2px`, ese fondo es el del **contenedor**, no el del
control. El test declara cuál mide, para que un cambio futuro de desplazamiento no pase por
alto. Y si el desplazamiento pasa a 0, cambia el fondo relevante y el test tiene que cambiar con
él.

## Alternativas rechazadas

- **Matriz completa de pares** (cada tinta contra cada fondo): produce requisitos falsos —tinta
  de error sobre contenedor de acento no existe en el widget— y obliga a excluir parejas a
  mano, que es una lista disfrazada de matriz.
- **Lista mínima sin guarda**: se queda vieja sola en la siguiente modificación de estilos. Sin
  la guarda, el RF no es un contrato sino una fotografía.
- **`axe` como verificación del anillo de foco**: `axe` no tiene esa regla. Escribir un test
  que pase verde creyendo que cubre el foco es peor que no cubrirlo.
- **Solo mecanismo en jsdom**: verifica que el CSS declara el anillo, no que el anillo se vea.
  Vale como nivel 1; no habilita el cierre.
- **Sembrar `sessionStorage` en vez de simular el SSE**: más corto, pero no pasa por el render
  real del turno. El SSE simulado es el camino que ya usa la verificación de la región de estado
  y el único que pinta de verdad burbuja propia, burbuja del asistente con enlace y estado de
  error.
- **Bajar la especificidad de los selectores de host en vez de subir la de las capas de
  accesibilidad**: cambiaría la semántica de todo el tema para arreglar un caso, y dejaría al
  host sin forma de ganar por orden de fuente.
- **Recalcular la capa de contraste alto completa** (variante oscura de alto contraste): diseña
  una paleta nueva para satisfacer una preferencia que la paleta oscura ya cumple.
- **Dejar la capa de contraste alto siempre en claro**: es el defecto que originó el hallazgo.
- **Piso con margen (5:1) en vez del suelo exacto**: ruido de diseño por una cifra que ya
  cumple. El suelo exacto ya es auto-vigilante: el fallo lo detecta el test, no el usuario.
- **Subir el contrato a 7:1**: más estricto que el RF. El RF es la carta.
- **Bajar el 7:1 a un aviso por consola**: un aserto que nadie lee no es un objetivo, es ruido.
- **Cablear el token de error en toda la región de estado**: pintaría de rojo la respuesta
  completa y el aviso de «escribiendo».
- **Borrar el token de error**: el widget no distinguiría errores por color, y un error que se
  ve igual que una respuesta es información que se pierde.
- **El widget autoprotege los overrides del host**: rompe el modelo *self-contained* de RF-F61 y
  convierte un problema del host en complejidad del widget.
- **Añadir un nivel manual**: el contraste es automatizable por completo. A diferencia de la
  región viva, no hay nada que solo pueda comprobar una persona.
- **Subir el contraste a 7:1 como contrato**: ver arriba.
- **Exigir que el borde contraste con los dos lados** (su propio relleno y el fondo de fuera):
  el botón de envío pinta relleno y borde del mismo color de marca, así que exigir el contraste
  con el relleno lo declararía fallido sin motivo: lo que identifica el componente es el
  conjunto, y para eso basta un lado.

## Verificación

Dos niveles, con el nivel declarado en cada aserto (ver
`docs/decisions/006-contrato-y-verificacion-de-contraste.md`).

### Nivel 1 — Mecanismo (jsdom)

- La tabla del contrato: cada par (tinta, fondo) alcanza su piso en la paleta clara y en la
  oscura.
- La guarda de tokens: todo token consumido como tinta tiene fila en la tabla; todo token
  consumido como fondo, columna.
- El orden de las capas de tema y la precedencia: la capa de contraste alto y la de colores
  forzados ganan al tema explícito del host; la capa de contraste alto no sustituye tokens en
  el esquema oscuro.
- El bloque propio del objetivo de 7:1, rotulado como objetivo de paleta.

Este nivel **no** verifica el valor resuelto: jsdom no resuelve `var()` ni evalúa `@media`, y
un test que leyera el estilo computado daría verde sin comprobar nada.

### Nivel 2 — Resolución (Chromium, Playwright)

- Matriz: **claro y oscuro** × **estado vacío, con respuesta y con error**.
- El estado con conversación se alcanza por un endpoint SSE simulado (el ayudante de
  intercepción de peticiones que ya usa la verificación de la región de estado); el de error,
  por una respuesta 500.
- Para cada control enfocable: el color de `outline` resuelto y su ratio contra el fondo
  efectivo que queda detrás del anillo. **El desplazamiento del anillo está fijado**: con
  desplazamiento, el anillo se dibuja sobre el fondo del contenedor; sin él, sobre el del
  control. El test dice cuál mide y comprueba el valor, para que un cambio de desplazamiento
  no pueda pasar por alto.
- Para cada elemento con borde: su color de borde y su ratio contra el fondo que tiene
  detrás. El chip de sugerencia se mide además al pasar el ratón, que es cuando su borde
  cambia de color.
- Para cada texto: su color y su ratio contra el fondo efectivo.
- Una pasada de `axe` sobre el widget en cada una de las seis combinaciones.
- **Los controles deshabilitados quedan fuera de la medición**: WCAG exime a los componentes
  inactivos, y el widget los baja de opacidad.

Este nivel sigue sin probar lo que no es automatizable —que no hay nada— y no suplanta a la
garantía de los tokens por defecto: mide los valores por defecto.

### El cálculo del ratio

Un solo cálculo WCAG, compartido por los dos niveles, para que no pueda haber dos
implementaciones divergentes. Vive junto al `setup.ts` de los tests, no en `src/`: es
infraestructura de prueba.

### Antecedentes

- El test unitario de theming existente: parseo de la hoja de estilos con `postcss`, tabla de
  tokens, orden de capas por desplazamiento en el código fuente. El contrato se apoya en ese
  andamiaje.
- La spec de theming en navegador: esquema de color emulado, pasada de `axe`.
- La spec de la región de estado en navegador: endpoint SSE simulado, secuencia de la región.
- El inventario de literales de RF-F62 y la guarda de estilos con ámbito: los dos precedentes de
  **detector** en el repo. Un detector cuyo test nunca falla no protege nada, así que la guarda
  de tokens tiene que incluir una entrada que la haga fallar de verdad.

## Fuera de alcance

- **La paleta de colores forzados** no se verifica contra el contrato. Solo se corrige su
  precedencia respecto al tema del host.
- **La separación tonal de la burbuja del asistente** no se corrige: se documenta como límite
  conocido. Es 1.16:1 en claro frente a 6.68:1 de la burbuja propia —la asimetría es real y
  queda anotada— pero una burbuja de mensaje no es un control y el autor del turno ya dice de
  quién es.
- **Los controles deshabilitados** no se verifican: WCAG exime a los componentes inactivos.
- **El fondo del sitio host y los valores que el host sobrescriba** quedan fuera de la
  garantía.
- **El 7:1 del texto del cuerpo** no es criterio de aceptación de RF-F42.
- **`docs/stitch-frontend-design/SPEC-FRONTEND.md` no se toca.**
- **La API no se toca.** RF-F42 es íntegramente del frontend.
- **RF-F43, RF-F44 y RF-F45** (objetivos táctiles, `prefers-reduced-motion`, etiquetas y
  `aria-label`) quedan fuera.
- **No hay nivel manual ni checklist de lector de pantalla.**

## Glosario

Definido en `GLOSSARY.md` (raíz), sección «Contraste del chatbox»: Piso de contraste,
Componente visual, Anillo de foco, Token por defecto, Contrato de contraste.
