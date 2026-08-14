# TODO — MVP RAG vectorial

Este archivo refleja el estado real de `docs/plan-implementacion-api-chatbox.md`.

## Paso 1 — Base ejecutable y almacenamiento vectorial (en progreso)

- [x] Crear la API con Fastify y TypeScript.
- [x] Conectar PostgreSQL y habilitar `pgvector`.
- [x] Validar `DATABASE_URL` al arrancar.
- [x] Mantener un formato JSON estable para errores públicos.
- [ ] Cambiar la columna de embeddings de `vector(384)` a `vector(768)`.
- [ ] Convertir el esquema en una migración reproducible para bases existentes.
- [ ] Configurar y validar las credenciales y modelos de Gemini y Groq.
- [ ] Configurar la dimensión de embeddings y el valor top-k.
- [ ] Verificar la inserción y lectura de un vector de 768 dimensiones.

## Paso 2 — Ingesta por CLI (no iniciado)

- [ ] Crear un comando CLI para archivos Markdown y texto plano.
- [ ] Implementar chunking simple con un solapamiento pequeño.
- [ ] Generar embeddings con `gemini-embedding-001` a 768 dimensiones.
- [ ] Guardar fuente, texto y vector en PostgreSQL.
- [ ] Informar cantidades procesadas y errores.
- [ ] Verificar que un documento queda disponible para búsqueda vectorial.

## Paso 3 — Recuperación y chat fundamentado (contrato inicial)

- [x] Crear `POST /api/chat` con validación JSON básica.
- [ ] Añadir una longitud máxima para la pregunta.
- [ ] Generar el embedding de la pregunta con Gemini.
- [ ] Implementar la búsqueda vectorial top-k.
- [ ] Definir cuándo el contexto recuperado es insuficiente.
- [ ] Integrar Groq usando únicamente la pregunta y el contexto recuperado.
- [ ] Devolver la respuesta y sus fuentes en JSON.
- [ ] Evitar la llamada a Groq cuando no exista contexto suficiente.
- [ ] Sustituir la respuesta temporal `501 CHAT_NOT_IMPLEMENTED`.

## Paso 4 — Protecciones mínimas y entrega (no iniciado)

- [ ] Configurar Redis para el control de peticiones.
- [ ] Añadir rate limiting configurable por IP respaldado por Redis.
- [ ] Configurar la expiración de los contadores.
- [ ] Devolver una respuesta `429` clara al superar el límite.
- [ ] Configurar CORS para el origen permitido.
- [ ] Configurar límites de tamaño de petición.
- [ ] Mantener logs mínimos sin secretos ni contenido sensible.
- [ ] Documentar variables de entorno, migración, ingesta y arranque.
- [ ] Documentar una llamada válida a `POST /api/chat`.
- [ ] Verificar que el límite se aplica y se restablece al expirar el contador.
- [ ] Verificar el flujo completo desde un entorno limpio.

## Próximo trabajo

Cerrar el Paso 1 comenzando por migrar `vector(384)` a `vector(768)` y comprobar la escritura y lectura de un vector real antes de implementar la ingesta.
