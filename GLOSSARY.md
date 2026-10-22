# Glosario

Vocabulario compartido del repositorio. Definido en RF-F61 (tema), RF-F62 (textos de
UI), RF-F41 (región de estado), RF-F42 (contraste), RF-F43 (objetivos táctiles) y RF-F44
(movimiento reducido); cuando un término falte, se declara
aquí como decisión de modelado en lugar de inventarlo en issues, specs o tests.

## Tema del widget (RF-F61)

- **Tema (chatbox)**: combinación de los 7 tokens semánticos de color del widget,
  expresada como defaults en `.chatbox` y override por cascada desde cualquier ancestro.
- **Sitio host**: sitio web que embebe el widget del chatbox. En MVP es una página Astro,
  pero el contrato no acopla a Astro.
- **Self-contained**: el widget no escribe en `:root` ni depende de variables globales del
  sitio host. Sus defaults viven dentro de `.chatbox` y son portables entre hosts.
- **Override por cascada**: mecanismo por el cual el sitio host sobrescribe los tokens del
  chatbox desde cualquier ancestro del subtree, aprovechando la cascada CSS. El host puede
  mapear sus propias variables a las del chatbox o pisar valores literales; el chatbox no
  consulta directamente las variables del host.

## Textos de la interfaz (RF-F62)

- **Texto de UI**: cadena que una persona lee en la interfaz o que un lector de pantalla
  anuncia. No incluye clases CSS, valores técnicos de `aria-*` (tales como
  `aria-labelledby` o `aria-live`), claves de `sessionStorage` ni identificadores
  técnicos como `chatbox-question`.
- **Cadena fija**: valor constante dentro de `strings.es.ts`, modelado como entrada de un
  registro o de un objeto `as const`.
- **Interpolación real**: hueco de texto que se rellena con un valor de ejecución. Es la
  única razón para modelar una entrada de `strings.es.ts` como función.
- **Lista blanca**: literales permitidos fuera de `strings.es.ts`, declarados de forma
  explícita en el test de inventario para que la lista sea auditable en un vistazo.

## Región de estado y anuncios (RF-F41)

- **Región de estado**: el único elemento del widget que un lector de pantalla trata como
  zona de anuncio (`role="status"`). Recibe un texto y lo dice una vez. La lista de mensajes
  no es una región de estado: anunciar cada token hace la respuesta inusable.
- **Anuncio**: el texto que una región de estado comunica en un momento dado. El widget
  anuncia una vez por turno —inicio, desenlace y, si procede, la respuesta completa— y
  nunca anuncia algo que no acabe de producir: restaurar una conversación no es anunciar.
- **Proyección de anuncio**: versión en texto plano del markdown que se entrega al anuncio.
  Solo afecta a lo que se oye; el mensaje visible conserva su markdown. No es un parser de
  markdown: lo que no reconoce, lo deja intacto, y ante la duda no reescribe — oír un
  asterisco es un detalle; borrar el año de una respuesta es un error.
- **Turno**: ciclo completo de una pregunta y su respuesta, desde que se envía hasta que
  termina bien, mal o detenido. Un turno produce exactamente un anuncio de desenlace, y el
  aviso de "escribiendo" es lo que precede a ese anuncio en la región.

## Contraste del widget (RF-F42)

- **Piso de contraste**: el mínimo que debe alcanzar cada combinación de tinta y fondo del
  widget: 4.5:1 para el texto y 3:1 para los componentes visuales y el anillo de foco. Es un
  límite, no un valor objetivo: por debajo, la combinación no está permitida.
- **Componente visual**: elemento del widget con borde visible o con anillo de foco. Es la
  categoría que protege el piso de 3:1. Un control deshabilitado no es componente visual:
  WCAG exime a los componentes inactivos.
- **Anillo de foco**: indicador de foco del widget. Se mide contra las superficies del propio
  widget, nunca contra el fondo del sitio host, porque el widget no controla ese fondo. Como
  se dibuja desplazado, cae sobre el fondo del contenedor y no sobre el del control.
- **Token por defecto**: valor de un token de color con la paleta por defecto del widget. La
  garantía de contraste se refiere a estos valores: un sitio host que los sobrescriba es
  responsable de su contraste.
- **Contrato de contraste**: tabla de combinaciones de tinta y fondo con su piso, más la guarda
  que impide que un color entre al widget sin fila. Se verifica en dos niveles: mecanismo
  (unidad) y resolución (navegador).

## Objetivos táctiles del widget (RF-F43)

- **Objetivo táctil**: área mínima que un control de activación del widget ofrece a un dedo:
  44×44 px CSS. Es un suelo, no un objetivo de diseño: un control puede medir más.
- **Control táctil**: elemento del widget que se activa con un puntero y cuyo tamaño el widget
  controla. En el widget son los botones: enviar y detener, nueva conversación, la confirmación
  en línea, las sugerencias y «Ir al final». No lo son los enlaces en línea —que tienen la
  excepción *inline* de WCAG 2.5.8— ni el campo de texto, que es un campo y no un control de
  activación.
- **Caja del control**: rectángulo que el control ocupa en el layout (su *border-box*). En el
  widget la caja del control **es** el área que recibe el puntero: no hay áreas de golpeo
  invisibles que amplíen un botón por debajo de lo que se ve.
- **Exención de control inactivo**: un control deshabilitado no tiene objetivo táctil. WCAG
  exime a los componentes inactivos, y el widget baja la opacidad de los deshabilitados: medirlos
  como si estuvieran activos certificaría algo que nadie puede tocar.
- **Contrato de objetivos táctiles**: inventario de controles, suelo de 44 px y guarda que hace
  que un control nuevo sin inventariar rompa la compilación. Se verifica en dos niveles
  —mecanismo en jsdom y resolución en Chromium— y no tiene nivel manual.

## Movimiento reducido del widget (RF-F44)

- **Movimiento reducido**: la preferencia del sistema operativo que pide menos movimiento en
  la interfaz. En el widget significa exactamente dos cosas: el indicador de escritura no se
  anima y el scroll no es suave. No es una propiedad del tema: el sitio host no la hereda ni
  puede bajarla.
- **Indicador de escritura**: los tres puntos de la burbuja del asistente vacío que señalan
  que la respuesta está en camino. Es visual y decorativo —no se anuncia, porque el anuncio
  vive en la región de estado— y con movimiento reducido son los mismos tres puntos sin
  animación. No es el aviso de "escribiendo" de la región, que es texto y se anuncia.
- **Contrato de movimiento**: inventario de las fuentes de movimiento del widget —el indicador
  de escritura y el scroll suave— más la guarda que impide que una regla nueva declare
  movimiento fuera de ese inventario. Se verifica en dos niveles —mecanismo y resolución— y no
  tiene nivel manual.
