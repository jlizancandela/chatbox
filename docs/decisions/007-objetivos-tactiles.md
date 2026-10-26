# Decisión 007: contrato y verificación de objetivos táctiles del chatbox

## Estado

Aceptada (2026-10-21).

## Contexto

RF-F43 fija que todos los controles táctiles del widget midan al menos 44×44 px, y enumera
cuatro: enviar, detener, nueva conversación y sugerencias.

La auditoría del 2026-10-21 sobre el widget real encontró que el widget **no cumple el
requisito, aunque parezca que sí**:

1. El suelo está declarado en `rem`: `.chatbox button { min-height: 2.75rem }`. 44 px es el
   valor de `2.75rem` **solo si la raíz del documento mide 16 px**. `rem` se resuelve contra
   `:root`, y el widget está pensado para incrustarse en sitios arbitrarios (Paso 7 del TODO):
   un host con `html { font-size: 14px }` deja el control en 38,5 px. El test de navegador no
   lo vería, porque la página de test tiene la raíz a 16 px.
2. No hay `min-width`. El ancho de un control depende del texto de su etiqueta, así que un
   botón de icono —20 px de icono más el padding— queda por debajo de 44 px de ancho, y nada
   lo detecta. El TODO ya lo anticipaba: «falta medir el área completa de los botones de icono
   cuando existan».
3. La especificación enumera cuatro controles y el widget tiene seis: en la confirmación en
   línea de «Nueva conversación» hay dos botones, y está el botón «Ir al final». Los controles
   que la especificación no enumera no tienen contrato.
4. No existe ninguna medición del tamaño de un control en el repo, ni un inventario de
   controles interactivos. El cumplimiento es accidental, igual que lo era el contraste antes
   de RF-F42.

El problema de fondo no era el tamaño: era que **no había contrato**. Una comprobación suelta
se queda vieja en la siguiente modificación de estilos, y un RF de accesibilidad que no puede
detectar su propia regresión se cierra con un sello falso. La Decisión 002 ya estableció el
patrón de dos niveles para el CSS y el theming —verificación de **mecanismo** en jsdom y de
**resolución** en Chromium—, y la Decisión 006 lo aplicó al contraste. El patrón sigue vigente y
no se toca.

## Decisión

Los objetivos táctiles del widget son un **contrato**, no una lista de comprobaciones:

1. **El suelo es de 44×44 px CSS absolutos.** La hoja de estilos declara `min-height: 44px` y
   `min-width: 44px`, no `rem`. El widget tiene que cumplir el requisito en cualquier host, y un
   suelo que depende del `font-size` del host no es un suelo. Comprobar solo la regla que lo
   declara no basta: **ninguna** regla que apunte a botones puede volver a declararlo en una
   unidad relativa, porque una regla más específica ganaría por orden de cascada y dejaría el
   control en 38,5 px sin que ninguno de los dos niveles se entere.
2. **El 44 px no es un token del tema.** Es una decisión de accesibilidad, no de tema: si fuera
   un token `--chatbox-*`, un sitio host podría sobrescribirlo y bajar el suelo en silencio. La
   garantía es del widget, y su límite —un host que usa `!important` sobre `button`— se
   documenta como límite explícito, igual que el *override por cascada* de RF-F61.
3. **Lo que se mide es la caja del control** (*border-box*): el botón visible mide 44×44. En el
   widget la caja del control **es** el área que recibe el puntero. No hay áreas de golpeo
   invisibles: un halo transparente puede solaparse con el control vecino del footer denso y
   nadie sabría qué zona es pulsable.
4. **El alcance son los botones accionables del widget**: enviar y detener, nueva
   conversación, la confirmación en línea (aceptar y cancelar), las sugerencias y «Ir al final».
   Quedan fuera, con su motivo: los **enlaces en línea**, que tienen la excepción *inline* de
   WCAG 2.5.8; los **controles deshabilitados**, que WCAG exime porque son componentes
   inactivos y que el widget además baja de opacidad; y el **campo de texto**, que es un campo
   y no un control de activación, y que la especificación no enumera. Una exclusión se declara
   en el contrato, con su motivo, en lugar de desaparecer del detector: un elemento excluido
   sigue vigilado por la guarda, uno que se cuela sin declarar no.
5. **El contrato es un inventario**, con una identidad por control, y **una guarda** que hace
   que un control nuevo no pueda colarse sin medir. La identidad se declara en el markup con
   `data-chatbox-control`: es lo que permite afirmar «todo control interactivo del widget está
   inventariado» de forma mecánica, en lugar de contar botones y confiar en que el recuento no
   miente. La guarda escanea **todo** `src/**/*.tsx` con `@babel/parser`, y falla si un
   elemento interactivo —`a`, `button`,
   `input`, `select`, `textarea`, o cualquiera con `role="button"`— no declara su identidad, si
   declara una que el inventario no conoce, o si **una identidad declara dos controles**. Esta
   última regla no es decorativa: el nivel de resolución busca los controles por su identidad, y
   dos controles con la misma harían que la medición midiera el primero de los dos en el
   escenario del segundo.
6. **Dos niveles, con el nivel declarado en cada aserto**, igual que en las Decisiones 002 y
   006: **mecanismo** en jsdom (el suelo está declarado en px absolutos y la guarda de
   inventario morder) y **resolución** en Chromium (la caja de cada control, medida con
   `getBoundingClientRect()`, mide al menos 44×44 px en cada estado en que aparece).
7. **El nivel de jsdom no es redundante con el de Chromium, y esa asimetría es el motivo de
   existir.** El navegador de test tiene la raíz a 16 px, así que un `2.75rem` **pasa** el test
   de navegador y falla en un host con raíz de 14 px. Solo el aserto de mecanismo ve esa
   regresión. Los dos niveles fallan de forma distinta: jsdom ve el suelo declarado y la
   cobertura del inventario; Chromium ve el tamaño real.
8. **Cada control se mide en los estados en que aparece**: estado vacío, turno en curso,
   confirmación de «Nueva conversación» abierta y «Ir al final» visible. Un control que no
   está en pantalla no se mide.
9. **Los controles deshabilitados no se miden, y se comprueba que no se miden.** El botón de
   enviar está deshabilitado con el campo vacío y las sugerencias durante el turno: medirlos
   como si estuvieran activos certificaría algo que nadie puede tocar.
10. **No hay nivel manual.** El tamaño de un control se resuelve con números, igual que el
    contraste. No hay nada que solo una persona pueda comprobar.

## Consecuencias

- La raíz del documento deja de ser una variable del contrato: el widget cumple los 44 px con
  cualquier `font-size` del host.
- Un botón de icono futuro entra en el contrato por la vía normal —declarar su
  `data-chatbox-control` y medirse—, y si no cabe en 44×44 sin romper el diseño, la salida es
  una **excepción documentada con su motivo** en el inventario, no un suelo que se degrada en
  silencio. La guarda sigue exigiendo que el control esté inventariado.
- El markup de producción gana siete atributos `data-chatbox-control`: los seis controles que
  se miden y el campo de texto, que se declara exento con su motivo. Son inertes y son el
  precio de que la guarda sea exacta. Sus valores se declaran en la lista blanca del inventario
  de textos (RF-F62), porque aquel escáner los detectaría como literales sin centralizar.
- El contrato tiene más controles que los que enumera la especificación (seis frente a
  cuatro): la especificación enumera ejemplos, y el widget decide. La spec de RF-F43 lo deja
  escrito.
- Un sitio host que aplique `!important` sobre `button` puede bajar el suelo. El widget no
  puede impedirlo y no lo intentará: es un límite explícito, no un defecto silencioso.
- El textarea queda fuera del contrato. Si el requisito pasara a «todo control», entra con un
  cambio pequeño: ya cumple 44 px de alto.

## Alternativas rechazadas

- **Solo CSS**: no hay detector. Una modificación de estilos posterior puede devolver un botón
  a 32 px sin que nada se entere, y el RF se cierra con un sello falso.
- **Solo Chromium**: el navegador de test tiene la raíz a 16 px, así que no distingue un 44 px
  real de un `2.75rem` que en un host con raíz de 14 px quedaría en 38,5.
- **Solo jsdom**: verifica que el CSS declara 44 px, no que el control mida eso.
- **Área de golpeo mayor que la caja visible**: la medición deja de ser la caja del elemento, y
  un halo invisible puede solaparse con el control vecino en un footer denso.
- **Medir también los enlaces en línea y el textarea**: los enlaces tienen excepción explícita
  en WCAG 2.5.8 y el textarea es un campo de texto. Ensancharlos sería ruido de diseño, no
  accesibilidad.
- **Un token `--chatbox-touch-target`**: haría del suelo un tema, y un host podría bajarlo. El
  piso es una garantía, no un tema.
- **Contar botones en el markup en vez de identificarlos**: el recuento no dice *qué* control es
  el nuevo, y un control puede cambiar de sitio sin cambiar de número.
- **Nivel manual con checklist**: no hay nada que solo una persona pueda comprobar.
