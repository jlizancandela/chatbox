# RF-F46 — La respuesta se ve una sola vez

> Convención del proyecto: un spec por RF en `.specs/`, decisiones de proceso en
> `docs/decisions/` de la raíz, glosario en `GLOSSARY.md` de la raíz.
>
> Es una **spec ligera** de un defecto del contrato de RF-F41 que el diagnóstico midió en
> Chromium el 2026-10-22. Enmienda la línea de RF-F41 que justificaba pintar el anuncio.
> Issue: #104.

## Síntesis (decisiones acordadas, 2026-10-22)

- **D1 — La región anuncia siempre, pero pinta solo lo que no está en la conversación.**
  Un turno completado ya se ve en la burbuja del asistente (o en el aviso de la conversación
  si no hubo respuesta): la región lo anuncia, y lo pinta solo si nadie más lo pinta.
- **D2 — Lo que la región sigue pintando**: el aviso «El asistente está escribiendo»
  mientras el turno está en curso, el error de un turno fallido (no aparece en ningún otro
  sitio) y el aviso de un turno detenido (no aparece en ningún otro sitio).
- **D3 — Se oculta con el patrón de «visualmente oculto», no con `display: none` ni
  `visibility: hidden`.** Esos dos lo sacan del árbol de accesibilidad y el anuncio no se
  oiría. El patrón del clip lo deja dentro.
- **D4 — Mientras el markdown del asistente se carga, la burbuja muestra el indicador de
  escritura y no queda en blanco.** Sin esto, quitar la copia de la región dejaría la
  respuesta sin ver durante la carga diferida (RF-F30). El indicador es el mismo componente
  que RF-F44, extraído a `chat/components/TypingIndicator.tsx` para que `AssistantMarkdown`
  pueda usarlo.
- **D5 — La referencia para la verificación manual es la burbuja.** RF-F41 decía que la región
  «sirve de referencia para contrastar lo que se oye». La proyección de anuncio coincide, palabra
  por palabra, con el texto que la burbuja renderiza (`toAnnouncementText` quita los símbolos;
  el markdown renderizado ya no los tiene), así que la burbuja cumple la misma función.

## Auditoría (medido en Chromium)

- Con una respuesta de una sola palabra, la región y la burbuja pintan el mismo texto: el
  resultado son **dos copias visibles** (`["chatbox__status", "P"]` antes del arreglo).
- La copia de la región ocupaba toda la respuesta en vertical: encogía el área de la
  conversación. Con respuestas largas, la conversación quedaba con unos 30 px visibles.
- Solo hay un `aria-live="polite"` (la región): el duplicado **no** se oye dos veces. La
  hipótesis de un anuncio duplicado queda descartada.
- El error vive **solo** en la región (`localNotice` solo lleva el aviso de «sin contexto»):
  ocultar la región sin más lo habría dejado invisible.

## Diseño

- `src/components/Chatbox.tsx`: el aviso gana `inConversation`, que es `true` cuando el
  turno se completó. La clase `chatbox__status--announced` oculta la región en ese caso.
- `src/components/Chatbox.css`: el patrón de «visualmente oculto» para
  `.chatbox__status--announced`.
- `src/chat/components/TypingIndicator.tsx`: los tres puntos, extraídos de `ChatMessages`.
- `src/chat/components/AssistantMarkdown.tsx`: muestra `TypingIndicator` mientras el
  renderizador se carga, en vez de `null`.

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/components/Chatbox.tsx` | `inConversation` en el aviso y la clase de la región |
| `src/components/Chatbox.css` | `.chatbox__status--announced` (visualmente oculto) |
| `src/chat/components/TypingIndicator.tsx` | Nuevo: el indicador de escritura, extraído |
| `src/components/ChatMessages.tsx` | Usa `TypingIndicator` |
| `src/chat/components/AssistantMarkdown.tsx` | Muestra `TypingIndicator` mientras carga |
| `test/browser/live-region.spec.ts` | Tres tests nuevos: una sola copia visible; el indicador mientras carga el markdown; el error sigue visible |
| `test/browser/keyboard.spec.ts`, `test/browser/touch-targets.spec.ts` | Esperan la respuesta completa antes de subir el hilo (ver «Riesgos») |
| `test/unit/strings-inventory.test.ts` | Lista blanca: `chatbox__status--announced`; las clases del indicador pasan a escapes justificados |
| `frontend/.specs/RF-F41-region-estado.md` | Enmienda de la línea que justificaba pintar el anuncio |
| `GLOSSARY.md` | «Región de estado» y «Indicador de escritura» |
| `frontend/TODO.md` | RF-F46 |

## Criterios de aceptación

1. Tras un turno completado, el texto de la respuesta tiene **una** copia visible (en la burbuja).
2. Mientras el turno está en curso, la región muestra «El asistente está escribiendo».
3. Un turno fallido o detenido sigue mostrando su aviso visible en la región.
4. El anuncio sigue existiendo para lectores de pantalla: la región sigue en el árbol de
   accesibilidad y su texto no cambia.
5. Mientras el markdown se carga, la burbuja muestra el indicador y no queda vacía.
6. Los tests de 1 y 3 fallan contra el código anterior y pasan con el arreglo.

## Riesgos

- **La región colapsa al terminar el turno**: pasa de una línea («escribiendo») a nada. Es
  un salto de altura pequeño; el anterior era el de toda la respuesta.
- **Subir el hilo antes de que la respuesta termine** ya no tiene el mismo efecto: la
  respuesta ocupa la conversación desde el principio. Dos tests dependían del tamaño que la
  copia de la región le quitaba a la conversación; ahora esperan la respuesta completa.
  El comportamiento del widget no cambia: a menos de ~80 px del final, el hilo sigue
  (RF-F06).
- **Verificación manual**: la pasada de NVDA/VoiceOver compara lo oído con la burbuja, no con
  la región (ver D5). Hay que actualizar la checklist de RF-F41 en ese sentido.

## Verificación

```bash
npm run verify        # lint + typecheck + build + test -- --run
npm run test:browser  # suite de Playwright (Chromium)
```

## Plan de commits

1. `fix(frontend): la región de estado no pinta la respuesta que ya está en la conversación (RF-F46)`
2. `docs(frontend): spec de RF-F46 y enmienda de RF-F41 (RF-F46)`

## Referencias

- Requisito: `RF-F41-region-estado.md` (la línea «sirve de referencia para contrastar lo que se oye»).
- Glosario: `../../GLOSSARY.md`.
- Issue: #104.
