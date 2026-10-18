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
