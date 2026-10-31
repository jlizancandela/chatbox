# @jlizancandela/chatbox

[![Frontend CI](https://github.com/jlizancandela/chatbox/actions/workflows/frontend.yml/badge.svg?branch=main)](https://github.com/jlizancandela/chatbox/actions/workflows/frontend.yml) [![Widget tag](https://img.shields.io/github/v/tag/jlizancandela/chatbox?label=widget)](https://github.com/jlizancandela/chatbox/tags) ![Preact](https://img.shields.io/badge/Preact-673AB8?logo=preact&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)

Widget de chat con **respuestas fundamentadas**: pregunta sobre un corpus documental y el
asistente responde con lo que hay en esos documentos, citando de dónde sale cada respuesta.

Es el widget que usa [jorgelizancandela.com](https://jorgelizancandela.com), instalable
**directo desde este repositorio**: sin registro de paquetes, sin cuenta y sin token.

## Instalación

```bash
npm i github:jlizancandela/chatbox#v0.4.0
```

Cada versión del widget es un **tag** del repositorio (`v0.1.0`, `v0.2.0`, `v0.3.0`, `v0.4.0`…), así que
actualizar es cambiar el tag:

```bash
npm i github:jlizancandela/chatbox#v0.4.0
```

Lo que se instala es lo que declara el `package.json` de la raíz del repositorio: el
componente, el custom element y sus estilos. La app de desarrollo (`frontend/src/App.tsx`,
`index.tsx`, `style.css`) y los tests no viajan.

El paquete se distribuye **como fuente**: no hay `dist` ni paso de build al instalar. El
bundler del sitio compila el TypeScript del widget y resuelve su hoja de estilos. El
único peer dependency es `preact`, que aporta el sitio:

```bash
npm i github:jlizancandela/chatbox#v0.4.0 preact
```

## Los exports

| Import | Qué trae |
|---|---|
| `@jlizancandela/chatbox` | El componente `Chatbox` y los tipos del contrato. |
| `@jlizancandela/chatbox/element` | El custom element `<chatbox-widget>`. |
| `@jlizancandela/chatbox/vite` | La configuración de Vite que el sitio necesita para compilar el widget. |

Los dos primeros son exports separados a propósito: quien usa el componente no carga el
elemento, y quien usa el elemento no carga el resto del widget dos veces. El tercero no
es código del widget: es lo que hace falta en el `astro.config.mjs` o el `vite.config.ts`
del sitio (ver [Notas para quien integra](#notas-para-quien-integra)).

## Uso como componente (Preact, React, Astro)

```tsx
import { Chatbox } from "@jlizancandela/chatbox";

export default function Page() {
	return <Chatbox apiUrl="https://api.jorgelizancandela.com" />;
}
```

En Astro, con la integración de Preact y el widget hidratado:

```astro
---
import { Chatbox } from "@jlizancandela/chatbox";
---

<Chatbox apiUrl="https://api.jorgelizancandela.com" client:idle />
```

Y la integración de Preact, con `compat` activado (ver [Notas para quien
integra](#notas-para-quien-integra)):

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";

export default defineConfig({
	integrations: [preact({ compat: true })],
});
```

### Props

| Prop | Obligatoria | Por defecto | Qué hace |
|---|---:|---|---|
| `apiUrl` | Sí | — | URL del API del chatbox. |
| `suggestions` | No | Las del widget | Preguntas sugeridas del estado vacío. |
| `contactUrl` | No | — | Enlace de contacto, en el aviso de «no lo tengo». |
| `title` | No | «Asistente de Jorge» | Título de la cabecera. |
| `variant` | No | `"floating"` | `"floating"` (lanzador en la esquina), `"drawer"` (panel de altura completa pegado al borde derecho) o `"embedded"` (sección en el flujo de la página). |
| `initiallyCollapsed` | No | `true` si es flotante o cajón | Si la variante superpuesta nace contraída. |

El widget trae sus propios estilos, todos bajo la clase `.chatbox`: no toca `:root` ni las
variables del sitio. Para alinearlo con la marca del sitio, mapea los tokens de host (ver
[Tema](#tema)).

## Uso como custom element

Para un sitio que no integra Preact —HTML plano, un CMS, WordPress— el mismo widget se
monta con un elemento:

```html
<script type="module">
	import "@jlizancandela/chatbox/element";
</script>

<chatbox-widget api-url="https://api.jorgelizancandela.com"></chatbox-widget>
```

El elemento **no** es una copia del widget: monta el mismo `Chatbox`, con las mismas
props. Cada atributo es una prop:

| Atributo | Prop | Valor |
|---|---|---|
| `api-url` | `apiUrl` | Obligatorio. Sin él, el elemento no monta el widget y lo dice en la consola. |
| `suggestions` | `suggestions` | Lista separada por comas: `Uno, Dos`. |
| `contact-url` | `contactUrl` | Enlace de contacto. |
| `title` | `title` | Título de la cabecera. |
| `variant` | `variant` | `floating` (por defecto), `drawer` o `embedded`. |
| `initially-expanded` | `initiallyCollapsed` | Atributo booleano: presente, el widget nace expandido. Sin él, la variante superpuesta nace contraída. |

`initially-expanded` se llama así, y no `initially-collapsed`, porque en HTML un
atributo booleano está presente o no está: `initially-collapsed="false"` seguiría
valiendo `true`. El atributo declara el estado afirmativo y, si no está, el widget
decide lo suyo.

Como en el componente, el estado contraído es el inicial de las variantes superpuestas —la
flotante y el cajón— y se abre con el lanzador.

## Tema

El widget trae una paleta propia (los roles Material 3 de su diseño). Para alinearlo con la
marca del sitio, el host mapea los **tokens de host** en cualquier ancestro: `body`, el
contenedor del widget, o el propio widget para una instancia concreta.

```css
body {
	--chatbox-host-text: #131b2e;
	--chatbox-host-surface: #ffffff;
	--chatbox-host-primary: #3525cd;
	--chatbox-host-link: #006591;
	--chatbox-host-border: #777587;
	--chatbox-host-focus: #3525cd;
	--chatbox-host-error: #ba1a1a;
	--chatbox-host-surface-subtle: #f2f3ff;
	--chatbox-host-surface-raised: #e2e7ff;
	--chatbox-host-accent-container: #3525cd;
	--chatbox-host-font: "Geist", sans-serif;
}
```

La tipografía va en su propio token porque no cambia con el tema: una sola declaración alcanza a
todo el widget. Sin mapeo, el widget usa la pila del sistema, y no descarga ninguna webfont.

Un solo mapeo vale para claro y oscuro si apunta a variables del sitio que ya cambian con el
tema. Los diez roles, su uso y los pisos de contraste están en la
[spec de tema](https://github.com/jlizancandela/chatbox/blob/main/docs/specs/frontend/RF-F61-theming.md).

Declarar `--chatbox-color-*` en un ancestro **no** funciona: el widget declara esos tokens en
`.chatbox`, y la declaración propia gana a la heredada. El token de host se lee en `.chatbox`,
así que sí se hereda desde arriba.

El widget honra `data-theme="dark"` y `data-theme="light"` en un ancestro y, sin él, sigue
`prefers-color-scheme`. Las capas de `prefers-contrast: more` y `forced-colors: active` no
aceptan mapeo: la preferencia de la persona gana siempre.

## Notas para quien integra

- **Usa el preset de Vite.** El paquete trae la configuración que su código compilado
  necesita. Sin ella el sitio **compila bien y falla en el navegador** con
  `React is not defined`, así que no es opcional:

  ```js
  // astro.config.mjs
  import { chatboxViteConfig } from "@jlizancandela/chatbox/vite";

  export default defineConfig({
    // …
    vite: { ...chatboxViteConfig },
  });
  ```

  Trae dos cosas, y las dos hacen falta:

  1. **Los alias de `react` a `preact/compat`.** El widget renderiza el Markdown con
     `react-markdown`, que es una librería de React: sin el alias, el sitio acabaría con
     dos frameworks en el bundle y el Markdown no se pintaría bien.
  2. **El runtime JSX automático de Preact.** Los ficheros llegan como `.tsx` y un
     `tsconfig` dentro de `node_modules` **no se aplica** —comprobado: con el `tsconfig`
     en el tarball siguen saliendo 62 `React.createElement`—, así que sin esta opción
     esbuild compila el JSX con el runtime clásico y el bundle pide un `React` global
     que no existe.

  Si prefieres escribirlo a mano, es exactamente lo que exporta `chatboxViteConfig`.
- **El paquete es fuente.** El typecheck del sitio puede acabar leyendo el TypeScript
  del widget: `skipLibCheck` solo salta los `.d.ts`, y aquí no hay ninguno. Con
  `moduleResolution: "bundler"` (el valor por defecto de Astro) funciona; con
  `node16`/`nodenext` hay que apuntar a los tipos a mano.
- **`preact` es peer dependency.** La gama es `^10.6.5 || ^11.0.0`: el widget usa la API
  clásica de Preact y sirve con las dos. El sitio aporta su copia.
- **Instalar clona el repositorio.** Es una dependencia de git: npm trae el repo del
  tag y se queda solo con lo que declara el `files` de la raíz. No hay registro de por
  medio, y por eso tampoco hay actualizaciones automáticas: la versión la fija el tag.

## Desarrollo en este repositorio

El manifiesto que se instala es el `package.json` de la **raíz** del repositorio. El día
a día del widget —los comandos, el reparto de los tests y sus reglas— está en
[`AGENTS.md`](AGENTS.md) y en [`TODO.md`](TODO.md).

## Licencia

MIT.
