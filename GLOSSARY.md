# Glosario

Vocabulario compartido del repositorio. Definido en RF-F61 (tema), RF-F62 (textos de
UI), RF-F41 (región de estado), RF-F42 (contraste), RF-F43 (objetivos táctiles), RF-F44
(movimiento reducido), RF-F45 (nombres accesibles), RF-F50 (viewport móvil), RF-F51
(teclado virtual), RF-F64 (variantes y estados del widget) y el Paso 7 (paquete npm);
cuando un término falte, se declara aquí como decisión de modelado en lugar de inventarlo
en issues, specs o tests.

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
- **Turno cerrado**: turno que ya terminó, con desenlace. Al cerrarse, su pregunta entra
  siempre en el contexto —con o sin respuesta— y su respuesta entra solo si tiene texto.
  Un turno cerrado sin respuesta no inventa un mensaje vacío del asistente.
- **Respuesta parcial**: texto generado que se ha mostrado pero no ha cerrado su turno.
  Al cerrarse el turno pasa a ser un mensaje: lo que se ve es lo que se guarda. Lo que no
  llegó a pintarse no se guarda.
- **Regla de una sola puerta**: todo cierre de turno —terminado, fallido o detenido— pasa por
  la misma regla, de modo que la pregunta se guarda siempre y la respuesta solo si hay texto.
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

## Errores del stream (#144)

- **Código de error del stream**: discriminante de un evento `error`
  (`GENERATION_FAILED` o `QUOTA_EXHAUSTED`). El servidor clasifica; el texto que ve el
  visitante lo elige el widget. No es redacción de interfaz y no revela la causa interna.
- **Cuota agotada**: estado del proveedor de generación que responde `429`, distinto de un
  fallo del proveedor. La respuesta correcta no es «algo se rompió» sino «está ocupado,
  vuelve más tarde», y por eso viaja con su propio código.
- **Aviso de reintento**: segundos que el proveedor pide esperar antes de reintentar
  (`retry-after`). Viaja en el evento de error y se conserva en el error del widget; no
  dispara reintentos automáticos.

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

## Teclado virtual del widget (RF-F51)

- **Zona visible**: la banda del viewport de layout que está de verdad en la pantalla, del
  borde superior visible al inferior. La publica `window.visualViewport`: su `height`
  mengua cuando aparece el teclado virtual y su `offsetTop` dice dónde está su borde
  superior. No es lo mismo que el viewport de layout, que el teclado no encoge —por eso
  `dvh` no baja cuando se abre el teclado—.
- **Franja del teclado**: la parte de la zona visible que el teclado virtual tapa. Todo lo
  que queda por debajo de la zona visible está bajo el teclado. Es también lo que el widget
  reserva en su raíz para que su pie quede por encima del teclado.
- **Borde inferior del contenido**: el borde inferior de la caja de contenido de la raíz del
  widget —donde acaba el pie, y con él el campo de texto—. No es lo mismo que el borde
  inferior de la caja: la reserva vive en el padding de la raíz, así que uno es el otro
  menos lo reservado. Medir el correcto es lo que hace que la reserva se estabilice.
- **Contrato de teclado virtual**: la regla de que el widget reserva, en su raíz, la parte
  de su borde inferior que queda bajo el teclado, y solo si está anclado abajo; más la
  guarda que impide que una regla nueva rompa el CSS que la aplica. Se verifica en dos
  niveles —mecanismo y resolución— y no tiene nivel manual. La franja se mide en tiempo de
  ejecución, así que no es un token que el sitio host pueda anular en silencio.

## Variantes y estados del widget (RF-F64)

- **Variante del widget**: forma en que el widget se coloca en el sitio host. Es
  **embebida** —dentro del flujo del host, que le da la altura— o **flotante** —anclada a la
  esquina inferior derecha de la pantalla, con su propio tamaño—. No es un estado: describe
  dónde está el widget, no qué se ve. La flotante es la que se monta **por defecto**: el
  sitio aloja el chat como un lanzador en la esquina, y la embebida es la que se pide
  explícitamente.
- **Estado contraído**: el widget reducido a su lanzador, sin panel. Es el estado en que
  nace la variante flotante.
- **Estado expandido**: el widget con el panel completo. Es el estado en que estaba el
  widget antes de RF-F64.
- **Lanzador**: el control circular de 56×56 que, en el estado contraído, abre el widget.
  No es una «burbuja»: en este repositorio la burbuja es el bocadillo del mensaje del
  asistente.
- **Contraer**: llevar el widget al estado contraído. No es detener: el turno sigue vivo y
  la conversación se conserva. El botón que lo hace se nombra «Contraer el chat», con el
  mismo verbo del estado.
- **Anclaje del panel**: la esquina de la pantalla a la que se ancla la variante flotante —
  abajo a la derecha—, con la safe area sumada al margen y nunca sustituida (RF-F50).

## Distribución del widget (Paso 7)

- **Paquete del widget**: el manifiesto que vive en la **raíz** del repositorio y que el
  sitio instala como dependencia de git (`github:jlizancandela/chatbox#v0.1.0`). Se
  distribuye **como fuente**: lleva el TypeScript del widget y nada más, y el bundler del
  sitio compila. No hay registro ni cuenta de por medio, no hay `dist` ni paso de build al
  instalar, y el código sigue viviendo en `frontend/src`.
- **Tag del widget**: cada versión del paquete. Es lo único que hay que crear para
  publicar una versión nueva, y es lo que el sitio fija para quedarse en una versión.
- **Export del paquete**: cada entrada del mapa `exports` del manifiesto de la raíz. Son
  dos y están separados a propósito: `.` lleva el componente `Chatbox` y `./element` lleva
  el custom element. Quien usa el componente no carga el elemento.
- **Custom element del widget**: `<chatbox-widget>`, la puerta de entrada para un sitio
  que no integra Preact. No es una copia del widget: monta el mismo `Chatbox`, con las
  mismas props.
- **Atributo del elemento**: la forma que toma una prop cuando el widget se monta desde
  HTML. Es kebab-case de la prop (`api-url` → `apiUrl`), con una excepción: el
  atributo booleano `initially-expanded` declara el estado afirmativo, porque en HTML un
  atributo booleano está presente o no está y `initially-collapsed="false"` valdría
  `true`.
