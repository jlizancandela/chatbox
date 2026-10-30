# Decisión 012: un seam de proveedores al construir la API y una suite hermética

## Estado

Aceptada (2026-10-30). La parte de embeddings la sustituye la Decisión 013: el
proveedor ya no es Gemini, pero el seam y la suite hermética siguen vigentes. Las
referencias a `GEMINI_API_KEY` de este documento describen el estado anterior.

## Contexto

La suite de la API no era una red de seguridad (#141):

1. **Los tests de ruta llamaban a los proveedores de verdad.** El servicio de embedding
   se construía dentro del handler, así que no había forma de sustituirlo. Con clave
   real, la suite gastaba cuota y dependía de la red; sin clave, fallaba.
2. **CI no la ejecutaba.** El flujo de la API solo compilaba, así que un rojo pasaba
   desapercibido.

El test de socket real —el que prueba que al irse el cliente se aborta la llamada al
modelo— estaba rojo por la primera causa, no por un fallo del código.

La Decisión 001 pide documentar las decisiones de arquitectura que no especifican una
implementación concreta. Esta lo es: define cómo consigue la API sus proveedores y qué
garantiza la suite.

## Decisión

### Un solo punto de inyección, al construir la aplicación

`AppOptions.dependencies` acepta los tres proveedores externos: base de datos
(`pg`), generación (`groqClient`) y embeddings (`embedContent`). Fastify Autoload
reparte las opciones de construcción a todos los plugins, así que el seam es uno y no
hay que cablear nada en otro sitio.

Cada plugin decide con lo que recibe: si la dependencia está, decora la instancia con
ella y no abre conexiones ni construye clientes; si no está, usa el proveedor real con
las mismas exigencias de siempre (`DATABASE_URL`, `GROQ_API_KEY`, `GEMINI_API_KEY`).
En producción no se pasa nada.

### Los servicios reciben su colaborador

Ningún servicio construye el proveedor dentro. El de embedding dejó de hacerlo en el
handler de `/api/chat` y la ruta le pasa `fastify.embedding.embedText`. La ingesta
recibe su `embedContent` por parámetro y el CLI le pasa el valor por defecto, que es el
real.

### Los dobles se comportan como el real en lo que importa

Respetan la señal de aborto. Un doble que la ignorase devolvería la respuesta entera
aunque el abort se hubiera disparado, y el test pasaría con el fallo presente.

### La suite no sale a internet

`test/setup.ts` se carga antes de cada archivo (`-r`) y cierra `fetch` a todo lo que no
sea el bucle local. Un test al que se le olvide un doble falla al instante diciendo qué
URL intentó alcanzar, en vez de quedarse colgado hasta que la red agota el tiempo.
Cubre lo que usan los dos SDK: si alguno cambiara de transporte, sería invisible.

### CI ejecuta la suite, sin claves de proveedor

`pnpm verify` (compilación, typecheck de los tests y suite) corre en cada PR y en cada
push a `main` que toque `api/`. La base de datos es un servicio de PostgreSQL con
pgvector; las claves de Gemini y Groq no se configuran. La imagen solo se publica si la
verificación pasa.

### `GEMINI_VECTOR_DIMENSION` por defecto vale 768

Es la dimensión que fija el esquema (`document_chunks.embedding` es `vector(768)` y la
migración no admite otra). Un valor explícito inválido sigue siendo un error. Lo que sí
se aplaza es la exigencia de `GEMINI_API_KEY`: se comprueba al construir el proveedor
real, no al importar el módulo, porque un test que inyecta el suyo no necesita clave.
Un test de integración contrasta la dimensión configurada con la de la columna, así que
si las dos se separan, la suite lo dice.

## Consecuencias

- La suite se puede ejecutar sin credenciales y sin red; un verde significa algo.
- Quitar un doble devuelve ese test al proveedor y falla con una causa concreta.
- El test de socket real sigue hablando por un socket de verdad: lo que se sustituye
  son los proveedores, no el transporte.
- El guardián solo ve `fetch`. Un cliente que hablase por otro transporte pasaría por
  debajo; hoy no hay ninguno.
- **Lint no entra en CI.** `api/` no tiene configuración de Biome y el código no está
  formateado con ella; activarlo obligaría a reformatear todo el árbol en un cambio que
  no va de eso. Queda pendiente como issue propia.

## Verificación

- `cd api && pnpm verify`.
- Con el entorno sin `GEMINI_API_KEY` ni `GROQ_API_KEY`, la misma suite pasa entera.
- Quitar un doble de un test de ruta lo rompe: sin clave, la aplicación se niega a
  arrancar con `GROQ_API_KEY is required`. `test/hermeticity.test.ts` lo comprueba.
