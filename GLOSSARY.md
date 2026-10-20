# Glosario

Vocabulario compartido del repositorio. Definido en RF-F61 (tema) y RF-F62 (textos de
UI); cuando un término falte, se declara aquí como decisión de modelado en lugar de
inventarlo en issues, specs o tests.

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
