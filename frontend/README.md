# @jlizancandela/chatbox

Widget de chat con **respuestas fundamentadas**: pregunta sobre un corpus documental y el
asistente responde con lo que hay en esos documentos, citando de dónde sale cada respuesta.

Es el widget que usa [jorgelizancandela.com](https://jorgelizancandela.com), publicado
en el registro npm de **GitHub Packages** para que cualquier sitio pueda instalarlo con
`npm i`.

## Instalación

El paquete vive en el **registro npm de GitHub Packages**, no en npmjs.org. Para
instalarlo, el proyecto que lo consume necesita apuntar ese scope al registro de
GitHub y autenticarse:

```bash
# .npmrc del proyecto que consume el widget
@jlizancandela:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```bash
npm i @jlizancandela/chatbox
```

El token es un **PAT (classic) de GitHub** con el permiso `read:packages`. GitHub
Packages pide autenticación para instalar también los paquetes públicos, así que sin
token no hay `npm i`.

El paquete se distribuye **como fuente**: no hay `dist` ni paso de build al instalar. El
bundler del sitio compila el TypeScript del widget y resuelve su hoja de estilos. El
único peer dependency es `preact`:

```bash
npm i @jlizancandela/chatbox preact
```

## Los dos exports

| Import | Qué trae |
|---|---|
| `@jlizancandela/chatbox` | El componente `Chatbox` y los tipos del contrato. |
| `@jlizancandela/chatbox/element` | El custom element `<chatbox-widget>`. |

Son exports separados a propósito: quien usa el componente no carga el elemento, y quien
usa el elemento no carga el resto del widget dos veces.

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

Y la integración de Preact, con `compat` activado (ver [ Notas para quien
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
| `variant` | No | `"floating"` | `"floating"` (lanzador en la esquina) o `"embedded"` (sección en el flujo de la página). |
| `initiallyCollapsed` | No | `true` si es flotante | Si la variante flotante nace contraída. |

El widget trae sus propios estilos, todos bajo la clase `.chatbox`: no toca `:root` ni las
variables del sitio. Para cambiarle el color, el sitio sobrescribe los tokens
`--chatbox-*` desde cualquier ancestro.

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
| `variant` | `variant` | `floating` (por defecto) o `embedded`. |
| `initially-expanded` | `initiallyCollapsed` | Atributo booleano: presente, el widget nace expandido. Sin él, la variante flotante nace contraída. |

`initially-expanded` se llama así, y no `initially-collapsed`, porque en HTML un
atributo booleano está presente o no está: `initially-collapsed="false"` seguiría
valiendo `true`. El atributo declara el estado afirmativo y, si no está, el widget
decide lo suyo.

Como en el componente, el estado contraído es el inicial de la variante flotante y se
abre con el lanzador.

## Notas para quien integra

- **El alias `react → preact/compat` es obligatorio.** El widget renderiza el Markdown
  con `react-markdown`, que es una librería de React: sin el alias, el sitio acabaría
  con dos frameworks en el bundle y el Markdown no se pintaría bien. Con Vite y el preset
  de Preact el alias viene puesto; en Astro hay que activarlo, porque la integración no
  lo activa por su cuenta:

  ```js
  // astro.config.mjs
  preact({ compat: true });
  ```

  El alias cubre `react`, `react/jsx-runtime` y `react-dom`.
- **El paquete es fuente.** El typecheck del sitio puede acabar leyendo el TypeScript
  del widget: `skipLibCheck` solo salta los `.d.ts`, y aquí no hay ninguno. Con
  `moduleResolution: "bundler"` (el valor por defecto de Astro) funciona; con
  `node16`/`nodenext` hay que apuntar a los tipos a mano.
- **`preact` es peer dependency.** La gama es `^10.6.5 || ^11.0.0`: el widget usa la API
  clásica de Preact y sirve con las dos.

## Desarrollo en este repositorio

Este README es el que muestra npm. El día a día del repositorio —los comandos, el
reparto de los tests y las reglas del widget— está en [`AGENTS.md`](AGENTS.md) y en
[`TODO.md`](TODO.md).

## Licencia

MIT.
