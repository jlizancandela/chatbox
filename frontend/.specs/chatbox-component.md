# Spec: implementación del componente `Chatbox`

## Estado

Implementación en curso en la rama `feature/chatbox-component`.

Esta spec documenta el alcance aprobado para el componente de UI que integra
`useChat`, `useChatStream` y la persistencia local del chat. La especificación
funcional general continúa en `../docs/stitch-frontend-design/SPEC-FRONTEND.md`.

## 1. Propósito

`Chatbox` será un widget Preact reutilizable que permita conversar con el API
SSE del proyecto Chatbox. Será responsable de la interacción de usuario, la
representación de estados del turno, el foco, el scroll y la persistencia local,
pero no de implementar el protocolo SSE ni la lógica de recorte del historial.

## 2. API pública

```ts
type ChatboxProps = {
  apiUrl: string;
  suggestions?: string[];
  contactUrl?: string;
  title?: string;
};
```

- `apiUrl` es obligatorio.
- `suggestions`, `contactUrl` y `title` son opcionales.
- El componente declarará `lang="es"`.
- No se compartirán stores entre distintas instancias del widget.

## 3. Dependencias internas

```text
Chatbox
  ├── useChat()
  │     └── chatReducer()
  ├── useChatStream({ apiUrl, chat })
  │     └── fetch + SSE + AbortController
  ├── loadFromSessionStorage()
  └── saveToSessionStorage()
```

El componente no modificará el contrato del API ni implementará un parser SSE
alternativo.

## 4. Estructura semántica

La estructura base será:

```html
<section class="chatbox" lang="es" aria-labelledby="..."><header>...</header>
  <div role="status" aria-live="polite"></div>
  <main aria-label="Conversación">...</main>
  <footer><form>...</form></footer>
</section>
```

Si la integración con Astro demuestra que un `<main>` anidado genera un landmark
inválido, se sustituirá por una sección etiquetada sin cambiar el contrato
visual.

## 5. Estados y representación

### Estado vacío

Muestra una explicación breve y entre tres y cuatro sugerencias configurables.
Al pulsar una sugerencia se envía como pregunta.

### Turno activo

Durante `connecting`, `generating` y `streaming`:

- la pregunta del usuario permanece visible;
- existe una burbuja provisional del asistente;
- se muestra “El asistente está escribiendo” hasta recibir contenido;
- los tokens se muestran progresivamente;
- el botón Enviar se sustituye por Detener.

### Respuesta sin contexto

Cuando el turno termina sin tokens y `sources` está vacío, se muestra el texto
local:

> Eso no lo tengo en la información que manejo. Puedes escribirle a Jorge
directamente.

Este mensaje no se añade al `context` canónico del API. El enlace de contacto
se incluye cuando `contactUrl` está disponible.

### Error o aborto

Se conserva la respuesta parcial visible, marcada como incompleta. El turno no
se añade a `context` ni sustituye la conversación persistida. Se muestra un
mensaje propio en español y una acción de reintento cuando corresponda.

Nunca se muestran mensajes internos del API ni JSON de error.

## 6. Entrada y controles

- `Enter` envía.
- `Shift+Enter` inserta salto de línea.
- `isComposing` impide el envío durante IME.
- `Escape` aborta un turno activo.
- El textarea crece hasta cinco líneas.
- Se muestra contador desde el 80 % de 1000 caracteres.
- El envío se bloquea con texto vacío o por encima de 1000 caracteres.
- “Nueva conversación” requiere confirmación en línea y limpia estado/storage.
- El foco vuelve al textarea después de enviar.

## 7. Scroll y contexto

El área de conversación tendrá una referencia propia.

- Si el usuario está a menos de aproximadamente 80 px del final, el contenido
  nuevo desplaza la vista automáticamente.
- Si el usuario se ha desplazado hacia arriba, no se fuerza el scroll y aparece
  “Ir al final”.
- Al pulsar “Ir al final”, la referencia se considera nuevamente próxima al
  final para que los tokens posteriores sigan la respuesta.
- El comportamiento respeta `prefers-reduced-motion`, usando scroll inmediato
  cuando el usuario lo solicita.
- Si el historial devuelto por `sources` contiene menos mensajes que el enviado,
  se muestra una nota discreta indicando que los mensajes más antiguos ya no
  forman parte del contexto.
- La comparación usa el historial ya recortado por `trimHistory()`, no el
  contexto bruto almacenado en el cliente.
- La nota se limpia al iniciar una nueva pregunta o una nueva conversación.

## 8. Accesibilidad

- La lista de mensajes no será una región viva para evitar anunciar cada token.
- Una única región `role="status"` / `aria-live="polite"` anunciará:
  - inicio de generación;
  - respuesta completa una sola vez al recibir `done`;
  - error o aborto final.
- Las instancias tendrán IDs únicos para título y textarea.
- Los mensajes de usuario serán texto plano.
- Todos los controles tendrán nombres accesibles.

## 9. Persistencia

Al montar se intentará restaurar `messages` y `context` mediante
`loadFromSessionStorage()`.

Cuando no haya un turno activo, se guardará el estado confirmado mediante
`saveToSessionStorage()`.

Si `sessionStorage` no está disponible o falla, el componente continuará en
memoria.

## 10. Pruebas y criterios de aceptación

Se añadirá `test/component/Chatbox.test.tsx` con pruebas para:

- estado vacío y sugerencias;
- envío con teclado y bloqueo de entradas inválidas;
- burbuja provisional;
- respuesta sin contexto;
- aborto y error con respuesta parcial;
- scroll condicional y “Ir al final”;
- nota de contexto recortado;
- anuncio final único;
- nueva conversación;
- restauración y guardado de `sessionStorage`.

Verificaciones mínimas:

```bash
npx biome check src test
npm test -- --run
npm run build
```

## 11. Fuera de alcance

- Renderizado Markdown seguro y carga dinámica de `react-markdown` (Paso 4).
- Estilos completos, contraste y responsive final (Pasos 4–6).
- Integración Astro (Paso 7).
- axe sobre el widget (Paso 5).
  > *Enmienda (2026-10-26, issue #113):* la verificación con NVDA y VoiceOver se retiró con
  > el nivel 3 de la ADR 005, que nunca se ejecutó. La de axe sí está, como pasada
  > automática sobre el widget.
- Cambios en el backend o en el contrato SSE.
