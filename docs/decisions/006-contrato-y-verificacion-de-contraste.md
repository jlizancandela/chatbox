# Decisión 006: contrato y verificación de contraste del chatbox

## Estado

Aceptada (2026-10-21).

## Contexto

RF-F42 fija un contraste mínimo de 4.5:1 en texto y 3:1 en componentes y foco, en tema claro
y oscuro.

La Decisión 002 ya estableció el patrón de dos niveles para el CSS y el theming: verificación
de **mecanismo** en jsdom (que no resuelve `var()` ni evalúa `@media`) y verificación de
**resolución** en Chromium con el esquema de color emulado. Ese patrón sigue siendo válido y no
se toca.

La auditoría del 2026-10-21 sobre el widget real encontró que el widget **ya cumple** RF-F42:
`axe` no reporta ninguna violación de contraste en claro ni en oscuro, con y sin conversación, y
todos los ratios de la paleta superan los pisos con holgura. Pero el cumplimiento era accidental,
por tres razones:

1. Las comprobaciones que existían se escribieron para la paleta de RF-F61 y usan umbrales
   propios —7:1 para el texto del cuerpo, 4.5:1 para el foco— que no son los de RF-F42. Nada
   traza hasta el RF.
2. `axe` **no tiene regla** para el contraste del indicador de foco. No hay ninguna otra
   herramienta en el bucle que lo cubra.
3. La pasada de `axe` corría solo en tema claro y en estado vacío, que no son los estados que la
   gente ve.

Además, dos hechos de la hoja de estilos obligaban a decidir antes de poder cerrar el RF: la
capa `prefers-contrast: more` repintaba el widget entero con la paleta clara aunque el sistema
estuviera en oscuro, y las capas de accesibilidad quedaban anuladas por especificidad cuando el
sitio host declaraba un tema explícito.

El problema de fondo no era el contraste: era que **no había contrato**. Una lista de pares
comprobados a mano se queda vieja en la siguiente modificación de estilos, y un RF de
accesibilidad que no puede detectar su propia regresión es un RF que se cierra con un sello
falso.

## Decisión

El contraste del widget es un **contrato**, no una lista de comprobaciones:

1. **El contrato es una tabla de pares** (tinta, fondo, piso) que enumera las combinaciones que
   el widget usa de verdad. Los pisos son 4.5:1 para el texto y 3:1 para los componentes
   visuales y el anillo de foco.
2. **Una guarda hace que el contrato no se quede viejo.** Se parsea la hoja de estilos y se
   listan los tokens de color consumidos como tinta y como fondo. Todo token usado como tinta
   tiene que existir en la tabla como fila, y todo token usado como fondo, como columna. Un
   color nuevo que entre al widget sin fila rompe la compilación.
3. **Dos niveles, con el nivel declarado en cada aserto**, igual que en la Decisión 002:
   mecanismo en jsdom, resolución en Chromium. **No hay nivel manual**: el contraste es
   automatizable por completo, a diferencia de la región viva.
4. **El indicador de foco se verifica con cálculo propio.** Para cada control enfocable se toma
   el color de `outline` ya resuelto y se compara con el fondo efectivo que queda detrás del
   anillo. Como el anillo se dibuja desplazado, ese fondo es el del **contenedor**, no el del
   control; el desplazamiento está fijado en el test, que además comprueba su valor, para que
   un cambio futuro no pueda medir el fondo equivocado en silencio.
5. **Un solo cálculo del ratio WCAG**, compartido por los dos niveles, para que no pueda haber
   dos implementaciones divergentes. Vive con el `setup.ts` de los tests, no en `src/`.
6. **La pasada de `axe` cubre la matriz completa**: claro y oscuro, contra estado vacío, con
   respuesta y con error. Los dos estados con conversación se alcanzan por un endpoint SSE
   simulado —respuesta y error— con el ayudante de intercepción de peticiones que ya usa la
   verificación de la región de estado.
7. **Los controles deshabilitados quedan fuera de la medición.** WCAG exime a los componentes
   inactivos, y el widget los baja de opacidad: medir su etiqueta como si estuviera a opacidad
   completa certificaría algo que nadie ve.
8. **La garantía se refiere a los tokens por defecto.** El fondo del sitio host y los valores que
   el host sobrescriba quedan fuera del contrato, y se documentan como límite explícito.
9. **El objetivo de 7:1 para el texto del cuerpo se mantiene como aserto duro**, en su propio
   bloque rotulado como objetivo de paleta y no como criterio de aceptación de RF-F42. Sigue
   bloqueando la compilación: es la diferencia entre un objetivo que informa y una promesa que
   se rompe sola.

## Consecuencias

- Un verde de jsdom sigue sin probar el valor final, y el aserto lo dice. El cierre de RF-F42
  exige el nivel de navegador.
- Cambiar un token obliga a tocar la tabla o a romper la compilación. El coste está en el sitio
  correcto: en la paleta, no en el requisito de accesibilidad.
- Si un sitio host sobrescribe un token, el widget deja de garantizar su contraste. Es
  explícito en el glosario y en la spec, no una sorpresa.
- La insignia «IA» queda en 4.65:1: cumple el piso con 0.15 de margen. Es la fila más frágil
  de la tabla, y la guarda la vigila.
- El anillo de foco se mide contra el fondo del contenedor. Si el desplazamiento del contorno
  pasa a 0, el fondo relevante cambia y el test tiene que cambiar con él: por eso el
  desplazamiento está fijado en el test, y no solo asumido.
- Un borde se mide contra el fondo que tiene detrás. El botón de envío pinta relleno y borde
  del mismo color de marca, así que el criterio es que el componente se identifique, no que
  cada par de colores contenga contraste.
- La capa `prefers-contrast: more` deja de sustituir tokens en el esquema oscuro, porque esa
  paleta ya supera todos los pisos. Si en el futuro el esquema oscuro deja de cumplirlos, la
  guarda de la tabla lo detecta.
- La separación tonal de la burbuja del asistente (1.16:1) no se corrige: se documenta como
  límite conocido. Una burbuja de mensaje no es un componente visual.

## Alternativas rechazadas

- **Solo `axe`**: no tiene regla para el contraste del indicador de foco. Un test que pasa
  verde creyendo que cubre el foco es peor que no cubrirlo.
- **Solo mecanismo en jsdom**: verifica que el CSS declara el anillo, no que el anillo se vea.
- **Matriz completa de pares**: produce requisitos falsos —tinta de error sobre contenedor de
  acento no existe en el widget— y obliga a excluir parejas a mano.
- **Lista de pares sin guarda**: se queda vieja sola en la siguiente modificación de estilos.
- **Subir el objetivo de 7:1 a un aviso que no rompe la compilación**: un aserto que nadie lee
  no es un objetivo, es ruido.
- **Sembrar `sessionStorage` en vez de simular el SSE**: más corto, pero no pasa por el render
  real del turno, y es el único camino que pinta de verdad burbuja propia, burbuja del asistente
  con enlace y estado de error.
- **Añadir un nivel manual con checklist**: no hay nada que solo una persona pueda comprobar.
  El contraste se resuelve con números.
