# Resiliencia del stream: handler sin cuerpo tardío y cuota distinguible

> Spec del issue #144. Decisiones de proceso en `docs/decisions/` de la raíz,
> glosario en `GLOSSARY.md`.

## Problema

Un fallo después de enviar cabeceras llegaba al manejador de errores, que intentaba
responder con un cuerpo JSON. La escritura lanzaba `ERR_HTTP_HEADERS_SENT` y se llevaba el
proceso por delante: el visitante veía un corte sin cuerpo ni explicación. Reproducido con
un socket real antes de tocar nada.

Por separado, un 429 del proveedor (cuota agotada) se trataba como cualquier otro fallo.
El visitante leía "no he podido completar la respuesta" cuando la realidad era "está
ocupado"; y el `retry-after` que el proveedor manda se descartaba.

## Decisiones

- **D1 — El manejador mira el estado de la respuesta antes de escribir.** Si
  `reply.raw.headersSent`, cierra el cuerpo con `end()` y no intenta JSON. Vale para todas
  las rutas, no solo el chat: el fallo es del transporte, no del endpoint. La decisión de
  API vive en `docs/decisions/014-error-handler-sin-cuerpo-tardio.md`.
- **D2 — El pipeline SSE es total.** `toSSE` convierte un fallo del origen de eventos en un
  frame `error` de cierre. Así el cliente ve un final de stream, no una conexión cortada, y
  el fallo no llega al manejador con la respuesta ya empezada.
- **D3 — La clasificación es por estado, no por texto.** `status === 429` es cuota. El texto
  del mensaje del proveedor cambia entre versiones; el estado no.
- **D4 — El código viaja en el contrato, el texto lo elige el cliente.** El evento `error`
  gana `code` (`GENERATION_FAILED` | `QUOTA_EXHAUSTED`) y `retryAfterSeconds?`. El mensaje
  genérico no cambia: el código distingue, el mensaje no revela la causa.
- **D5 — El reintento no se tira.** Se lee de `retry-after` (a 42 s, 42) y se conserva en el
  `ChatError`. La interfaz todavía no lo pinta; el mensaje de cuota no promete una hora
  concreta porque el dato no la garantiza.
- **D6 — Compatibilidad hacia atrás.** Un `error` sin `code` (servidor anterior) o con un
  código desconocido cae en el genérico en vez de descartar el evento.

## Contrato

```json
{ "code": "QUOTA_EXHAUSTED", "message": "An unexpected error occurred while generating the answer", "retryAfterSeconds": 42 }
```

`retryAfterSeconds` solo aparece si el proveedor lo dio y es entero ≥ 0.

## Textos

`strings.errors.QUOTA_EXHAUSTED`: "El asistente está ocupado ahora mismo. Vuelve a
intentarlo más tarde." El genérico sigue en `strings.errors.STREAM_ERROR`.

## Pruebas

- API, socket real: una ruta que escribe cabeceras y parte del cuerpo y después lanza deja
  el cuerpo parcial, cierra limpio y no lanza. Sin el guard, el test falla con
  `ERR_HTTP_HEADERS_SENT` (verificado).
- API, `toSSE`: un origen que lanza tras el primer frame produce `sources` + `error` final.
- API, `/api/chat` con 429: `QUOTA_EXHAUSTED` y el reintento conservado; sin cabecera de
  reintento, el campo no aparece; un fallo cualquiera sigue en `GENERATION_FAILED`.
- Widget: parser (`code`, reintento válido y descartado), `chatErrors.streamEvent` y el
  runner (la cuota llega al `TurnEnd` con su reintento).

## Fuera de alcance

Reintentos automáticos, colas de espera, cambiar el resto del contrato de errores y pintar
la cuenta atrás del reintento.
