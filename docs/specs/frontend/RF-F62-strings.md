# RF-F62 — Centralización de los textos de UI

> Convención del proyecto: un spec por RF en `docs/specs/frontend/`, decisiones de proceso en
> `docs/decisions/` de la raíz, glosario en `GLOSSARY.md` de la raíz.
>
> Spec confirmado el 2026-10-18 tras sesión de `grill-with-docs`. Sin ADR: todas las
> decisiones son de implementación interna y ninguna fija un commitment arquitectónico
> (ver "Por qué no hay ADR").

## Síntesis de la entrevista (decisiones acordadas, 2026-10-18)

- **D1 — Alcance**: un único módulo con los textos de la vista **y** los mensajes de
  `chat-errors.ts`. Un mensaje de error de red es texto de interfaz aunque lo componga
  la capa de infraestructura; dos sitios donde buscar el copy era el problema a evitar.
- **D2 — Forma**: objeto anidado por zona, `as const`, con `errors` indexado por el
  `code` de `ChatError` que ya existe. Cada error nace de una clave de `strings.errors`,
  lo que hace el vínculo explícito.
- **D3 — Superficie pública**: módulo **interno**, sin prop `strings`. `lang="es"` sigue
  fijo (RF-F45). El sitio host ajusta contenido con las props que ya existen (`title`,
  `suggestions`, `contactUrl`); los textos del widget son internos.
- **D4 — Parametrización**: registros para conjuntos cerrados (rol del autor del mensaje,
  estado del botón) y funciones solo para interpolación real (contador de caracteres). No
  hay motor de plantillas propio.
- **D5 — Enforcement**: los tests importan claves en vez de literales, más un test de
  inventario acotado a los archivos con copy, con lista blanca explícita.
- **D6 — Documentación**: este spec, sin ADR, más una línea en `AGENTS.md` que declare las
  convenciones del frontend.

## Problem Statement

El widget tiene 34 textos de interfaz únicos repartidos en seis componentes (`Chatbox`,
`ChatInput`, `ChatHeader`, `ChatMessages`, `EmptyState`, `NewConversation`) y en la
capa de infraestructura (`chat-errors.ts`, nueve códigos de error ya indexados por
`code`, con siete textos distintos porque dos pares comparten redacción).
El copy vive en el sitio de uso, así que cambiar una palabra obliga a los seis archivos a
la vez, no hay forma de auditar el texto completo del widget, y no hay forma de comprobar
que no vuelva a dispersarse.

## Solution

`src/strings.es.ts` declara un objeto `as const` anidado por zona con todo el texto de la
interfaz. Los componentes importan claves; `chat-errors.ts` compone sus `ChatError` desde
`strings.errors`. El módulo es interno: no se exporta como contrato público ni se expone
como prop.

## User Stories

1. Como visitante del sitio host, quiero que el texto del chatbox sea consistente, para no
   leer la mitad en un idioma y la mitad en otro.
2. Como mantenedor del proyecto, quiero un único archivo donde leer todo el copy del widget,
   para revisarlo y cambiarlo con criterio.
3. Como mantenedor del proyecto, quiero saber si `chat-errors.ts` tradujo un código nuevo,
   para que ningún `ChatError` quede con texto hardcodeado.
4. Como mantenedor del proyecto, quiero que un test falle si alguien añade un literal fuera
   del módulo, para que la centralización no se deshaga en silencio.
5. Como mantenedor del proyecto, quiero que tocar una cadena no rompa los tests de
   comportamiento, porque esos tests verifican comportamiento, no redacción.

## Implementation Decisions

### Forma del módulo

Objeto anidado por zona, declarado con `as const`, con las zonas alineadas a los
componentes que las consumen (`header`, `emptyState`, `input`, `messages`, `actions`,
`notices`, `errors`) más la zona `a11y`, que agrupa los rótulos que anuncia el lector de
pantalla y que el inventario cita aparte.
`errors` se indexa por el `code` de `ChatError`: `HTTP_400`, `HTTP_413`, `HTTP_429`,
`HTTP_SERVER`, `NETWORK_ERROR`, `STREAM_ERROR`, `INCOMPLETE_STREAM`, `TIMEOUT`,
`QUESTION_INVALID`.

Los valores que hoy se derivan por ternario pasan a registros, no a funciones: el autor del
mensaje (`strings.messages.author.user` / `.assistant`) y las etiquetas del botón según
estado (`strings.input.send` / `.stop`, con su `aria-label` emparejado). Son conjuntos
cerrados: un registro da búsqueda exacta y typecheck.

El contador de caracteres es la única interpolación real y se modela como función
(`chars(current, max)`). El tipo `ChatStrings` se deriva de `typeof strings` y no se
declara aparte: el módulo es de datos, no de contrato público.

### Inventario cubierto

- Cabecera: título por defecto, badge `IA`, aviso de alcance.
- Estado vacío: pregunta intro y tres sugerencias por defecto.
- Entrada: label, placeholder, enviar/detener (etiqueta y `aria-label`), contador,
  enlace de contacto.
- Mensajes: autor por rol, indicador "escribiendo", rótulo de la lista.
- Acciones: ir al final, nueva conversación y su confirmación en línea.
- Avisos: "no lo tengo" y contexto recortado.
- Rótulos accesibles (zona `a11y`): rótulo del `nav` de sugerencias y rótulo de la
  conversación. El rótulo de la lista de mensajes va en `messages.listLabel`, junto al
  resto de la zona que lo usa.
- Errores: los nueve códigos de `chat-errors.ts`, indexados por `code`.

Dos pares comparten redacción hoy (`HTTP_400` con `QUESTION_INVALID` y `NETWORK_ERROR` con
`TIMEOUT`). Se mantienen literales separados a propósito: unificarlo sería revisar el copy,
y la revisión de redacción queda fuera de alcance. Cuando cambie la redacción de uno, el
test de contrato sigue cubriendo la paridad de claves.

### Enforcement

- Los tests de comportamiento y de error importan claves (`strings.errors.STREAM_ERROR`)
  en lugar de literales: cambiar la redacción no rompe la suite.
- Un test de inventario recorre los archivos con copy (`src/components/*.tsx` y
  `src/chat/infrastructure/chat-errors.ts`) y falla ante literales fuera del módulo,
  con lista blanca explícita: clases `chatbox*`, valores técnicos de `aria-*`
  (`aria-labelledby`, `aria-live`, `aria-atomic`), `chatbox-question`, y los roles
  `user` / `assistant`. La lista se lee en un vistazo y no usa heurísticas de idioma.

### Por qué no hay ADR

Ninguna decisión compromete arquitectura más allá del refactor: el módulo es interno, no
añade dependencias y no congela ninguna forma pública. Un ADR que documente la ausencia de
una prop sería ruido. Si en el futuro aparece un segundo idioma o un host que necesita otro
copy, la decisión que habrá que escribir como ADR es si `strings` pasa a formar parte del
contrato público.

### Fuera de alcance

- Prop `strings` o cualquier parámetro de idioma.
- Motor de plantillas o interpolador propio.
- Segundo idioma (`strings.en.ts`): el nombre del archivo ya deja la dimensión abierta.
- Revisión de redacción del copy existente: la migración no cambia ninguna palabra.
- ADR 004.

## Testing

- `test/unit/chat/infrastructure/chat-errors.test.ts`: el assert de mensaje pasa a
  `strings.errors.STREAM_ERROR`; los asserts de `code` no cambian.
- `test/component/chatbox-behavior.test.tsx` (3 literales) y `test/browser/theming.spec.ts`
  (1 literal): pasan a claves.
- Test nuevo de inventario: falla si aparece un literal fuera de `strings.es.ts` en los
  archivos con copy.
- Sin cambios de comportamiento observable: la suite actual debe seguir verde sin cambios
  de aserción más allá del copy.

## Glosario

Definido en `GLOSSARY.md` (raíz), sección "Textos de la interfaz": Texto de UI, Cadena
fija, Interpolación real, Lista blanca.
