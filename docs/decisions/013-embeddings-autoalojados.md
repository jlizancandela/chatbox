# Decisión 013: embeddings autoalojados dentro del proceso

## Estado

Aceptada (2026-10-30).

## Contexto

El widget es público y sin login, y los embeddings los generaba Google en su plan
gratuito (#142):

1. **Legal.** Los términos de Google exigen *Paid Services* para ofrecer un *API
   Client* a usuarios de la EEA, Suiza o el Reino Unido. El widget recibe visitantes
   españoles, así que el uso gratuito incumple el contrato.
2. **Datos.** Fuera de la EEA, la cuota gratuita permite usar lo enviado para mejorar
   los productos de Google y que revisores humanos lo lean. El corpus contiene el email
   y el teléfono del CV.
3. **Dependencia.** Una clave, una cuota y unas condiciones más que pueden cambiar.

Groq se queda como proveedor de texto: su plan gratuito sí permite servir un sitio
público.

## Decisión

Los embeddings se calculan **dentro del proceso de la API** con EmbeddingGemma 300M en
ONNX, cuantizado a `q4`, mediante `@huggingface/transformers`.

- **Misma dimensión, distinto espacio.** El modelo devuelve 768 dimensiones, así que el
  tipo `vector(768)` y el índice HNSW no cambian. El espacio de embeddings sí: la firma
  de embeddings cambia y el corpus deja de ser válido. Reingerir es obligatorio y es la
  única operación de datos del cambio.
- **Prefijos por finalidad.** La consulta se embebe con
  `task: search result | query: …` y el documento con `title: … | text: …`. Sin esa
  distinción la recuperación se degrada aunque los vectores sigan siendo comparables.
- **Normalización L2.** El servicio normaliza antes de serializar para pgvector. El
  contrato es del servicio, no del modelo: un cambio de pesos no puede dejar el corpus
  en otra escala sin que nadie lo note.
- **Un solo camino.** No hay selector de proveedor en tiempo de ejecución. El seam de
  `dependencies.embedContent` existe para los tests; en producción solo hay un modelo.
- **El modelo se cuece en la imagen.** Se descarga al construir (`pnpm
  embeddings:fetch` en local, una etapa del Dockerfile en la imagen) y el proceso lee
  del disco con `allowRemoteModels = false`. El arranque no depende de la red.
- **Revisión fijada.** La descarga apunta a un commit del Hub, no a `main`, y la
  revisión entra en la firma. Republicar los pesos no cambia la imagen por sorpresa ni
  deja vectores viejos pasando por válidos.
- **Se carga una vez y bloquea el arranque.** El plugin espera a que el modelo esté
  listo; la API no escucha hasta entonces. El healthcheck del contenedor no puede
  pasar antes porque no hay nada escuchando, así que no se sirve tráfico a medias.
- **Límite de memoria.** El RSS medido en el contenedor es ~620 MB. `compose.yaml`
  limita el servicio a 1 GB para que un fallo del modelo no arrastre al resto del
  servidor.

La imagen pasa de Alpine a Debian `slim`: los binarios de ONNX Runtime son glibc y no
hay build musl.

## Calibración del umbral

Tras reingerir el corpus, la escala de distancias es otra. Medido con las preguntas del
widget y otras de visitante:

| Pregunta | Mejor distancia |
|---|---:|
| ¿Qué stack usa Jorge? | 0.528 |
| ¿Qué proyectos ha hecho? | 0.562 |
| ¿Dónde ha trabajado? | 0.572 |
| ¿Cómo puedo contactarle? | 0.769 |
| ¿Cómo se prepara una paella valenciana? | 0.897 |
| ¿Quién ganó el mundial de fútbol? | 0.937 |
| ¿Cuál es la capital de Francia? | 0.917 |
| Escríbeme un poema | 0.861 |

`SIMILARITY_THRESHOLD` pasa de `0.5` a `0.8`: incluye las cuatro preguntas de referencia
y rechaza las preguntas ajenas con margen. Una pregunta ajena muy cercana al dominio
—«¿Me recomiendas una película?», 0.742— puede recuperar fragmentos; el prompt de
generación ya obliga a responder que solo habla del perfil de Jorge.

Las cuatro preguntas del widget, con el fragmento que devuelve el top-1 tras reingerir:

| Pregunta | Top-1 | Distancia |
|---|---|---:|
| ¿Qué stack usa Jorge? | Currículum#0 (perfil); #4 (habilidades) en el top-5 | 0.528 |
| ¿Qué proyectos ha hecho? | Informe de GitHub#3 (portfolio) | 0.562 |
| ¿Dónde ha trabajado? | Currículum#2 (experiencia) | 0.572 |
| ¿Cómo puedo contactarle? | Currículum#0 (email, teléfono, enlaces) | 0.769 |

En «stack» el top-1 es el perfil, que dice «full stack»; la lista de tecnologías está
en el quinto fragmento y entra en el contexto de generación. La respuesta servida por
la API se comprobó con las cuatro preguntas y fue correcta en los cuatro casos.

**Ojo al desplegar:** un `.env` que conserve `SIMILARITY_THRESHOLD=0.5` deja las cuatro
preguntas sin contexto. Hay que actualizarlo o borrar la variable para usar el valor
por defecto.

## Consecuencias

- El corpus se reingiere una vez. No hay migración de esquema.
- La imagen queda en ~1 GB (modelo y runtime de ONNX incluidos) y el contenedor usa
  ~620 MB de RSS.
- Volver a un proveedor externo exige reingerir otra vez: el espacio cambia.
- `q4` no degrada de forma medible frente a `q8` en las preguntas reales del corpus
  (top-1 idéntico), y usa una cuarta parte de la memoria.
- Los tests inyectan el proveedor por el seam de la Decisión 012 y no cargan ONNX ni
  tocan la red.
- La imagen redistribuye pesos de Gemma. Al publicarla hay que acompañar los Gemma
  Terms of Use, que es la licencia del modelo.

## Verificación

- `cd api && pnpm verify`: 65 tests sin red ni claves de proveedor.
- Reingesta real del corpus y calibración con
  `node dist/cli/calibrate.js "¿Qué stack usa Jorge?" …`.
- La imagen se arrancó con `--network none`: el modelo cargó del disco y `/health`
  respondió 200 sin red. Un `docker stats` confirmó el RSS documentado.
