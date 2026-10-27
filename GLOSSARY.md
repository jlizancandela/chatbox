# Glosario

Vocabulario compartido del repositorio. Definido en RF-F61 (tema), RF-F62 (textos de
UI), RF-F41 (región de estado), RF-F42 (contraste), RF-F43 (objetivos táctiles), RF-F44
(movimiento reducido), RF-F45 (nombres accesibles) y RF-F50 (viewport móvil); cuando un
término falte, se declara aquí como decisión de modelado en lugar de inventarlo en issues,
specs o tests.

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
  única razón para modelar una entrada de `strings.es.ts` como función. Hay dos: el
  contador de caracteres (`input.chars`) y la línea de fuentes de la respuesta
  (`messages.sources`), cuyo texto es fijo y lo que cambia son los títulos de los
  documentos.
- **Lista blanca**: literales permitidos fuera de `strings.es.ts`, declarados de forma
  explícita en el test de inventario para que la lista sea auditable en un vistazo.

## Región de estado y anuncios (RF-F41)

- **Región de estado**: el único elemento del widget que un lector de pantalla trata como
  zona de anuncio (`role="status"`). Recibe un texto y lo dice una vez. La lista de mensajes
  no es una región de estado: anunciar cada token hace la respuesta inusable. Anuncia
  siempre, pero **pinta solo lo que no está en la conversación**: el desenlace de un turno
  completado ya se ve en la burbuja (RF-F46) y el aviso «escribiendo» se ve dentro del
  bocadillo (RF-F47), así que la región los oculta visualmente sin sacarlos del árbol de
  accesibilidad. Lo que la región sí pinta es el error de un turno fallido y el aviso de un
  turno detenido: no aparecen en ningún otro sitio.
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
- **Contrato de la pasada automática**: el nivel auditado de axe —WCAG 2.0, 2.1 y 2.2, niveles
  A y AA—, la raíz del escaneo —el widget— y los ocho estados en que el widget puede
  encontrarse: vacío, turno en marcha, respuesta anunciada, turno sin respuesta, turno
  fallido, turno detenido, conversación restaurada y confirmación abierta. La pasada vive en
  Chromium: comprueba estructura y relaciones en el árbol de accesibilidad, no que un lector
  de pantalla hable. No tiene nivel manual.

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

## Respuesta fundamentada y atribución

- **Fragmento etiquetado**: fragmento recuperado que se entrega al modelo con un
  número y el título de su documento de origen (`[1] Currículum — ...`). El número
  ordena los fragmentos; el título dice de dónde sale el dato.
- **Espacio de embeddings**: conjunto de vectores comparables entre sí. Cambiar el
  modelo, la dimensión o el tipo de tarea de embedding abre un espacio nuevo: los
  vectores del anterior dejan de ser comparables con los nuevos.
- **Firma de embeddings**: identificador de la configuración que produce un espacio
  de embeddings (modelo, dimensión y tipo de tarea). Forma parte de la versión de un
  documento, de modo que cambiar la firma invalida el corpus y obliga a reingerirlo.
- **Atribución**: vínculo entre una respuesta y los documentos de los que procede.
  Se muestra en la línea de fuentes del widget, no como marcadores dentro del texto.
- **Reingestada**: volver a embeber un documento ya presente. Solo produce vectores
  nuevos si la firma de embeddings ha cambiado; si no, el documento se reactiva sin
  rehacer sus fragmentos.

## Seguimiento del hilo (RF-F06/RF-F48)

- **Umbral de seguimiento**: distancia máxima al final de la conversación que todavía se
  considera seguimiento. Son 16 px fijos: más allá, la persona está apartada y el botón
  «Ir al final» aparece; no depende de la altura del widget.

## Movimiento reducido del widget (RF-F44)

- **Movimiento reducido**: la preferencia del sistema operativo que pide menos movimiento en
  la interfaz. En el widget significa exactamente dos cosas: el indicador de escritura no se
  anima y el scroll no es suave. No es una propiedad del tema: el sitio host no la hereda ni
  puede bajarla.
- **Aviso de escritura**: la frase «El asistente está escribiendo» que se ve dentro del
  bocadillo del asistente mientras el turno está en marcha y la respuesta todavía no ha
  llegado (RF-F47). Es decorativa —`aria-hidden`—: la anuncia la región de estado, y así no se
  duplica texto visible y audible. Es el mismo texto que se anuncia, en el mismo momento.
- **Indicador de escritura**: los tres puntos de la burbuja del asistente que señalan que la
  respuesta está en camino: mientras llega, y mientras el markdown ya recibido se carga (RF-F46). Es visual y decorativo —no se anuncia, porque el anuncio
  vive en la región de estado— y con movimiento reducido son los mismos tres puntos sin
  animación. No es el aviso de "escribiendo" de la región, que es texto y se anuncia.
- **Contrato de movimiento**: inventario de las fuentes de movimiento del widget —el indicador
  de escritura y el scroll suave— más la guarda que impide que una regla nueva declare
  movimiento fuera de ese inventario. Se verifica en dos niveles —mecanismo y resolución— y no
  tiene nivel manual.

## Nombres accesibles del widget (RF-F45)

- **Nombre accesible**: lo que un lector de pantalla anuncia cuando llega a un control. No es
  un atributo: es el resultado de las reglas de nombre del navegador —el contenido, el
  `aria-label`, el `aria-labelledby` y la etiqueta asociada—. En el widget lo computa el
  navegador, no el código: por eso se verifica en dos niveles.
- **Etiqueta asociada**: etiqueta que nombra a un campo de formulario. Se asocia de dos
  formas: con `for`/`id`, o envolviendo al campo. El texto de la etiqueta es el nombre
  accesible del campo.
- **Botón solo-icono**: botón cuyo contenido visible no es texto —un icono, un pictograma— y
  que por tanto tiene que declarar su nombre con `aria-label` (o `aria-labelledby`). Sin
  nombre, un lector de pantalla anuncia «botón» y nada más. Lo que es `aria-hidden` —un `×`
  decorativo— no cuenta como texto visible.
- **Contrato de nombres accesibles**: las reglas que obligan a que todo control del widget
  tenga nombre y a que la raíz declare el idioma del componente, más la guarda que hace que
  un control nuevo sin nombre rompa la compilación. Se verifica en dos niveles —mecanismo sobre
  el código y resolución sobre el árbol de accesibilidad— y no tiene nivel manual. A
  diferencia del contrato de objetivos táctiles, no es un inventario de controles: es un
  inventario de reglas, y por eso no se queda viejo cuando aparece un control nuevo.

## Viewport móvil del widget (RF-F50)

- **Viewport dinámico**: la altura de la ventana que acompaña a la barra del navegador móvil
  cuando esta se recoge o se despliega. Se expresa en `dvh` y es la unidad con la que el
  widget topa su altura: `vh` mide el viewport con la barra desplegada —el más alto de los
  tres— y `svh` el más bajo, con el que el widget no llenaría la pantalla.
- **Safe area**: la franja que el sistema reserva para el notch y para el indicador de inicio.
  El navegador la publica como `env(safe-area-inset-*)` y vale cero en un escritorio. El
  widget la **suma** a su padding base, nunca la sustituye: el contenido se separa del borde
  de la pantalla y el widget no pierde su propio espaciado.
- **Suelo de tamaño de fuente**: los 16 px absolutos que el campo de texto no puede bajar.
  iOS Safari amplía la página al enfocar un campo de menos de 16 px, y el desplazamiento que
  provoca deja la conversación fuera de la vista. El suelo es del widget, no del tema: la
  raíz del documento —y con ella el tamaño de fuente del sitio host— no es una variable del
  contrato.
- **Contrato de viewport móvil**: las tres reglas —altura topada por el viewport dinámico,
  safe areas sumadas al padding base y suelo de tamaño de fuente en el campo— más la guarda
  que impide que una regla nueva rompa cualquiera de ellas. Se verifica en dos niveles
  —mecanismo y resolución— y no tiene nivel manual. Como en el contrato de objetivos táctiles,
  el inset es del entorno y no un token: el sitio host no puede anularlo en silencio.
