# Observabilidad de la API: logging configurado y sin secretos

> Spec del issue #146. Decisiones de proceso en `docs/decisions/` de la raíz,
> glosario en `GLOSSARY.md`.

## Problema

La API no registra nada. No hay logger configurado en el servidor: la única traza es
la que el framework escribe por su cuenta cuando algo revienta. Una petición fallida no
deja rastro de qué se pidió ni por qué falló, y diagnosticar un incidente exige adivinar.

El riesgo que hay que cerrar no es solo la falta de traza: es que el logging no puede
convertirse en una fuga. El servidor tiene claves de proveedor y acceso a un corpus
documental, y un volcado de configuración o un cuerpo de petición en el log bastaría
para crear un problema nuevo mientras se arregla este.

## Decisiones

- **D1 — El logger de Fastify es el logger.** No se introduce una dependencia de logs
  nueva: Fastify ya trae Pino y su integración con el ciclo de vida de la petición.
  Configurarlo es activarlo con opciones, no montar nada.

- **D2 — El nivel se configura por entorno, con un valor por defecto documentado.**
  `LOG_LEVEL`: `info` en producción, `debug` en desarrollo. El valor por defecto es
  `info`, porque en un servidor es lo que deja ver las peticiones sin llenar el disco.
  Un nivel desconocido cae en `info` en vez de romper el arranque.

- **D3 — Salida estructurada.** El logger emite JSON: una línea por evento, con campos
  con nombre, para poder filtrar. En desarrollo se puede pedir texto legible; el
  formato por defecto es JSON en ambos casos porque es el que se filtra.

- **D4 — Cada petición deja una traza con su identificador de correlación.** El
  identificador lo genera el servidor y viaja en la cabecera `x-request-id`, de modo que
  la traza del servidor y la del cliente se pueden emparejar. Si el cliente ya envía un
  identificador, se respeta: es el del cliente y no se cambia.

- **D5 — La traza de una petición lleva método, ruta, código de estado y duración.**
  Sin cuerpo de la petición, sin historial y sin contenido del corpus. El código de
  estado y la duración son lo que permite distinguir "lento" de "roto".

- **D6 — Un fallo clasificado se registra con su clasificación.** La cuota agotada
  (`QUOTA_EXHAUSTED`) y el fallo genérico de generación (`GENERATION_FAILED`) se
  distinguen en el log, igual que se distinguen en la respuesta al cliente (#144). Un
  operador no debe investigar en el sitio equivocado.

- **D7 — Las claves de proveedor nunca se registran.** El objeto de configuración no se
  vuelca en ningún punto. Además, los errores del proveedor se registran con su código
  y su estado, nunca con su cuerpo: el mensaje de un error de Groq puede contener
  fragmentos de la petición.

- **D8 — El fallo de una generación se registra en el punto donde se clasifica.**
  El clasificador ya existe en `services/chat.ts` y sabe distinguir la cuota del fallo
  genérico. El log se escribe ahí, no en un manejador de errores que no lo ve: un
  error de generación dentro de un stream no pasa por el manejador de errores de
  Fastify, porque la respuesta ya empezó.

- **D9 — El log se puede sustituir en los tests.** El logger se inyecta por el mismo
  seam que el resto de proveedores (`AppDependencies`), de modo que un test pueda
  afirmar sobre lo que se registró sin escribir en la salida de la suite.

## Pruebas

- **Nivel por entorno:** el nivel por defecto es `info`; un nivel desconocido cae en
  `info`; un nivel válido se respeta.
- **Identificador de correlación:** la respuesta trae la cabecera `x-request-id`; dos
  peticiones distintas tienen identificadores distintos; un `x-request-id` que ya viaja
  en la petición se respeta tal cual.
- **Traza de petición:** al terminar una petición, el log tiene el método, la ruta, el
  código de estado y la duración.
- **Fallo clasificado:** un error de generación con estado 429 se registra con
  `QUOTA_EXHAUSTED`; uno sin ese estado, con `GENERATION_FAILED`. Los dos se distinguen
  en el log.
- **Sin secretos:** ninguna clave de proveedor aparece en la salida del logger, ni en
  una traza de petición ni en el registro de un fallo.
- **Sin contenido del corpus:** el cuerpo de la petición y el historial no aparecen en
  la traza.

La prueba de secretos tiene que **morder**: si el mecanismo se rompe y la clave se
registra, el test tiene que fallar. No basta con comprobar que la clave no está.

## Fuera de alcance

- Métricas, trazas distribuidas y paneles.
- Alertas.
- Rotación de logs a nivel de aplicación (corresponde a la plataforma).
- Lint y formateo de la API: viven en #150.
