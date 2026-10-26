# RF-F41 — Región de estado y anuncios de la conversación

> Convención del proyecto: un spec por RF en `.specs/`, decisiones de proceso en
> `docs/decisions/` de la raíz, glosario en `GLOSSARY.md` de la raíz.
>
> Spec confirmado el 2026-10-20 tras sesión de `grill-with-docs`. Decisión de
> verificación en `docs/decisions/005-live-region-verification.md`.

## Síntesis de la entrevista (decisiones acordadas, 2026-10-20)

- **D1 — Alcance**: el contrato completo de `.specs/chatbox-component.md` §8, no solo la
  letra de RF-F41. Cierra el hueco entre ambos: una única región, más aborto y la
  rehidratación que hoy anuncia por error.
- **D2 — Origen del anuncio**: eventos del turno emitidos por `useChatStream`
  (`onTurnEnd`), no derivación del estado en un `useEffect`. "Una sola vez" deja de ser un
  ref bien inicializado y pasa a ser estructural.
- **D3 — Texto anunciado**: el runner acumula los tokens en `enqueueToken` y los entrega en
  `done`. El estado no sirve: en `done` `currentResponse` ya está limpio y
  `chat.state` sigue desactualizado dentro del mismo tick.
- **D4 — Rehidratación**: la restauración no anuncia y **no consume** el valor. Solo se
  anuncia lo que este runner acaba de producir. La regla queda escrita aquí para que un
  futuro "cargar conversación" sepa que necesita su propio evento.
- **D5 — Sin contexto**: si el turno cierra sin mensaje del asistente, la región anuncia
  `notices.noContext`. Sin texto nuevo.
- **D6 — Contador de caracteres**: se queda visible con `aria-live="off"`. Es la mitad de
  "región única": cada tecla cerca del límite no interrumpe el anuncio.
- **D7 — Proyección de texto plano**: lo que entra en la región pasa por un
  `toAnnouncementText()` mínimo. Solo para el anuncio; el texto visible sigue siendo
  markdown. Si el stripper no reconoce algo, lo deja tal cual — incluidos el énfasis simple
  y los números de más de un dígito al principio de una línea, porque quitarlos sería
  reescribir la respuesta.
- **D8 — Re-anuncio**: sin maquinaria. El aviso de "escribiendo" siempre media entre turno
  y turno, así que el texto final siempre es un cambio real del árbol de accesibilidad,
  incluso si es idéntico al anterior. Un test fija la secuencia.
- **D9 — Verificación**: dos niveles etiquetados (estructura en jsdom, resolución y axe en
  Chromium). Sin nivel manual: el checklist de NVDA y VoiceOver se retiró en la enmienda
  del 2026-10-26 (issue #113), porque nunca se ejecutó y porque lo que añadía —la
  fonética— no es un contrato del widget.
- **D10 — Ubicaciones**: esta spec, `docs/decisions/005-…`, una sección de glosario y una
  issue. `docs/stitch-frontend-design/SPEC-FRONTEND.md` **no se toca**: los IDs `RF-Fxx`
  son la referencia estable entre `TODO.md` y la spec de diseño; la ampliación de RF-F41
  vive aquí.

## Problem Statement

`Chatbox.tsx` ya monta una región `role="status"`, pero su contenido se deduce de un
diff de estados en un `useEffect`, y de ahí salen cuatro fallos:

1. Con `sessionStorage` lleno, `announcedMessages` arranca en `0` y el montaje **anuncia el
   último mensaje del asistente** de una conversación que nadie acaba de generar.
2. `turn-aborted` no fija anuncio: la región queda vacía y el aborto es mudo, en
   contra de §8.
3. `notices.noContext` se pinta fuera de la región: quien usa lector de pantalla oye
   "El asistente está escribiendo" y después silencio.
4. `ChatInput.tsx` monta un segundo `aria-live="polite"` en el contador de caracteres, que
   interrumpe el anuncio del turno.

Además, lo que se anuncia es el markdown crudo (`**negrita**`, `` `código` ``,
`[texto](url)`), y RF-F41 pide explícitamente que la lista de mensajes no sea región viva:
el único mecanismo de anuncio no puede leer la sintaxis.

## Solution

`useChatStream` emite `onTurnEnd` una vez por salida del runner. `Chatbox` pinta el texto
del evento en la única región viva del widget, con el texto proyectado a plano. Nada se
deduce de comparar estados, así que la restauración deja de anunciar por construcción.

## User Stories

1. Como visitante que usa lector de pantalla, quiero oír que el asistente empieza a
   escribir, para saber que mi pregunta se está atendiendo.
2. Como visitante que usa lector de pantalla, quiero oír la respuesta completa **una sola
   vez** al terminar, para no tener que buscarla en la lista de mensajes.
3. Como visitante que usa lector de pantalla, quiero oír el desenlace cuando el turno
   falla o lo detengo, para no quedarme esperando en silencio.
4. Como visitante que usa lector de pantalla, quiero que la lista de mensajes no se lea
   token a token, porque el anuncio por token hace la respuesta inusable.
5. Como visitante que usa lector de pantalla, quiero enterarme cuando el asistente no tiene
   información, porque hoy ese aviso solo existe para quien ve la pantalla.
6. Como mantenedor, quiero que recargar la página no anuncie nada, porque nadie acaba de
   escribir nada.
7. Como mantenedor, quiero saber qué verifica cada test, para no leer un verde sobre jsdom
   como prueba de que algo se anuncia.

## Implementation Decisions

### Una región, y solo una

`.chatbox__status` conserva `role="status"`, `aria-live="polite"` y `aria-atomic="true"`.
`aria-atomic` se mantiene porque el texto anunciado es el cuerpo completo del mensaje y
debe leerse entero. El `<ol>` de mensajes conserva su `aria-label` y **no** es región
viva. El contador de caracteres pasa a `aria-live="off"`: sigue siendo texto visible y
alcanzable, y deja de ser una segunda región.

### Contrato evento → texto de la región

| Evento del turno | Texto en la región |
|---|---|
| Turno en curso | `strings.messages.writing` |
| `done` con texto | respuesta completa proyectada (`toAnnouncementText`) |
| `done` sin mensaje del asistente | `strings.notices.noContext` |
| Fallo (validación, HTTP, stream, red, timeout, stream incompleto) | `strings.errors[code]` |
| Aborto (botón Detener o excepción `AbortError`) | `strings.messages.stopped` (cadena nueva, copy propuesto) |

`done` y `aborto` son excluyentes por salida del runner: no hay dos anuncios por turno.

La primera fila es la única que no viene de un evento, y a propósito: describe un estado que
**dura** (hay un turno abierto), no un desenlace. Se lee de `isBusy`, que es la misma señal
que ya usa el indicador visible de "escribiendo". Si fuera un evento, añadiría un evento cuyo
único trabajo es calcar `isBusy` y que habría que emitir antes de que exista turno.

### Origen del anuncio

`UseChatStreamOptions` gana `onTurnEnd?: (event: TurnEnd) => void`, con

```ts
type TurnEnd = { kind: "completed"; text: string } | { kind: "failed"; error: ChatError } | { kind: "aborted" };
```

`Chatbox` guarda el último `TurnEnd` en estado local y lo pinta. El evento no lleva nada de
presentación: el runner no conoce `strings.es.ts`.

### El texto sale del runner, no del estado

El runner concatena cada token en `enqueueToken`, que es síncrono y anterior a cualquier
`requestFrame`. En `done` emite lo acumulado. Así el texto anunciado es **exactamente** el
que se pintó, con independencia de cuándo llegue el último flush; leerlo del estado
dependería de un render posterior que no ha ocurrido todavía.

### Una salida, un evento

Toda salida de `run()` emite exactamente un `onTurnEnd`, incluidas las que hoy no pasan por
el estado: `buildChatRequest` inválido, respuesta no `ok`, respuesta sin `body`, stream
incompleto y abortos llegados por excepción en lugar de por el botón. Es el invariante que
evita el hueco silencioso que hoy cubre el fallback de la región.

### La rehidratación no anuncia

`state-restored` no pasa por el runner, así que no emite. La regla es explícita y va
acompañada de un test: si en el futuro se añade un botón de "cargar conversación anterior",
ese camino necesita su propio evento para poder anunciar, y no puede apoyarse en el
estado.

### Proyección de texto plano

`toAnnouncementText()` quita la **negrita** (`**` y `__`), los backticks, convierte
`[texto](url)` en `texto` y normaliza los marcadores de lista. No pretende ser un parser de
markdown: cualquier construcción que no reconozca pasa intacta. El mensaje visible no cambia;
la proyección solo se aplica al escribir en la región.

Dos límites deliberados, fijados por test:

- **El énfasis simple (`*texto*`, `_texto_`) no se quita.** Aunque `AssistantMarkdown` admita
  `em`, un asterisco suelto es indistinguible de `3 * 4 = 12` y un guion bajo de
  `max__value__length`. Oír un asterisco es un detalle; borrar parte del texto de una
  respuesta es reescribirla.
- **La lista ordenada solo se normaliza con número de un dígito.** `2024. La película se
  presentó en Cannes` es prosa, y quitarle el año "limpiando" sería alterar la respuesta.
  Una lista de más de nueve ítems conserva su número, que además es correcto oír.

### Sin maquinaria de re-anuncio

No hay nonce, ni clear-tick, ni doble región. La secuencia real de la región es
`""` → `writing` → texto final, y como el texto final siempre sigue a un texto distinto,
el lector lo anuncia aunque sea idéntico al del turno anterior. Un test de componente fija
esa secuencia; si alguien quita el aviso de "escribiendo", el test falla.

### Copy pendiente de confirmar

El aborto necesita una cadena nueva (`strings.messages.stopped`, propuesta: *"Respuesta
detenida"*) porque hoy no existe copy de aborto. Recordar que en un aborto el texto parcial
**desaparece** de la vista (`ChatMessages` solo muestra `currentResponse` mientras hay
turno activo): el anuncio no debe prometer un texto que ya no está en pantalla.

## Alternativas rechazadas

- **Derivar el anuncio del estado** en un `useEffect`: es el diseño actual. Es el que
  produce el bug de montaje y obliga a que "una sola vez" dependa de un ref inicializado
  con cuidado.
- **Campo `announcement` en `ChatState`**: mete copy de interfaz en la capa de aplicación y
  arrastra `strings.es.ts` al reducer.
- **Releer el texto del estado en `done`**: reabre la carrera entre dispatch y render.
- **Acumular en `token-buffer.ts`**: mezcla presentación en infraestructura y no cubre el
  caso de `flush` ya aplicado.
- **Anunciar el markdown renderizado** dentro de la región: duplica el DOM y mete
  `react-markdown` en la ruta crítica del anuncio.
- **Forzar re-anuncio con clear + set**: maquinaria para un caso que ya funciona.
- **Anunciar el cruce del umbral del contador por la región**: mezcla el estado del input con
  el del turno para un contador.
- **Anunciar `noContext` por la región además de pintarlo**: el aviso se anuncia una vez; no
  se duplica texto visible y audible.
- **Actualizar `SPEC-FRONTEND.md`**: sus IDs `RF-Fxx` son el contrato de trazabilidad con
  `frontend/TODO.md`.

## Verificación

Dos niveles, con el nivel declarado en cada assert (ver
`docs/decisions/005-live-region-verification.md`).

- **Unidad / jsdom** (estructura, no sonido): la región existe con su rol y sus atributos;
  la secuencia de textos en un turno completo; `noContext` anunciado; aborto anunciado;
  **montaje con `sessionStorage` prellenado no anuncia**; el contador no es región viva;
  proyección de texto plano.
- **Navegador / Chromium** (resolución): la secuencia real de `.chatbox__status` con el
  API mockeado por SSE, y una pasada de `axe` sobre el widget en todos sus estados y en
  los dos esquemas de color. Sigue sin probar que un lector de pantalla hable.
  > *Enmienda (2026-10-26, issue #113):* el nivel manual —el checklist de NVDA y
  > VoiceOver— se retiró: nunca se ejecutó y lo que añadía era la fonética, que no es
  > un contrato del widget. El cierre es el nivel 2.

### Cómo se hace la pasada automática

El widget habla con una API que exige PostgreSQL y claves de entorno, así que el escaneo
monta la página de desarrollo con el API mockeado por SSE. No hace falta ningún servidor
ni ningún guion: los estados del widget se montan interceptando `POST /api/chat`.

La pasada vive en `test/browser/accessibility.spec.ts` y usa un único helper
(`test/axe.ts`), que declara el nivel auditado —WCAG 2.0, 2.1 y 2.2, A y AA— y la raíz del
escaneo —el widget—. Los ocho estados que recorre son: vacío, turno en marcha, respuesta
anunciada, turno sin respuesta, turno fallido, turno detenido, conversación restaurada y
confirmación abierta.

```bash
cd frontend && npm run test:browser
```

La pasada tiene una entrada que rechaza: inyecta una imagen sin texto alternativo dentro
del widget y exige que la violación se reporte. Un escaneo que mirara el sitio equivocado
pasaría en verde y no protegería nada.

> *Texto original (RF-F41, 2026-10-20; la enmienda del 2026-10-26 toca lo que sigue):* para
> el nivel manual había un **fixture** (`src/dev/manual-announcements.tsx`) que montaba el
> `Chatbox` real con un `fetch` sustituido por un guion, solo en desarrollo y solo con
> `?manual=<escenario>`. Se retiró con el nivel que lo alimentaba.
>
> *Enmienda (RF-F46, 2026-10-22):* la región ya no pinta lo que está en la conversación. Un
> turno completado se ve en la burbuja del asistente; la región lo anuncia, pero no lo pinta
> dos veces. Lo que sí se pinta: el aviso «escribiendo», el error y el aviso de turno
> detenido. La referencia para contrastar lo que se oye pasa a ser la burbuja, porque la
> proyección de anuncio coincide con su texto renderizado (ver `RF-F46-respuesta-una-vez.md`).
>
> *Enmienda (RF-F47, 2026-10-23):* el aviso «escribiendo» también pasa a estar en la
> conversación —se ve dentro del bocadillo—, así que la región deja de pintarlo. Lo que la
> región sigue pintando es el error de un turno fallido y el aviso de un turno detenido, que
> no aparecen en ningún otro sitio. Lo que se anuncia no cambia: el mismo texto, en el mismo
> momento, por la misma región (ver `RF-F47-aviso-en-la-burbuja.md`).
>
> Texto original (RF-F41, 2026-10-20; lo que RF-F47 toca ya no está vigente): el texto de la región
> se ve en `.chatbox__status`, que solo se oculta cuando está vacía: sirve de referencia para
> contrastar lo que se oye. Un test de navegador verifica que el guion sigue
arrancando y anunciando, para que el fixture no se pudra en silencio; no verifica que suene
nada, que es exactamente lo que no se puede automatizar. Ese test se retiró con el fixture.

## Fuera de alcance

- Quitar la lista de mensajes como región viva: ya no lo es, no hay cambio.
- `prefers-reduced-motion` (RF-F44) y contraste (RF-F42).
- Cualquier cambio en el comportamiento del aborto (el texto parcial que desaparece).
- Un botón para cargar conversaciones anteriores: la regla de D4 solo le aplica.
- Revisión del copy de los mensajes de error existentes.

## Glosario

Definido en `GLOSSARY.md` (raíz), sección "Región de estado y anuncios": Región de estado,
Anuncio, Proyección de anuncio, Turno.
