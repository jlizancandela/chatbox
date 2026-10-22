# RF-F06 — El seguimiento del hilo del chatbox

> Convención del proyecto: un spec por RF en `.specs/`, decisiones de proceso en
> `docs/decisions/` de la raíz, glosario en `GLOSSARY.md` de la raíz.
>
> Es una **spec ligera**: RF-F06 ya está en `frontend/TODO.md` y lo que estaba mal no era
> el requisito, sino su implementación. El diagnóstico es del 2026-10-22, con la disciplina
> de `diagnosing-bugs`. Issue: #102.

## Síntesis (decisiones acordadas, 2026-10-22)

- **D1 — El desplazamiento sigue al tamaño, no al estado**: un `ResizeObserver` sobre la lista
  de mensajes. Cuando el hilo crece, si la persona lo sigue, se vuelve al final; si se ha
  apartado, se recalcula la distancia y aparece el botón.
- **D2 — La distancia se mide cuando significa algo**: el widget desplaza el hilo **hacia el
  final**, así que la posición intermedia de una animación no dice nada de la persona. Solo
  se deja de seguir el hilo cuando alguien **sube**.
- **D3 — Seguimiento instantáneo, salto animado**: una sola regla decide según la intención.
  Con `prefers-reduced-motion` ninguno de los dos se mueve.
- **D4 — El seguimiento es instantáneo porque es continuo**: se actualiza con cada token, y
  una animación se reinicia en cada actualización y nunca llega.
- **D5 — La regla es una sola función** con la intención como parámetro, en
  `src/chat/domain/motion.ts`. El literal `"smooth"` sigue viviendo solo ahí (contrato de
  RF-F44).
- **D6 — La lista de mensajes expone su `<ol>`** con un `listRef`: el crecimiento se observa
  sin que el padre tenga que conocer el markup del hijo.
- **D7 — Verificación de navegador con stream realista**: el mock que entrega la respuesta
  entera de golpe no genera los casos en los que el seguimiento importa.
- **D8 — Enmienda a RF-F44**: su criterio 5 («el autoscroll y el botón piden el mismo
  comportamiento») es lo que impide arreglar el seguimiento. Se enmienda en
  `docs/decisions/008-movimiento-reducido.md` (decisión 6) y en la spec de RF-F44.

## Auditoría (medido en Chromium, 2026-10-22)

### El desplazamiento seguía al estado, no al tamaño

El markdown del asistente se carga diferido (RF-F30) y `AssistantMarkdown` devuelve `null`
hasta que llega: la burbuja crece **después** del último cambio de estado, y el efecto de
desplazamiento —cuyas dependencias son `messages`, `currentResponse` y `localNotice`— no
vuelve a correr.

| Momento | `scrollTop` | `scrollHeight` | ¿al final? | botón «Ir al final» |
|---|---|---|---|---|
| antes del markdown | 112 | 200 | no | visible |
| después del markdown | 112 | 840 | **no** | **no aparece** |

Crecer no dispara ningún evento `scroll`, así que nada recalcula la distancia: el botón de
escape tampoco aparece.

### La medición compite con el scroll suave

El widget siempre desplaza hacia el final. Medir la distancia en el mismo tick en que se
inicia una animación lee una **posición intermedia**, que da un falso «la persona se fue»: el
seguimiento se corta a mitad de la respuesta.

Stream realista (60 tokens con 40 ms de retardo), misma respuesta, **una sola variable**:

| Modo | `scrollTop` | `scrollHeight` | ¿al final? | botón |
|---|---|---|---|---|
| Suave (por defecto) | **91** | 8200 | **no** | visible |
| Instantáneo (`prefers-reduced-motion: reduce`) | 8112 | 8144 | sí | oculto |

En el modo por defecto el hilo se quedaba en el 1% de una respuesta de 8000 px: el
seguimiento **no funcionaba**.

### Y el scroll suave no puede seguir un stream

El seguimiento se actualiza con cada token. Una animación se reinicia en cada actualización y
nunca llega: el hilo se queda atrás. Por eso el seguimiento tiene que ser instantáneo y el
salto al final animado.

## Diseño

### La regla (`src/chat/domain/motion.ts`)

```ts
export type ScrollIntent = "seguimiento" | "salto";

export const scrollBehavior = (reduceMotion: boolean, intent: ScrollIntent): ScrollBehavior => {
	if (intent === "seguimiento") return "auto";
	return reduceMotion ? "auto" : "smooth";
};
```

Una sola función, un solo sitio donde vive el literal `"smooth"` (contrato de RF-F44).

### El componente (`src/components/Chatbox.tsx`)

- `following`: si la persona sigue el hilo. Solo un scroll **hacia arriba** la aparta.
- `lastScrollTop`: la última posición conocida, para distinguir «desplazó el widget» de
  «subió alguien».
- Un `ResizeObserver` sobre la lista de mensajes: cuando crece, si se sigue el hilo, se
  vuelve al final; si no, se recalcula la distancia.

### La lista de mensajes (`src/components/ChatMessages.tsx`)

`listRef?: Ref<HTMLOListElement>`: el `<ol>` se expone para que quien controla el
desplazamiento pueda observar su tamaño, sin que el padre conozca el markup del hijo.

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/chat/domain/motion.ts` | La regla con la intención: seguimiento instantáneo, salto animado |
| `src/components/Chatbox.tsx` | `following` y `lastScrollTop`; el `ResizeObserver`; los dos caminos con su intención |
| `src/components/ChatMessages.tsx` | `listRef`: el `<ol>` de los mensajes |
| `test/unit/chat/domain/motion.test.ts` | La regla pura con las dos intenciones |
| `test/browser/scroll-follow.spec.ts` | Nuevo: el seguimiento en Chromium (stream realista, markdown diferido, la persona que se aparta) |
| `test/unit/strings-inventory.test.ts` | Lista blanca: las intenciones de scroll |
| `frontend/.specs/RF-F44-movimiento-reducido.md` | Enmienda del criterio 5 |
| `docs/decisions/008-movimiento-reducido.md` | Enmienda de la decisión 6 |
| `frontend/TODO.md` | Anotar RF-F06 con el issue: ya estaba marcado, pero la implementación no lo cumplía |

## Criterios de aceptación

1. Con una respuesta que llega token a token, el hilo está al final cuando termina.
2. Con el markdown del asistente cargando después, el hilo vuelve al final.
3. Quien se aparta del hilo no es arrastrada de vuelta y ve el botón «Ir al final».
4. La regla de scroll distingue las dos intenciones y el literal `"smooth"` sigue viviendo
   solo en `src/chat/domain/motion.ts`.
5. Los tres casos anteriores fallan contra el código anterior al arreglo.

## Riesgos

- **La carrera entre el scroll de la persona y el del widget**: si quien se aparta hace scroll
  y en el mismo frame llega un token, el widget puede devolver el hilo al final. Es la misma
  carrera que tenía el código anterior, no una nueva; se acota esperando el evento `scroll`
  de la persona antes de afirmar que se apartó.
- **El `ResizeObserver` no existe en navegadores muy antiguos**: sin él, el hilo no sigue el
  crecimiento tardío del markdown. Es una degradación, no un fallo: el widget funciona igual
  que antes.
- **El seguimiento instantáneo cambia el tacto**: el hilo salta en vez de deslizarse mientras
  llega la respuesta. Es lo que hacen los chats de verdad, y es la única forma de que un
  scroll por token llegue a algún sitio.

## Verificación

```bash
npm run verify        # lint + typecheck + build + test -- --run
npm run test:browser  # suite de Playwright (Chromium)
```

## Plan de commits

1. `fix(frontend): el hilo sigue a la respuesta cuando llega (RF-F06)`
2. `docs(frontend): enmendar el criterio 5 de RF-F44 y la decisión 6 (RF-F06)`

## Referencias

- Requisito: `../../docs/stitch-frontend-design/SPEC-FRONTEND.md` (RF-F06, RF-F30).
- Enmienda: `RF-F44-movimiento-reducido.md` y `../../docs/decisions/008-movimiento-reducido.md`.
- Issue: #102.
