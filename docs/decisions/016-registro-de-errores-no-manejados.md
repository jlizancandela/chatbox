# Decisión 016: los errores no manejados se registran en el manejador

## Estado

Aceptada (2026-11-01), a raíz del issue #176. Revisa una consecuencia de la 014.

## Contexto

La decisión 014 cerró el problema del cuerpo tardío: cuando la respuesta ya empezó, el
manejador no intenta escribir JSON. Como parte de esa decisión se dejó escrito que el
manejador **no registra nada propio**, "para no duplicar la línea del error original",
confiando en que esa línea la escribe otro.

Ese otro no existe. Fastify registra los errores en su manejador por defecto, pero
cuando la aplicación define uno propio, el framework llama al suyo y no escribe nada
(`node_modules/fastify/lib/error-handler.js`). El manejador de la API devolvía el
envelope `INTERNAL_ERROR` y descartaba el error sin mirarlo.

Medido: una excepción lanzada dentro de una ruta produce un 500 correcto y **ninguna**
línea de log con su causa. Solo queda la traza de la petición, con `statusCode: 500`.

## Decisión

El camino de último recurso del manejador —el que responde 500— registra el error antes
de responder:

- Se registra el error (`err`) con su mensaje y su stack, y el `requestId` de
  correlación de la petición.
- No se registra la petición: ni cuerpo, ni historial, ni contexto. La regla de #146
  sigue intacta.
- Los 4xx previstos (400, 404, 413, 415, 429) **no** se registran: son errores del
  cliente y llenarían el log de ruido sin decir nada del servidor.
- El caso de cabeceras ya enviadas sigue sin registrar nada: ese fallo se registra
  donde se clasifica (`services/chat.ts`), y duplicarlo era justo lo que la 014 quería
  evitar.

`requestId` va explícito porque `request.log` se crea con el identificador que genera
Fastify (`req-1`) y el plugin de logging lo reemplaza después por el de correlación: sin
el campo, la línea del error no se puede emparejar con la traza de la petición.

## Alternativas descartadas

- **Quitar el `setErrorHandler` propio y usar el de Fastify.** Es el que registra, pero
  devuelve su envelope —el que el issue #176 quita— y filtra el mensaje interno.
- **Registrar en todas las ramas del manejador.** Duplica la línea en los 4xx, que son
  el caso frecuente, y entierra el 500 entre ellos.
- **Seguir sin registrar y confiar en la traza.** La traza dice que hubo un 500 y en qué
  ruta; no dice por qué. En producción eso es adivinar.

## Consecuencias

- Un 500 en producción deja causa y stack, correlacionables con la traza por
  `requestId`.
- El log de errores incluye el mensaje de la excepción, que es del servidor. Si algún día
  un error se construye a partir del contenido del visitante, hay que sanearlo en el
  punto donde se lanza: el manejador no puede distinguirlo.
- La consecuencia de la 014 sobre no registrar queda sustituida por esta para el camino
  de 500.
