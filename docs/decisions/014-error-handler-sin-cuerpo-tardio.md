# Decisión 014: el manejador de errores no escribe cuerpo si la respuesta ya empezó

## Estado

Aceptada (2026-10-30), a raíz del issue #144.

## Contexto

El manejador de errores de la API respondía siempre con un cuerpo JSON. Con una
respuesta JSON eso funciona; con un stream que ya envió cabeceras, no:

1. `reply.send()` intenta escribir cabeceras otra vez y lanza `ERR_HTTP_HEADERS_SENT`.
2. Fastify lo reintenta por su camino de último recurso (`fallbackErrorHandler`), que
   vuelve a llamar a `writeHead` y lanza sin que nadie lo recoja.
3. El proceso se va por delante. El visitante recibe lo que se escribió hasta ese
   momento y un corte de conexión, sin cuerpo ni explicación.

Está reproducido con un socket real en
`api/test/routes/stream-resilience.test.ts`; sin el arreglo, ese test mata el proceso.

## Decisión

La primera comprobación del manejador es el estado de la respuesta:

- **Sin cabeceras**: se responde como siempre (413, 400, 429, 404, 500).
- **Con cabeceras enviadas**: no hay cuerpo posible. Se cierra el stream con
  `raw.end()` y se hace `reply.hijack()`, que le dice a Fastify que la respuesta ya no
  es suya.

La regla vale para todas las rutas, no solo `POST /api/chat`: el fallo es del
transporte, no del endpoint, y cualquier ruta que algún día streamee hereda la
garantía.

## Alternativas descartadas

- **Dejar que el manejador lance y confiar en que Fastify lo recoja**: es lo que hacía
  antes; no lo recoge y el proceso muere.
- **Condicionar la regla a la ruta del chat**: arregla el síntoma de hoy y deja el mismo
  pie para la siguiente ruta que responda en streaming.

## Consecuencias

- Un fallo después de las cabeceras deja de producir un error secundario: no hay dos
  causas en los logs ni un proceso caído.
- El cliente no recibe un cuerpo JSON inválido; recibe el final del stream, que en SSE
  es un EOF limpio. El pipe SSE además convierte un fallo de su origen en un frame
  `error` de cierre, para que ese final sea un evento y no solo un cierre.
- La observabilidad del fallo (registrarlo con causa y sin secretos) queda en #146: el
  manejador no registra nada propio para no duplicar la línea del error original.
