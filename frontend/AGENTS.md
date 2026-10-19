# Frontend Chatbox — AGENTS.md

## Propósito

El frontend es un widget de chat para el MVP RAG de Chatbox. Envía preguntas al
API, recibe respuestas fundamentadas mediante Server-Sent Events (SSE) y muestra
la respuesta progresivamente. El asistente solo debe responder con información
del perfil documental de Jorge.

El frontend no ingiere documentos, no genera embeddings y no persiste datos en
el servidor. Es un cliente independiente del API y debe poder integrarse
posteriormente en Astro.

## Monorepo

Chatbox es un monorepo cuya raíz está en la carpeta padre de `frontend/`:

```text
chatbox/
├── api/       # Backend Fastify, RAG, PostgreSQL y SSE
├── frontend/  # Aplicación Preact/Vite de este documento
└── docs/      # Especificaciones y documentación compartida
```

Las operaciones Git, las ramas, las issues, las pull requests y los merges se
gestionan desde la raíz del repositorio, no desde un repositorio Git separado
dentro de `frontend/`.

## Estado del MVP

La fuente de verdad del progreso es `TODO.md`.

## Stack y comandos

- UI: Preact.
- Bundler y desarrollo: Vite.
- Lenguaje: TypeScript.
- SSE: `eventsource-parser` + `fetch` nativo.
- Markdown: `react-markdown` mediante Preact Compat.
- Calidad: Biome.
- Gestor de paquetes del frontend: npm (`package-lock.json`).

Cuidado: el TypeScript instalado (7.0.2) es el port nativo. `require('typescript')`
solo expone `version` y `versionMajorMinor`; no hay `createSourceFile` ni
`createScanner`. Para parsear código en un test, usar `@babel/parser` (con
`@babel/types` para tipar los nombres de nodo).

Antes de escribir a mano un parser, escáner o utilidad de este tipo, revisar
`node_modules` y el lockfile por una dependencia que ya lo resuelva. Vite y sus
dependencias traen parser y muchos helpers; escribirlos a mano sale más caro y
más frágil.

Ejecutar desde `frontend/`:

```bash
npm install       # instalar dependencias
npm run dev       # servidor de desarrollo, normalmente :5173
npm run build     # build de producción
npm run preview   # servir el build de producción
npm run lint      # Biome sobre src/
npm run lint:fix  # aplicar correcciones de Biome
npm run format    # formatear src/
```

## Arquitectura y estructura

La organización debe hacer visible la funcionalidad de chat (Screaming
Architecture). Todo código específico del chat debe vivir bajo `src/chat/`.
La raíz de `src/` queda reservada para el arranque de la aplicación, estilos
globales, assets y declaraciones de entorno.

Estructura actual y responsabilidades:

```text
src/
├── chat/
│   ├── application/
│   │   └── chat-reducer.ts # Estado y transiciones del turno
│   ├── components/
│   │   ├── AssistantMarkdown.tsx  # Renderer Markdown del asistente
│   │   └── ExternalLink.tsx          # Enlace externo seguro
│   ├── domain/
│   │   └── conversation.ts # Reglas puras de conversación
│   ├── hooks/
│   │   ├── useChat.ts      # Estado reactivo local
│   │   └── useChatStream.ts # Fetch, SSE, abort y timeout
│   ├── infrastructure/
│   │   ├── sse.ts          # Adaptador de frames SSE y payloads del API
│   │   └── storage.ts      # Adaptador de sessionStorage
│   └── types.ts            # Tipos compartidos del contrato frontend/API
├── components/             # Punto de entrada del widget (Chatbox.tsx)
├── hooks/                  # Orquestación de interacción/streaming
├── assets/
├── index.tsx               # Arranque de la aplicación
└── style.css               # Estilos globales
```

Ubicar cada archivo nuevo según su responsabilidad:

- `chat/components/`: componentes específicos de renderizado de chat (Markdown, enlaces seguros, etc.).
- `chat/domain/`: reglas puras, límites y tipos específicos del dominio.
- `chat/application/`: casos de uso y orquestación.
- `chat/infrastructure/`: fetch, SSE, storage y adaptadores externos.
- `chat/hooks/`: ciclo de vida del stream y estado de interacción.
- `components/`: reservado al punto de entrada del widget (`Chatbox`).

Los tests deben vivir fuera de `src/`, bajo `test/`, y organizarse por tipo
(`unit/`, `component/` y `browser/`). La fuente autoritativa del reparto es
`.specs/47-test-layout.md`. Los tests de navegador usan Playwright y terminan en
`.spec.ts`; Vitest solo descubre `.test.ts` y `.test.tsx`. No crear archivos
genéricos como `src/utils.ts`, `src/helpers.ts` o `src/types.ts` para
funcionalidad del chat. Si una responsabilidad todavía no
justifica una carpeta, mantenerla dentro del módulo de chat más cercano sin
crear una estructura global prematura. No mover carpetas solo por anticipación:
cada nueva carpeta debe responder a una responsabilidad real.

## Contrato con el API

Endpoint principal:

```http
POST /api/chat
Content-Type: application/json
```

Body:

```json
{
  "question": "Pregunta del usuario",
  "history": [
    { "role": "user", "content": "Pregunta anterior" },
    { "role": "assistant", "content": "Respuesta anterior" }
  ]
}
```

La respuesta correcta es `text/event-stream` con esta secuencia:

| Evento | Payload | Uso frontend |
|---|---|---|
| `sources` | `{ sources, history }` | Guardar fuentes y sincronizar el contexto canónico. |
| `token` | `{ token }` | Añadir texto a la respuesta en curso. |
| `done` | `{}` | Cerrar el turno correctamente. |
| `error` | `{ message }` | Mostrar un error propio, nunca el mensaje interno. |

Sin contexto suficiente, el API envía `sources: []` y `done`, sin tokens. El
frontend debe mostrar el mensaje local definido por la especificación.

Los errores HTTP previos al stream pueden ser `400`, `413`, `429` o `5xx`. El
frontend debe traducirlos a textos propios y no mostrar el JSON interno del
API.

Límites que deben mantenerse alineados con el API:

- Pregunta: máximo 1000 caracteres.
- Mensaje de historial: máximo 2000 caracteres.
- Historial: máximo 20 mensajes.
- Historial total: máximo 8000 caracteres.

## Decisiones técnicas

- Usar `fetch` nativo porque el endpoint es `POST` y necesita body JSON.
- Usar `eventsource-parser` para recomponer chunks y frames SSE; no
  implementar el protocolo manualmente.
- No usar `EventSource` nativo: solo admite `GET` y no permite enviar el body
  de esta petición.
- No usar `sse.js`: es un polyfill basado en `XMLHttpRequest` y no es necesario
  para navegadores modernos.
- Mantener `messages` (transcripción visible) separado de `context` (historial
  enviado al API).
- No introducir autenticación, WebSockets, persistencia server-side ni
  visualización de fuentes en el MVP.

## Reglas de UI, seguridad y accesibilidad

- Los mensajes del usuario se renderizan como texto plano.
- El Markdown del asistente se limita a los elementos permitidos por la
  especificación; no usar HTML crudo.
- Sanitizar o validar URLs antes de crear enlaces.
- No mostrar mensajes internos del API ni detalles de errores de proveedores.
- No incluir claves, secretos ni URLs privadas en el bundle.
- Mantener navegación por teclado, foco visible, labels y anuncios accesibles.
- Respetar `prefers-reduced-motion`, `dvh`, safe areas y el zoom de iOS.
- Cancelar streams con `AbortController` y no añadir turnos incompletos al
  contexto.

## Flujo de trabajo

Este proyecto no sigue un flujo formal de planning/approval. Los cambios se
gestionan con sentido común: specs en `.specs/`, decisiones en `../docs/decisions/`,
y commits limpios antes de PR.

Las specs de implementación se guardan en `.specs/` usando el identificador
del issue y un slug descriptivo. Las decisiones generales de proceso se
guardan en `../docs/decisions/`, no en `.specs/`.

Al revisar cambios, incluir explícitamente los archivos untracked: `git diff HEAD`
los omite. No usar `git add -N` para colarlos en el diff: lint-staged rechaza el
commit si hay archivos staged con `--intent-to-add`.

## Ámbito de la revisión

Todo test cuyo trabajo sea **detectar** algo (inventario, guarda, escáner, validador, o
un test que asegura una ausencia) debe incluir en el mismo commit al menos una entrada
que rechaza, y esa entrada debe fallar de verdad si el mecanismo se rompe. Un detector
cuyo test nunca falla no protege nada, por muy limpio que se lea el código. Las reglas
mecánicas (nombres de nodo, APIs prohibidas, ubicación de archivos) se sostienen con el
typecheck o el linter, no con revisión a ojo.

## Verificación mínima

Para cualquier cambio de código:

```bash
npx biome check src test
npm run typecheck
npm run build
npm test -- --run
```

Desde la raíz del monorepo, el hook pre-commit ejecuta `lint-staged`, Biome, el
typecheck y la suite completa del frontend. Si el hook falla, se arregla la
causa: no se salta con `--no-verify`. CI (`frontend.yml`) ejecuta los mismos
pasos en cada PR que toca `frontend/**`. Los cambios de streaming deben incluir pruebas
para frames partidos, varios frames en un chunk, payloads con `history`,
abortos, errores mid-stream y cierre sin `done` cuando se implemente el hook
correspondiente.

### Tests de theming en jsdom

jsdom no resuelve `var(--token)` dentro de `getComputedStyle`, y tampoco evalúa
`@media` ni consulta `matchMedia` en la cascada: con
`matchMedia('(prefers-color-scheme: dark)')` devolviendo `true`, el estilo
computado sigue mostrando el bloque base. Los tests de CSS deben verificar el
mecanismo (regla presente en `document.styleSheets`, token declarado, orden de
capas) o ejecutarse en un browser real con el esquema de color emulado si
necesitan el valor final resuelto. El reparto entre verificación de mecanismo y
de resolución está en `../docs/decisions/002-css-theming-test-strategy.md`.

### Code review

Cada cambio debe revisarse contra dos ejes antes de mergear: estándares del
repositorio y fidelidad al spec/issue. Para cambios pequeños, el autor puede
hacer ambos checks y documentar los resultados; para cambios mayores o con
riesgo arquitectónico, debe participar un reviewer independiente. En todos los
casos, la revisión debe comprobar diff, tests, build y estado limpio del árbol.

## Referencias

- Estado: `TODO.md`.
- Especificación: `../docs/stitch-frontend-design/SPEC-FRONTEND.md`.
- Contrato API: `../api/README.md` y `../api/src/services/chat.ts`.
- Planes de implementación: `.specs/`.
