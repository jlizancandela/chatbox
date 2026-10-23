# RF-F48 — El umbral de seguimiento es una regla del dominio

> Convención del proyecto: un spec por RF en `.specs/`, decisiones de proceso en
> `docs/decisions/` de la raíz, glosario en `GLOSSARY.md` de la raíz.
>
> Es una **spec ligera** de un defecto de contrato de RF-F06 que el diagnóstico midió en
> Chromium el 2026-10-23. Enmienda RF-F06. Issue: #108.

## Síntesis (decisiones acordadas, 2026-10-23)

- **D1 — La regla vive en el dominio**: `src/chat/domain/scroll.ts`, con `followThreshold()`
  y `isAwayFromEnd(distancia)`. Es el patrón que RF-F06 ya fijó para la regla de movimiento
  (D5: «la regla es una sola función, en `src/chat/domain/motion.ts`»): lo que se puede
  probar sin DOM, vive en el dominio. Hoy la regla del seguimiento es un literal dentro del
  componente y nadie más puede usarla.
- **D2 — El umbral no depende de la altura del widget**: 16 px fijos, en vez de
  `min(80, max(16, clientHeight / 2))`. Con el término `clientHeight / 2`, la definición de
  «apartado» se movía sola cuando el widget cambiaba de alto: la región de estado colapsada
  de RF-F47 se llevó 20 px y con ello se llevó el margen del test.
- **D3 — 16 px es el número que hace las dos cosas**: el ruido que se ignora (un dedo
  tembloroso, un rebote) y el recorrido máximo que el seguimiento devuelve al final. Con 16 px
  ese tirón no se ve; con 80 px, un flick deliberado de 30 px en un trackpad se volvía al
  final sin avisar.
- **D4 — La distancia es la señal estable; el salto animado es la excepción**: fuera de un
  salto solicitado por el widget, la distancia al final decide sin comparar contra un
  `scrollTop` anterior. Esa referencia podía quedar obsoleta entre el crecimiento del stream
  y el gesto de la persona, y tragarse un apartarse de 30 px. Durante un salto animado, una
  bandera ignora las posiciones intermedias y se libera cuando el hilo vuelve al final.
- **D5 — El test deriva su precondición de la regla**: el test de RF-F06 espera a que el hilo
  desborde **más que el umbral** —la misma regla que usa el widget— en vez de un número de
  píxeles adivinado. Con un número adivinado, cambiar el umbral rompía el test, aunque el
  widget se comportara bien.

## Auditoría (medido en Chromium, 2026-10-23)

El widget trata como «seguir» lo que queda a menos de un umbral del final. Subir el hilo
al tope deja a la persona a una distancia del final igual al **desborde** de la conversación.

| Momento | Desborde | Umbral | Margen |
|---|---|---|---|
| Antes de RF-F47 | 91 px | 80 px | **+11 px** |
| Después de RF-F47 (la región colapsada da 20 px más de alto) | 71 px | 80 px | **−9 px** |

El widget hizo bien las dos veces: con 91 px de desborde la persona se apartaba y el hilo no
la arrastraba; con 71 px el widget la seguía, porque a menos de ~80 px del final se está
«siguiendo». Lo que cambió fue el margen del test: pasó de 11 px a −9 px. El test de RF-F06
pasaba por un accidente de layout con 11 px de margen.

Ese accidente se tapó esperando un desborde de 300 px, que es otro número adivinado: sigue
atado a la longitud del guion y al viewport, y las dos lentes de legibilidad y resiliencia de
la revisión nativa lo señalando (`R2-scroll-threshold`,
`R4-SCROLL-PRECONDITION-PIXEL-THRESHOLD`).

Con el umbral de 16 px, un apartarse de 30 px cuenta como apartarse (30 > 16) y con el de 80
no contaba (30 < 80). Ese es el comportamiento que cambia.

## Diseño

- `src/chat/domain/scroll.ts` (nuevo):
  - `followThreshold(): number` — el umbral, 16 px, sin dependencias.
  - `isAwayFromEnd(distanceFromEnd: number): boolean` — si la distancia al final cuenta como
    «apartado».
- `src/components/Chatbox.tsx`: `handleConversationScroll` usa la regla del dominio en vez
  del literal en línea.
- `test/browser/scroll-follow.spec.ts`: la precondición se deriva de `followThreshold()`, y un
  test nuevo fija que apartarse un poco (30 px) tampoco se convierte en «seguir».

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/chat/domain/scroll.ts` | Nuevo: el umbral y la pregunta «¿está apartado?» |
| `src/components/Chatbox.tsx` | Usa la regla del dominio; fuera el literal en línea |
| `test/unit/chat/domain/scroll.test.ts` | Nuevo: los límites de la regla, sin DOM |
| `test/browser/scroll-follow.spec.ts` | La precondición deriva de la regla; test nuevo de «apartarse un poco» |
| `frontend/.specs/RF-F06-seguimiento-del-hilo.md` | Enmienda: el umbral es una regla del dominio y vale 16 px |
| `../../GLOSSARY.md` | «Umbral de seguimiento» |
| `frontend/TODO.md` | RF-F48 |

## Criterios de aceptación

1. El umbral vive en `src/chat/domain/scroll.ts` y el widget lo usa: no queda ningún literal
   de umbral en el componente.
2. El umbral son 16 px y no depende de la altura del contenedor.
3. Una persona que se aparta más de 16 px del final no es arrastrada de vuelta y ve el botón
   «Ir al final».
4. El test de RF-F06 deriva su precondición de la regla: no hay un número de píxeles
   adivinado en el test.
5. Cambiar el umbral no rompe el test de seguimiento (la precondición lo deriva).
6. Los tres casos de RF-F06 siguen en verde: el hilo llega al final, sigue al final cuando el
   markdown crece después, y no arrastra a quien se aparta.

## Riesgos

- **Cambia el tacto del widget**: un scroll de entre 16 y 80 px que antes se revertía ahora
  se respeta, y uno de menos de 16 px que antes se respetaba ahora se revierte. Es el cambio
  pedido, y el segundo movimiento es imperceptible.
- **La conversación corta**: el término `clientHeight / 2` se cae porque su razón —que el
  botón «Ir al final» pueda aparecer aunque la conversación apenas desborde— la cumple el
  suelo de 16 px.
- **Los saltos animados**: las posiciones intermedias no son una interacción de la persona.
  `jumping` las ignora y se libera cuando la distancia vuelve a cero; así el botón no aparece
  durante una animación iniciada por «Ir al final».
- **El número 16 aparece en dos sitios** (la regla y su test unitario): es el contrato
  observable de la regla, no una duplicación de la decisión.

## Verificación

```bash
npm run verify        # lint + typecheck + build + test -- --run
npm run test:browser  # suite de Playwright (Chromium)
```

## Plan de commits

1. `feat(frontend): el umbral de seguimiento es una regla del dominio (RF-F48)`
2. `docs(frontend): spec de RF-F48 y enmienda de RF-F06 (RF-F48)`

## Referencias

- Enmienda: `RF-F06-seguimiento-del-hilo.md` (la regla del umbral y el criterio 3).
- Patrón: `RF-F06-seguimiento-del-hilo.md` D5 (una regla, en el dominio).
- Glosario: `../../GLOSSARY.md`.
- Issue: #108.
