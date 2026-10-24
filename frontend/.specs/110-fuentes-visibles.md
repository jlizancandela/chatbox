# Fuentes visibles — la atribución de cada respuesta

> Convención del proyecto: un spec por issue en `.specs/`, decisiones de proceso en
> `docs/decisions/` de la raíz, glosario en `GLOSSARY.md` de la raíz.
>
> Es una **spec ligera** de un ajuste de UX dentro de una corrección mayor (issue #110,
> «la respuesta del chat es escueta y sin atribución»). Enmienda la decisión «no
> visualización de fuentes en el MVP» de `frontend/AGENTS.md`.

## Síntesis (decisiones acordadas, 2026-10-25)

- **D1 — La atribución es por respuesta, no del turno**: cada mensaje del asistente guarda
  las fuentes de las que salió. La alternativa —mostrar las fuentes del turno en curso— deja
  la conversación sin atribución en cuanto se hace la siguiente pregunta, y al recargar la
  página.
- **D2 — Las fuentes no se envían al API**: el contexto que viaja en `history` sigue siendo
  rol y contenido. Las fuentes son la atribución de lo que se ve, no parte de la
  conversación con el modelo.
- **D3 — Se nombra el documento, no el fragmento**: la línea dice «Currículum» o «Informe de
  GitHub», no «fragmento 3 de 13». A quien lee le importa el documento; el fragmento es
  detalle del retrieval. Los títulos repetidos secollapsean en uno.
- **D4 — Sin citas inline**: el modelo no escribe marcadores tipo `[1]` en la respuesta. El
  widget instala `react-markdown` sin `remark-gfm`, así que no parsea footnotes, y la
  whitelist de `allowedElements` no incluye los nodos de un footnote: abrirlos sería
  superficie de seguridad nueva para una sintaxis que no se lee en un widget de portafolio.
- **D5 — Lo que se ve, se oye**: la región de estado anuncia la respuesta **y** la línea de
  fuentes. RF-F41 ya fijó que la región no pinta lo que está en la conversación; con las
  fuentes visibles, omitirlas del anuncio haría que lo que se ve y lo que se oye dejaran de
  coincidir.

## Estado previo

El API ya mandaba las fuentes en el evento `sources` y el widget las guardaba en un estado
que nadie leía: se calculaban y se descartaban. El título del documento, que es lo que hace
falta para atribuirlas, no venía: el `SELECT` de la recuperación no lo pedía.

## Diseño

- `src/chat/types.ts`: `ChatSource` gana `title`. `VisibleMessage` es un mensaje del API más
  sus fuentes; `ChatMessage` sigue siendo el tipo del contrato con el API.
- `src/chat/domain/sources.ts` (nuevo): `isChatSource` (la forma que exigen el API, el
  estado y el almacenamiento) y `sourceTitles` (los títulos distintos, en orden).
- `src/chat/application/chat-reducer.ts`: al cerrar el turno, la respuesta del asistente
  guarda las fuentes. El contexto que se envía al API se queda con rol y contenido.
- `src/chat/infrastructure/storage.ts`: las fuentes sobreviven a la recarga de la página.
- `src/chat/hooks/useChatStream.ts`: el desenlace del turno lleva las fuentes, porque también
  se anuncian.
- `src/components/ChatMessages.tsx`: la línea de fuentes bajo la respuesta del asistente.
- `src/components/Chatbox.tsx`: el anuncio de la región incluye la línea.
- `src/strings.es.ts`: `messages.sources(títulos)`. Es una interpolación real como el
  contador de caracteres: el texto es fijo y lo que cambia son los títulos.

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/chat/types.ts` | `ChatSource.title` y `VisibleMessage` |
| `src/chat/domain/sources.ts` | Nuevo: la forma de una fuente y sus títulos distintos |
| `src/chat/domain/conversation.ts` | El estado de la conversación guarda mensajes visibles |
| `src/chat/infrastructure/sse.ts` | Una fuente sin título no es una fuente |
| `src/chat/infrastructure/storage.ts` | Las fuentes sobreviven a la recarga |
| `src/chat/application/chat-reducer.ts` | La respuesta guarda sus fuentes; el contexto no |
| `src/chat/hooks/useChatStream.ts` | El desenlace lleva las fuentes |
| `src/components/ChatMessages.tsx` | La línea de fuentes |
| `src/components/Chatbox.tsx` | El anuncio incluye la línea |
| `src/components/Chatbox.css` | El estilo de la línea |
| `src/strings.es.ts` | `messages.sources` |
| `frontend/AGENTS.md` | Enmienda: las fuentes sí se visualizan |
| `../../GLOSSARY.md` | «Interpolación real» y «Atribución» |

## Criterios de aceptación

1. La respuesta nombra los documentos de los que viene, sin repetir un documento que haya
   aportado varios fragmentos.
2. Una respuesta sin fuentes no muestra línea de fuentes.
3. Las fuentes de una respuesta sobreviven a la recarga de la página.
4. El contexto que se envía al API sigue siendo rol y contenido: las fuentes no viajan.
5. La región de estado anuncia la respuesta y la línea de fuentes.
6. Toda la redacción vive en `src/strings.es.ts` (RF-F62) y el inventario lo sigue vigilando.
7. La línea de fuentes respeta el piso de contraste: tinta completa, sin `opacity`.

## Riesgos

- **La línea se anuncia y se ve**: es lo que exige D5, pero significa que la región de estado
  dice un poco más que antes. La región ya anuncia la respuesta completa, así que no cambia
  el número de anuncios por turno.
- **Un segundo formato de interpolación en `strings.es.ts`**: hasta ahora la única función
  era el contador de caracteres. El glosario se enmienda para declararlo.
- **El contrato del API cambia**: `sources` incluye `title`. El frontend valida la forma de
  la fuente, así que un API viejo (sin título) hace que el evento se descarte y la
  conversación no muestre fuentes. API y widget se despliegan juntos.

## Verificación

```bash
npm run verify        # lint + typecheck + build + test -- --run
npm run test:browser  # suite de Playwright (Chromium)
```

## Referencias

- Enmienda: `frontend/AGENTS.md`, «no … visualización de fuentes en el MVP».
- Glosario: `../../GLOSSARY.md` («Atribución», «Interpolación real»).
- Issue: #110.
