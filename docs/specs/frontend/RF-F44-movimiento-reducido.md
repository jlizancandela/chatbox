# RF-F44 — Movimiento reducido del chatbox

> Convención del proyecto: un spec por RF en `docs/specs/frontend/`, decisiones de proceso en
> `docs/decisions/` de la raíz, glosario en `GLOSSARY.md` de la raíz.
>
> Spec confirmado el 2026-10-22 tras sesión de `grill-with-docs`. Decisión de verificación
> en `docs/decisions/008-movimiento-reducido.md`. Issue: #100.

## Síntesis de la entrevista (decisiones acordadas, 2026-10-22)

- **D1 — Alcance del trabajo**: **contrato + guarda**, patrón RF-F42 y RF-F43, más el
  indicador que el diseño pide. No es un retoque de CSS: el widget hoy **no cumple** RF-F44,
  aunque lo parezca.
- **D2 — El indicador se construye**: tres puntos botando en la burbuja del asistente vacío,
  como en el export de Stitch. Es un cambio de diseño, no solo de accesibilidad, y es la razón
  por la que el requisito tiene contenido: "no se animará" presupone algo animable.
- **D3 — La burbuja deja de pintar el texto**: la frase "El asistente está escribiendo" queda
  solo en la región de estado, que ya la muestra y ya la anuncia. Hoy aparece **dos veces**
  (región y burbuja); con los puntos, una sola.
  > *Enmienda (RF-F47, 2026-10-23):* invertida. La frase se ve ahora **dentro del bocadillo**,
  > en el sitio donde aparecerá la respuesta, y la región deja de pintarla: lo anuncia igual.
  > El texto no cambia y la copia del bocadillo es decorativa (`aria-hidden="true"`), como los
  > puntos, para no duplicar texto visible y audible. Ver `RF-F47-aviso-en-la-burbuja.md`.
- **D4 — Los puntos son decorativos**: `aria-hidden="true"`. El anuncio vive en la región de
  estado (RF-F41); no se duplica texto audible.
- **D5 — La variante con movimiento reducido son los mismos tres puntos sin animación**:
  cambia el movimiento, no la forma. No hay un diseño alternativo.
- **D6 — El inventario tiene dos entradas**: el indicador de escritura (animación CSS) y el
  scroll suave (decisión de JS). Todo lo demás queda prohibido por la guarda.
- **D7 — Una sola política de scroll**, con la intención como parámetro: la regla decide en un
  solo sitio. El **seguimiento** del hilo es instantáneo —se actualiza con cada token, y una
  animación se reinicia en cada actualización y nunca llega— y el **salto** explícito al final
  es animado, salvo que la persona pida menos movimiento. Los dos caminos se condicionan por
  separado: dos caminos con la misma decisión y aplicados por separado divergen en el
  próximo refactor. *(Enmienda del 2026-10-22, con el diagnóstico de RF-F06: el criterio 5
  de esta spec decía «el mismo comportamiento» para los dos, y eso es exactamente lo que
  impedía que el hilo siguiera a la respuesta.)*
- **D8 — Bajo movimiento reducido el scroll pide `"auto"`**: `behavior: "auto"` delega en el
  `scroll-behavior` computado, así que el contrato CSS es el que garantiza el salto
  instantáneo. No se usa `"instant"`: no lo garantizan todas las versiones de Safari y un enum
  inválido lanza `TypeError` — el widget se embebe en hosts arbitrarios.
- **D9 — El `scroll-behavior` se declara explícitamente** sobre la caja de scroll
  (`.chatbox__conversation`) dentro del bloque del contrato, y la guarda impide que ninguna
  regla del widget la ponga en `smooth`.
- **D10 — La animación se declara dentro de `@media (prefers-reduced-motion: no-preference)`**:
  con movimiento reducido la animación **no se declara**, así que `animation-name` es `none`
  por ausencia y no por sobrescritura. No hay guerra de especificidad.
- **D11 — La regla blanket se queda, recortada**: `transition: none` y `animation: none` sobre
  `.chatbox *` como defensa ante el CSS que le meta un host a los elementos del widget; el
  `scroll-behavior` deja de ser global y pasa a la caja de scroll.
- **D12 — La preferencia se lee al actuar**: `window.matchMedia("(prefers-reduced-motion:
  reduce)").matches` en el momento de la acción, sin suscripción y sin estado.
- **D13 — La regla de scroll es una función pura** en `src/chat/domain/motion.ts`: traduce
  "la persona pide menos movimiento" a `ScrollBehavior`. El componente lee la preferencia y
  la invoca. Se testea sin DOM.
- **D14 — El contrato es un inventario + una guarda**: `test/motion.ts` con las fuentes de
  movimiento y sus selectores; la guarda falla si una regla del widget declara `animation`,
  `transition` o `@keyframes` fuera del bloque `no-preference`, si declara `scroll-behavior:
  smooth` en la caja de scroll, o si el JS pide `behavior: "smooth"` fuera de la regla.
- **D15 — Identidad por selector CSS**: el inventario declara los selectores, la resolución los
  busca en el DOM y la guarda escanea el CSS. No hay atributo de markup: el movimiento se
  declara en CSS y un atributo no añadiría detección.
- **D16 — Dos niveles de verificación, sin nivel manual**: mecanismo en jsdom/postcss y
  resolución en Chromium. El movimiento se resuelve con números, igual que el contraste y
  que los 44 px.
- **D17 — Entregables**: una spec, una decisión nueva (008), tres términos de glosario y una
  issue (#100). El commit es del paso de implementación.

## Auditoría (por qué no es un retoque de CSS)

| Hecho | Consecuencia |
|---|---|
| El widget no tiene ni una animación: cero `@keyframes`, cero `transition`, cero `animation` | La regla blanket de `Chatbox.css:427` no desactiva nada: el requisito es vacuo |
| `scrollToEnd()` (`Chatbox.tsx:132`) usa `behavior: "smooth"` siempre | El botón «Ir al final» hace scroll suave con movimiento reducido: incumplimiento real de RF-F44 |
| El autoscroll (`Chatbox.tsx:106`) sí lee la preferencia | Los dos caminos de scroll se condicionan por separado, y el que se cuidó fue el otro |
| El `scroll-behavior: auto` del bloque CSS no puede arreglarlo | La opción `behavior` de `scrollTo()` gana sobre la propiedad CSS |
| La regla blanket es `.chatbox *` (0,1,0) | Cualquier selector más específico la supera: no es una garantía, es una sugerencia |
| El indicador es texto plano (`ChatMessages.tsx:36`) | "el indicador no se animará" no tiene sujeto: no hay indicador animable |
| El export de Stitch lleva tres puntos botando (`animate-bounce`) | Hay un diseño de referencia para el indicador que el widget todavía no tiene |
| La frase "El asistente está escribiendo" aparece dos veces | Región (`Chatbox.tsx:175`) y burbuja (`ChatMessages.tsx:36`): el mismo string pintado dos veces |
| No hay ninguna comprobación de movimiento en el repo | El cumplimiento, si lo hubiera, sería accidental, igual que el contraste antes de RF-F42 |

## Inventario de movimiento

Las dos fuentes de movimiento del widget. La guarda vigila que no aparezca una tercera.

| id | Fuente | Dónde | Cómo se neutraliza con movimiento reducido |
|---|---|---|---|
| `typing-indicator` | Los tres puntos de la burbuja del asistente vacío | `Chatbox.css`, bloque `(prefers-reduced-motion: no-preference)` | La animación no se declara (D10) |
| `smooth-scroll` | El scroll suave del widget (autoscroll y «Ir al final») | `Chatbox.tsx`, regla de `domain/motion.ts` | `behavior: "auto"` (D8) + `scroll-behavior: auto` en la caja de scroll (D9) |

## Diseño

### CSS

```css
@media (prefers-reduced-motion: no-preference) {
	@keyframes chatbox-typing-bounce {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-4px);
		}
	}
	.chatbox__typing-dot {
		animation: chatbox-typing-bounce 1s infinite ease-in-out;
	}
	.chatbox__typing-dot:nth-child(2) {
		animation-delay: 0.15s;
	}
	.chatbox__typing-dot:nth-child(3) {
		animation-delay: 0.3s;
	}
}

@media (prefers-reduced-motion: reduce) {
	.chatbox *,
	.chatbox *::before,
	.chatbox *::after {
		transition: none;
		animation: none;
	}
	.chatbox__conversation {
		scroll-behavior: auto;
	}
}
```

Los `@keyframes` van **dentro** del bloque `no-preference`: con movimiento reducido no existe
ni la animación ni su definición, así que `animation-name` es `none` por ausencia y no por
sobrescritura. No hay nada que revivir por especificidad, y la guarda tiene una sola regla
que recordar. El comentario de cabecera de `Chatbox.css` documenta el orden de capas y tiene
que incluir las dos capas nuevas.

La caja de scroll es `.chatbox__conversation` (`<main class="chatbox__conversation">`, el
único `overflow-y: auto` del widget).

### Dominio

```ts
// src/chat/domain/motion.ts
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export const scrollBehavior = (reduceMotion: boolean): ScrollBehavior =>
	reduceMotion ? "auto" : "smooth";
```

Función pura: el `matchMedia` se queda en el componente, que es su único consumidor.

### Componente

Un solo camino de scroll. El seguimiento del hilo y el botón «Ir al final» llaman a la misma
regla, con su intención:

```tsx
const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
const behavior = scrollBehavior(reduceMotion, "salto");
```

La burbuja del asistente vacío pasa a tres puntos decorativos y deja de pintar el texto:

```tsx
<span class="chatbox__typing" aria-hidden="true">
	<span class="chatbox__typing-dot" />
	<span class="chatbox__typing-dot" />
	<span class="chatbox__typing-dot" />
</span>
```

### Inventario y guarda

- `test/motion.ts`: fuente única de las fuentes de movimiento, de sus selectores y de las
  media queries del contrato. Lo comparten los dos niveles, como `test/touch-targets.ts` en
  RF-F43.
- El verificador del contrato (`findMotionViolations(root)`) es una función pura sobre el
  árbol ya parseado: la guarda la usa contra la hoja real —parseada una sola vez, por
  `test/css-layers.ts`, que ya la comparte con el theming y el contraste— y el test la usa
  contra hojas escritas a mano. **El test tiene que incluir la entrada que rechaza**: una
  animación fuera del bloque `no-preference` tiene que producir una violación.
- La guarda es **bidireccional**, y las dos direcciones importan:
  - *inventariado → declarado*: cada fuente del inventario tiene que existir en la hoja;
  - *declarado → inventariado*: nada puede animarse fuera de los selectores del inventario.
    Con una sola dirección, una animación nueva se cuela en silencio.
- El detector del literal del scroll suave (`findSmoothScrollOffenders(sources)`) también es
  una función pura, para que el test pueda alimentarla con un mapa escrito a mano: es la
  entrada que rechaza de un detector que afirma una ausencia.
- `test/unit/chatbox-motion.test.ts` (**mecanismo**):
  - existen los dos bloques de media query del contrato;
  - ninguna regla declara `animation` ni `transition` con valor distinto de `none`, y ningún
    `@keyframes`, fuera del bloque `no-preference`;
  - ninguna animación se declara sobre un selector que no esté en el inventario;
  - la caja de scroll declara `scroll-behavior: auto` dentro del bloque `reduce`, y ninguna
    regla del widget la declara `smooth`;
  - el literal `"smooth"` no aparece en `src/` fuera de `src/chat/domain/motion.ts`.
- `test/browser/motion.spec.ts` (**resolución**):
  - con `reducedMotion: "reduce"`, `getComputedStyle(punto).animationName === "none"`;
  - con `reducedMotion: "no-preference"`, `animationName !== "none"` — el **caso positivo**:
    sin él, el test anterior pasaría con un widget sin animación, y un detector que nunca
    falla no protege nada;
  - el scroll no pide `"smooth"` bajo movimiento reducido. Se instrumenta
    `Element.prototype.scrollTo` en la página para registrar el `behavior` de cada llamada, y
    se afirma que ninguna llamada pide `"smooth"`; después se afirma que el hilo queda al
    final.

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/components/Chatbox.css` | Bloque `(prefers-reduced-motion: no-preference)` con la animación; bloque `reduce` recortado (`transition`/`animation` sobre `.chatbox *`, `scroll-behavior: auto` sobre la caja de scroll); `@keyframes`; comentario de cabecera con el orden de capas |
| `src/components/ChatMessages.tsx` | Tres puntos decorativos en la burbuja del asistente vacío; se quita el texto de la burbuja |
| `src/components/Chatbox.tsx` | Un solo camino de scroll, con la regla de `domain/motion.ts` |
| `src/chat/domain/motion.ts` | Nuevo: la query de la preferencia y la regla pura de scroll |
| `test/motion.ts` | Nuevo: inventario, selectores, media queries y verificador del contrato |
| `test/unit/chatbox-motion.test.ts` | Nuevo: mecanismo y guarda |
| `test/unit/chat/domain/motion.test.ts` | Nuevo: la regla pura de scroll, sin DOM |
| `test/browser/motion.spec.ts` | Nuevo: resolución |
| `test/component/chatbox-behavior.test.tsx` | El indicador de escritura: tres puntos decorativos y ningún texto en la burbuja |
| `test/unit/strings-inventory.test.ts` | Lista blanca: `chatbox__typing` y `chatbox__typing-dot`; la consulta de la media query y el literal `smooth` salen del alcance del escáner y pasan a la lista de escapes justificados |
| `TODO.md` | Marcar RF-F44 al cerrar |

## Criterios de aceptación

1. La burbuja del asistente vacío muestra tres puntos y ningún texto; el texto "El asistente
   está escribiendo" aparece **solo** en la región de estado.
   > *Enmienda (RF-F47, 2026-10-23):* la frase aparece **solo en la burbuja** y la región deja
   > de pintarla. La burbuja del asistente vacío muestra los tres puntos y la frase, ambos
   > decorativos; la región la anuncia sin pintarla.
2. Los puntos son decorativos (`aria-hidden`) y la región de estado sigue anunciando el
   aviso de "escribiendo" una sola vez (RF-F41 no se toca).
3. La hoja de estilos declara la animación **dentro** de
   `@media (prefers-reduced-motion: no-preference)`, y ninguna regla declara `animation`,
   `transition` ni `@keyframes` fuera de ese bloque.
4. La caja de scroll declara `scroll-behavior: auto` dentro del bloque `reduce`, y ninguna
   regla del widget la declara `smooth`.
5. El seguimiento del hilo y el salto al final eligen su comportamiento en la misma regla, y
   bajo movimiento reducido ninguno de los dos pide `"smooth"`. *(Enmienda del 2026-10-22: el
   criterio decía «piden el mismo comportamiento» para los dos. El diagnóstico de RF-F06
   mostró que un scroll suave no puede seguir un stream —se reinicia con cada token y nunca
   llega—, así que el seguimiento es instantáneo y el salto es el animado. Ver
   `RF-F06-seguimiento-del-hilo.md`.)*
6. La guarda falla si aparece una fuente de movimiento fuera del inventario, y el test tiene
   una entrada que rechaza de verdad.
7. En Chromium con `reducedMotion: "reduce"`, `animationName` de los puntos es `"none"`; con
   `reducedMotion: "no-preference"`, no lo es.
8. `npm run verify` y `npm run test:browser` en verde.

## Riesgos

- **La guarda puede ser estricta de más**: una animación legítima fuera del bloque rompe la
  compilación. Es el comportamiento buscado, y la salida es mover la animación al bloque, no
  relajar la guarda.
- **Navegadores sin `prefers-reduced-motion`** (Safari < 13, Chrome < 74) no ven la
  animación: la media query no aplica y el bloque `no-preference` tampoco. Es una
  degradación **hacia el lado seguro** (nada se mueve), asumida a conciencia.
- **La resolución en Chromium puede pasar por el motivo equivocado**: si la emulación no
  estuviera activa, el caso negativo ("`animationName` es `none`") pasaría sin comprobar
  nada. El caso positivo lo descarta.
- **Las clases nuevas entran en el escáner de RF-F62**: hay que declararlas en la lista
  blanca o el inventario de textos falla.
- **El literal `"smooth"` ya está en la lista blanca del inventario de RF-F62** (valores de
  scroll y CSSOM): la guarda de movimiento es la que lo prohíbe fuera de la regla.
- **Cambia lo que ve la persona**: la burbuja deja de pintar el texto. Hay que comprobar que
  la región de estado sigue mostrando la frase, para no dejar el aviso solo en un sitio que
  puede quedar fuera de pantalla.

## Fuera de alcance

- **El agrupado de tokens por `requestAnimationFrame` (RF-F11)**: es agrupación de renders,
  no movimiento visible. `prefers-reduced-motion` trata de desplazamientos y animaciones, no
  de frecuencia de actualización. El streaming no cambia.
- La aparición progresiva del texto token a token: el requisito no la nombra.
- Los fixtures de `src/dev/`: no se distribuyen.
- La duplicación visible de la respuesta en la región de estado (RF-F41, §«El texto de la
  región se ve en `.chatbox__status`»): es una observación de RF-F41, no parte de RF-F44.

## Verificación

```bash
npm run verify        # lint + typecheck + build + test -- --run
npm run test:browser  # suite de Playwright (Chromium)
```

Los tests de navegador necesitan Chromium instalado. Es el mismo par de comandos que ejecutan
el hook pre-commit y CI.

## Plan de commits

Cada commit es una unidad de comportamiento con sus tests al lado, para que el repositorio
se entienda y se pueda revertir aplicando solo ese commit.

1. `docs(frontend): spec, decisión y glosario de RF-F44 (movimiento reducido)`
2. `feat(frontend): tres puntos indicadores en la burbuja del asistente (RF-F44)` — markup,
   estilos base de los puntos, test de componente y lista blanca de las clases nuevas.
3. `feat(frontend): regla pura de scroll y camino único de desplazamiento (RF-F44)` — la
   regla de `domain/motion.ts`, el componente que la usa, su test y la lista blanca del
   literal del scroll suave.
4. `style(frontend): la animación solo existe con movimiento permitido (RF-F44)` — las capas
   de movimiento del CSS, el inventario del contrato y la guarda.
5. `test(frontend): resolución de movimiento reducido en Chromium (RF-F44)` — el nivel de
   resolución del contrato completo.
6. `docs(frontend): cerrar RF-F44 en el TODO`

## Glosario

Definido en `GLOSSARY.md` (raíz), sección "Movimiento reducido del widget (RF-F44)": Movimiento
reducido, Indicador de escritura, Contrato de movimiento.

## Referencias

- Requisito: `../../docs/design/SPEC-FRONTEND.md` (RF-F44).
- Decisión: `../../docs/decisions/008-movimiento-reducido.md`.
- Glosario: `../../GLOSSARY.md` (RF-F44).
- Patrones heredados: `../../docs/decisions/002-css-theming-test-strategy.md`,
  `../../docs/decisions/006-contrato-y-verificacion-de-contraste.md`,
  `../../docs/decisions/007-objetivos-tactiles.md`.
- Diseño de referencia: `../../docs/design/stitch_portfolio_ai_chat_widget_ui/widget_lab_desktop_embedded_chat/code.html`
  (tres puntos con `animate-bounce` y retardos 0/150/300 ms).
- Issue: #100.
