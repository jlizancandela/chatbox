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

La fuente de verdad del progreso es `TODO.md`. La especificación funcional está
en `../docs/stitch-frontend-design/SPEC-FRONTEND.md`.

### Completado

- Proyecto base Vite + Preact + TypeScript.
- Biome configurado como formatter y linter.
- `react-markdown` instalado y compatible con Preact Compat.
- Tipos del contrato SSE en `src/types.ts`.
- Adaptador SSE en `src/chat/infrastructure/sse.ts`, basado en
  `eventsource-parser`.
- Build de producción verificado con `npm run build`.

### Pendiente principal

- Estado y persistencia de conversación.
- Hook `useChatStream` con fetch, abort, timeout y estados del turno.
- Componente `Chatbox` y renderizado de mensajes.
- Accesibilidad, responsive, integración Astro y pruebas.

No marcar tareas como completadas hasta implementar y verificar el comportamiento
correspondiente.

## Stack y comandos

- UI: Preact.
- Bundler y desarrollo: Vite.
- Lenguaje: TypeScript.
- SSE: `eventsource-parser` + `fetch` nativo.
- Markdown: `react-markdown` mediante Preact Compat.
- Calidad: Biome.
- Gestor de paquetes del frontend: npm (`package-lock.json`).

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

La organización debe hacer visible la funcionalidad de chat (estilo Screaming
Architecture), evitando una carpeta global `tools/` que se convierta en un
cajón de utilidades.

Estructura actual y responsabilidades:

```text
src/
├── chat/
│   ├── domain/
│   │   └── conversation.ts # Estado y reglas de conversación
│   ├── infrastructure/
│   │   └── sse.ts          # Adaptador de frames SSE y payloads del API
│   └── types.ts            # Tipos compartidos del contrato frontend/API
├── components/          # Componentes de UI del chat (pendiente)
├── hooks/               # Orquestación de interacción/streaming (pendiente)
├── assets/
├── index.tsx
└── style.css
```

Cuando crezca el módulo, preferir separar por responsabilidad dentro de
`src/chat/`:

- `components/`: presentación y eventos de UI.
- `hooks/`: ciclo de vida del stream y estado de interacción.
- `application/`: casos de uso como enviar una pregunta o cerrar un turno.
- `infrastructure/`: fetch, SSE, storage y adaptadores externos.
- `domain/`: reglas puras de conversación, límites y tipos específicos, cuando
  el dominio lo justifique.

No mover carpetas solo por anticipación: cada nueva carpeta debe responder a
una responsabilidad real.

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

El flujo global de planificación, aprobación, commits, PRs y merge está definido
en los skills `plan` y `comitear`. Este proyecto debe seguirlo y no se deben
modificar archivos de implementación sin un plan aprobado.

Las specs de implementación se guardan en `.specs/` usando el identificador
del issue y un slug descriptivo. Las decisiones generales de proceso se
guardan en `../docs/decisions/`, no en `.specs/`.

## Verificación mínima

Para cualquier cambio de código:

```bash
npx biome check src
npm run build
```

Los cambios de streaming deben incluir pruebas para frames partidos, varios
frames en un chunk, payloads con `history`, abortos, errores mid-stream y cierre
sin `done` cuando se implemente el hook correspondiente.

## Referencias

- Estado: `TODO.md`.
- Especificación: `../docs/stitch-frontend-design/SPEC-FRONTEND.md`.
- Contrato API: `../api/README.md` y `../api/src/services/chat.ts`.
- Planes de implementación: `.specs/`.
