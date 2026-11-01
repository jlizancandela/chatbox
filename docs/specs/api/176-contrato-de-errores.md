# Contrato de errores públicos: 404, 415 y los 500 registrados

> Spec del issue #176. Decisiones de proceso en `docs/decisions/`, glosario en
> `GLOSSARY.md`.

## Problema

La API promete un envelope estable para sus errores públicos —`{"error":{"code","message"}}`—
y hay tres caminos que no lo cumplen, verificados contra la API en ejecución:

1. **El 404 de una ruta inexistente.** Fastify no pasa el 404 por `setErrorHandler`:
   responde con su forma por defecto, `{"message":"Route GET:/x not found","error":
   "Not Found","statusCode":404}`. Además de romper el envelope —ahí `error` es un
   string, no un objeto—, delata el framework y devuelve la ruta pedida. La rama
   `NOT_FOUND` del handler era, por eso, inalcanzable.
2. **El 415 de un `Content-Type` que Fastify no sabe leer.** Multipart y urlencoded
   llegan como `FST_ERR_CTP_INVALID_MEDIA_TYPE` con estado 415 y caían en el 500
   genérico: el cliente no podía distinguir "mandé mal la petición" de "el servidor se
   rompió".
3. **Los 500 no se registraban.** Con un `setErrorHandler` propio, Fastify no escribe
   la línea del error: llama al handler y nada más. El handler devolvía el envelope
   anónimo y descartaba el error. Un fallo real dejaba `statusCode: 500` en la traza y
   ninguna causa.
4. **`x-ratelimit-remaining` siempre valía 0.** El corte de los tres límites era
   correcto; lo que mentía era el saldo anunciado. La condición `burst.isAllowed &&
   daily.isAllowed` nunca se cumple, porque en `@fastify/rate-limit` 11.2.0 `isAllowed`
   solo es `true` para la allow list —la misma trampa que #143 documentó para
   `isExceeded`—, y el valor era una constante, no el saldo.

## Decisiones

- **D1 — Un solo envelope para todo, también para lo que genera el framework.** El 404
  se sirve desde `setNotFoundHandler` con la misma constante que usa el handler de
  errores, para que los dos caminos no puedan separarse.

- **D2 — La forma por defecto de Fastify no se usa como contrato.** Su campo `error` es
  un string donde el resto de la API pone un objeto: un cliente que lea
  `error.error.code` funciona en los 500 y no en los 404. Devuelve además la ruta
  pedida y la firma del framework.

- **D3 — El 415 se reconoce por su código, no por el texto del mensaje.** `code` es
  estable entre versiones de Fastify; el mensaje no.

- **D4 — Un error no manejado se registra en el handler, con su causa y su
  `requestId`, nunca con el cuerpo ni el historial.** Ver
  `docs/decisions/016-registro-de-errores-no-manejados.md`. Los 4xx previstos no se
  registran: son errores del cliente, no del servidor, y llenarían el log de ruido.

- **D5 — El saldo sale del contador del plugin, no de una constante.** `createRateLimit`
  devuelve el saldo real (`remaining`) y su TTL; el middleware los reenvía. El descarte
  temprano de `isAllowed` es lo que estrecha el tipo de la unión, no una comprobación
  de negocio.

- **D6 — `x-ratelimit-reset` pasa a ser el TTL real de la ventana.** Antes era la
  constante 60 para cualquier ventana configurada.

## Pruebas

- **404 sin envelope roto:** una ruta inexistente en la raíz y otra bajo `/api/`
  devuelven exactamente `{"error":{"code":"NOT_FOUND","message":...}}`. La segunda
  distingue un handler registrado en la raíz de uno encapsulado en un prefijo.
- **415:** un `POST /api/chat` con `application/x-www-form-urlencoded` devuelve 415, no
  500, con su código propio.
- **500 anónimo:** un error no manejado responde el envelope y **no** contiene el
  mensaje interno. Es el caso que falla si el handler empieza a devolver `error.message`.
- **500 registrado:** con un logger real, la causa y el `requestId` aparecen en el log.
  Sin la línea de registro, el test no encuentra nada.
- **Saldo del rate limit:** con ráfaga 3, las tres primeras respuestas anuncian 2, 1 y
  0. Antes las tres decían 0.

## Fuera de alcance

- Autenticación: el chat es público por decisión (`docs/specs/api/148-presupuesto-por-sesion.md`).
- Cambiar el contrato de `POST /api/chat` ni el de sus eventos SSE.
- La ruta raíz `GET /` y su `{"root":true}`: es andamiaje del scaffold y no revela nada
  que `/health` no revele ya.
- Cualquier intento de bloquear el acceso directo a la API: CORS no es control de acceso
  y el rate limit es la frontera real (`docs/specs/api/143-exposicion-publica.md`).
