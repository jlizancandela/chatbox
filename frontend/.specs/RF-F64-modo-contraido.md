# RF-F64 — Variante flotante contraída del chatbox

> Convención del proyecto: un spec por RF en `.specs/`, decisiones de proceso en
> `docs/decisions/` de la raíz, glosario en `GLOSSARY.md` de la raíz.
>
> Spec del 2026-10-28. Issue: #127.

## Requisito

> RF-F64 | El widget tendrá una variante flotante anclada a la esquina inferior derecha de la
> pantalla, con dos estados: contraído —un lanzador circular de 56×56 que abre el chat— y
> expandido —el panel completo—. Contraer no interrumpe el turno ni borra la
> conversación. | I |

Este RF cierra la decisión abierta §12.2 de `docs/stitch-frontend-design/SPEC-FRONTEND.md`
—«embebido en una sección o botón flotante»— y da forma al «Modo Burbuja Flotante» que
Stitch describe en `prd_widget_asistente_de_jorge.md:42-53`.

## Decisiones

- **D1 — Alcance del trabajo**: el widget **gana una variante**; la variante embebida no
  cambia. Ni una prop, ni una clase, ni un test existente se rompen: el widget embebido es
  lo que entrega el sitio host hoy, y el círculo en la esquina solo tiene esquina si el
  widget está anclado a la ventana.
- **D2 — La variante se elige con una prop**: `variant="embedded" | "floating"`, por defecto
  `"embedded"`. El nombre es el del glosario: el widget tiene *variantes*, no *modos*.
- **D3 — El estado inicial es otra prop**: `initiallyCollapsed`, por defecto `true` en la
  variante flotante e ignorada en la embebida —que no tiene estado contraído—. Dos props en
  lugar de una: una variante flotante que nace abierta taparía la página sin motivo, y una
  embebida que pudiera contraerse dejaría el hueco del panel en el flujo del host.
- **D4 — El estado es interno, no controlado**: el widget no expone `collapsed` ni
  `onCollapsedChange`. El sitio host es una isla de Astro estático y no puede sostener el
  estado de una isla `client:idle` sin meter framework. El control externo se puede añadir
  después como una prop más, sin romper nada; un estado controlado desde el principio
  obligaría al host a gestionarlo siempre.
- **D5 — El estado no se persiste**: es presentación, no dato. El sitio host decide con
  `initiallyCollapsed` según su propia lógica. El widget ya persiste **la conversación** en
  `sessionStorage` (RF-F24); persistir también la ventana abriría la pregunta de por qué un
  sitio recuerda que dejaste el chat abierto pero no lo que escribiste.
- **D6 — El lanzador vive dentro de la raíz `.chatbox`**: la raíz del escaneo de axe es
  fija —`test/axe.ts:47` la busca con `document.querySelector(".chatbox")`—, así que un
  lanzador fuera de la raíz haría que el test de accesibilidad pasara **en falso**.
- **D7 — Una raíz, dos presentaciones**: no hay una segunda raíz. RF-F45 exige un único
  elemento con `class="chatbox"` en todo `src/` (`test/accessible-names.ts:202-228`), y el
  estado contraído lo que cambia es lo que la raíz **contiene**, no quién es la raíz.
- **D8 — `aria-labelledby` es condicional**: contraído no hay título, y un
  `aria-labelledby` que apunta a un id inexistente es una violación de axe. En el estado
  contraído la raíz no se nombra.
- **D9 — La región de estado se monta siempre**: es el único elemento con `role="status"`,
  y si se desmontara al contraerse, el anuncio de un turno que termina mientras el widget
  está contraído se perdería. Contraída queda **visualmente oculta** con el mismo patrón
  que `.chatbox__status--announced` —`position: absolute` y `clip-path`—, nunca con
  `display: none`: fuera del árbol de accesibilidad el anuncio no se oye.
- **D10 — El panel no se extrae a otro componente**: los hooks (`useChat`,
  `useChatStream`), el borrador de la pregunta y la conversación viven en `Chatbox`, así que
  **sobreviven a la contracción**. Contraer no es detener: el stream sigue, el hilo sigue y
  el anuncio del turno se conserva. Extraer el panel a un componente propio movería ~250
  líneas y rompería el patrón de foco al montar del repositorio.
- **D11 — La geometría del panel es una sola regla**: `width: min(100% - 2rem, 380px)` y
  `height: min(100dvh - 2rem, 640px)`. En el teléfono sale casi a pantalla completa; en el
  escritorio, una tarjeta. Sin media query: dos declaraciones y cada contexto sale como le
  corresponde. Un cajón a pantalla completa taparía la página entera en el escritorio, y una
  tarjeta de tamaño fijo sería inservible en el móvil con el teclado abierto.
- **D12 — El anclaje**: abajo a la derecha, con la safe area **sumada** al margen y nunca
  sustituida (RF-F50). El margen es `max(1rem, env(safe-area-inset-*))`.
- **D13 — El estado contraído es la raíz**: la raíz pasa a medir 56×56, con `border-radius`
  de círculo y el color primario de fondo. El botón del lanzador la llena entera, así que
  el objetivo táctil es el círculo y no un botón dentro de un círculo.
- **D14 — El ícono es un SVG inline**: el widget no puede meter una webfont —no controla la
  página que lo aloja— y Material Symbols sería una. El SVG usa `currentColor`, así que
  hereda el color del texto y no introduce tokens nuevos. Sus valores técnicos entran en la
  lista blanca del inventario de textos (RF-F62), que es donde viven los valores técnicos.
- **D15 — Los dos botones son solo-icono y declaran su nombre**: el lanzador («Abrir el
  asistente de Jorge») y el botón de la cabecera («Contraer el chat»), los dos con
  `aria-label` desde `strings.es.ts` (RF-F45, R3).
- **D16 — Se contrae con un botón o con `Esc`**: el botón de la cabecera es un control
  visible —no se depende de adivinar un gesto— y `Esc` es el atajo estándar de un cajón.
  **No** se cierra con click fuera: durante la lectura o al seleccionar texto cerraría el
  panel. **Pero `Esc` hace lo más urgente**: mientras hay un turno en marcha aborta la
  respuesta (RF-F05) y no contrae nada; para recoger el widget está el botón de la
  cabecera, que está siempre.
- **D17 — El foco va al campo al abrir y vuelve al lanzador al cerrar**: el lanzador se
  desmonta al expandirse, así que sin devolver el foco, este se perdería en el `body`. El
  foco se mueve con un **ref callback**, no con un efecto: un efecto pendiente podría
  robarlo tras un clic rápido. Es el patrón de `NewConversation.tsx:20-28`.
- **D18 — Sin animación**: abrir y cerrar no se mueven. La guarda de movimiento (RF-F44)
  rechaza cualquier `transition` fuera del bloque `prefers-reduced-motion: no-preference`, y
  el inventario de fuentes de movimiento no cambia.
- **D19 — La franja del teclado se aplica sola**: es geométrica (ADR 011, D5). Un panel
  anclado abajo es el que el navegador no puede desplazar al enfocar el campo, así que es
  el que reserva; la franja que reserva es la que tapa el teclado menos la separación con
  el borde, y su pie queda justo en el borde de la zona visible.
- **D20 — El teclado virtual en la variante flotante necesita su propio escenario**: el
  existente (`test/browser/virtual-keyboard.spec.ts`) asume el widget embebido a pantalla
  completa, donde la franja es la del teclado entero. En la variante flotante la reserva es
  el teclado menos los 16 px de separación.
- **D21 — La variante y el estado van en atributos de datos**: `data-variant` y
  `data-state` en la raíz, no clases modificadoras. La raíz tiene que conservar su clase
  como **literal** —`class="chatbox"`— porque el contrato de nombres accesibles (RF-F45)
  identifica la raíz por esa clase (`test/accessible-names.ts:202-228`): una clase
  compuesta o dinámica rompe la guarda. Los selectores siguen empezando por `.chatbox`,
  que es lo que exige la guarda de estilos acotados (RF-F63), y la guarda de RF-F51 sigue
  reconociendo las reglas que alcanzan la raíz —su último compuesto vuelve a ser
  `.chatbox`—.
- **D22 — La regla flotante no redeclara el padding inferior**: la franja del teclado la
  declara solo la raíz (`.chatbox { padding-bottom: var(--chatbox-keyboard-inset, 0px) }`) y
  la guarda de RF-F51 vigila que ninguna regla que alcance la raíz la redeclare, ni con
  `padding` ni con `padding-block-end`.
- **D23 — La página de desarrollo lee la URL**: `?widget=floating` monta la variante
  flotante; por defecto sigue embebida. Es el cambio más chico que deja el lanzador
  alcanzable desde la suite de navegador sin tocar los specs existentes.
- **D24 — Glosario**: entran *variante del widget*, *estado contraído*, *estado expandido*,
  *lanzador*, *contraer* y *anclaje del panel*.
- **D25 — Identificadores**: RF-F64. `RF-F63` ya se usa como etiqueta interna de estilos en
  `test/unit/chatbox-scoped-styles.test.ts:21` **sin existir en el spec**: reutilizarlo
  crearía dos cosas distintas con el mismo nombre.
- **D26 — Los paquetes que renderizan con React se empaquetan en las pruebas**: en vitest,
  `react-markdown` se externalizaba, y sus imports de `react/jsx-runtime` esquivaban el
  alias de `vitest.config.ts` y llegaban al **React real** (19.3, instalado como *peer* de
  `react-markdown`). Sus elementos vienen congelados y Preact no puede diffearlos: montar
  de nuevo el subárbol del markdown —que hace RF-F64 cada vez que el panel se abre— falla
  con «Cannot add property __, object is not extensible». El fallo era **preexistente**:
  «Nueva conversación» y volver a preguntar montaba el markdown otra vez y ya lo
  provocaba. La corrección es `test.server.deps.inline` para `react-markdown` y
  `hast-util-to-jsx-runtime`, para que pasen por Vite y el alias se aplique. En el
  navegador no pasa: allí los empaqueta el mismo Vite.

## Auditoría (por qué no es un retoque de CSS)

| Hecho | Consecuencia |
|---|---|
| `.chatbox` es `height: 100%`: la altura la da el host | Un círculo dentro del flujo del host quedaría en medio de la página, y el host seguiría reservando su espacio |
| La raíz del escaneo de axe es fija (`test/axe.ts:47`) | Un lanzador fuera de `.chatbox` hace que el test de accesibilidad pase en falso |
| RF-F45 exige una única raíz `class="chatbox"` | La variante no puede tener una raíz propia |
| La guarda de estilos acotados acepta solo selectores que empiezan por `.chatbox` | La variante y el estado tienen que ir en atributos de datos o en clases compuestas, no en una clase suelta |
| RF-F45 identifica la raíz por la clase literal `chatbox` | La raíz no puede llevar una clase compuesta ni dinámica: la variante y el estado van en atributos de datos |
| La guarda de RF-F51 vigila el padding de la raíz | La regla flotante no puede declarar `padding-bottom` |
| La guarda de movimiento rechaza toda `transition` fuera del bloque `no-preference` | Abrir y cerrar no se animan, o el inventario de RF-F44 cambia |
| `useFocusOnMount` enfoca con deps `[]` | No vuelve a dispararse cuando el textarea aparece más tarde: el foco al abrir necesita su propio mecanismo |

## Diseño

### API

```ts
export type ChatboxProps = {
	apiUrl: string;
	suggestions?: string[];
	contactUrl?: string;
	title?: string;
	/** Variante del widget: embebida en el flujo del host o flotante anclada a la pantalla. */
	variant?: "embedded" | "floating";
	/** Si el widget arranca contraído. Solo aplica a la variante flotante. */
	initiallyCollapsed?: boolean;
};
```

El nombre público del componente no cambia: sigue siendo `<Chatbox>`.

### DOM: una raíz, dos presentaciones

```text
estado contraído                             estado expandido
<section class="chatbox" data-state="collapsed" data-variant="floating">
                                            <header class="chatbox__header"> … </header>
  <div role="status" …>                      <div role="status" …>
  <button class="chatbox__launcher">…</button>  <main class="chatbox__conversation"> … </main>
                                            <footer class="chatbox__footer"> … </footer>
</section>
```

La región de estado se monta en los dos estados; en el contraído la oculta el CSS.

### CSS

```css
.chatbox[data-variant="floating"] {
	position: fixed;
	right: max(1rem, env(safe-area-inset-right, 0px));
	bottom: max(1rem, env(safe-area-inset-bottom, 0px));
	width: min(100% - 2rem, 380px);
	height: min(100dvh - 2rem, 640px);
	border-radius: 1rem;
	z-index: 50;
}

.chatbox[data-state="collapsed"] {
	width: 56px;
	height: 56px;
	border-radius: 9999px;
	background-color: var(--chatbox-color-primary);
	color: var(--chatbox-color-surface);
}
```

`100%` y no `100vw`: el bloque contenedor inicial de un elemento fijo no incluye la barra
de desplazamiento, y con `100vw` la tarjeta se saldría por debajo de ella.

### Contratos

| Contrato | Fichero | Qué se amplía |
|---|---|---|
| Objetivos táctiles (RF-F43) | `test/touch-targets.ts` | Estado `contraído`; controles `launcher` y `collapse` |
| Nombres accesibles (RF-F45) | `test/accessible-names.ts` | Estado `contraído` en `NAME_STATES`, y su escenario en el spec de navegador |
| axe (RF-F41) | `test/browser/accessibility.spec.ts` | Estado `contraído` en `ESTADOS`: de ocho a nueve |
| Textos (RF-F62) | `test/unit/strings-inventory.test.ts` | Clases nuevas y valores técnicos del SVG |
| Teclado virtual (RF-F51) | `test/browser/virtual-keyboard.spec.ts` | Escenario de la variante flotante |

## Archivos afectados

| Fichero | Cambio |
|---|---|
| `src/components/Chatbox.tsx` | Props `variant` e `initiallyCollapsed`; estado contraído; render condicional; `Esc`; foco |
| `src/components/ChatLauncher.tsx` | Nuevo: el lanzador |
| `src/components/ChatHeader.tsx` | Prop opcional `onCollapse`: el botón de contraer |
| `src/components/Chatbox.css` | Reglas de la variante flotante y del estado contraído |
| `src/chat/hooks/useFocusOnMount.ts` | Segundo parámetro `enabled`: el foco al expandirse |
| `src/strings.es.ts` | `launcher.open.ariaLabel` y `actions.collapse.ariaLabel` |
| `vitest.config.ts` | `server.deps.inline` para los paquetes que renderizan con React (D26) |
| `src/App.tsx` | `?widget=floating` |
| `test/component/chatbox-collapsed.test.tsx` | Nuevo: el comportamiento en jsdom |
| `test/browser/floating-launcher.spec.ts` | Nuevo: la resolución en Chromium |
| `test/touch-targets.ts`, `test/accessible-names.ts` | Estados y controles nuevos |
| `test/browser/accessibility.spec.ts`, `test/browser/accessible-names.spec.ts`, `test/browser/touch-targets.spec.ts`, `test/browser/virtual-keyboard.spec.ts` | Escenarios nuevos |
| `test/unit/strings-inventory.test.ts` | Lista blanca |
| `GLOSSARY.md`, `docs/stitch-frontend-design/SPEC-FRONTEND.md` | Vocabulario y requisito |
| `TODO.md`, `AGENTS.md` | Estado del MVP y el número de estados de axe |

## Criterios de aceptación

1. La variante embebida no cambia: mismas props, mismo comportamiento, mismos tests.
2. `variant="floating"` monta el widget anclado abajo a la derecha, con el panel de
   `min(100% - 2rem, 380px)` × `min(100dvh - 2rem, 640px)`.
3. El widget nace contraído en la variante flotante, y `initiallyCollapsed={false}` lo
   hace nacer expandido.
4. En el estado contraído solo se ve el lanzador, y el lanzador abre el panel.
5. El panel se contrae con el botón de la cabecera y con `Esc`.
6. Al abrir, el foco está en el campo de texto; al cerrar, vuelve al lanzador.
7. Contraer no interrumpe el turno: el stream sigue, la conversación y el borrador se
   conservan, y el anuncio del turno se conserva.
8. El lanzador y el botón de contraer tienen nombre accesible y miden al menos 44×44 px.
9. El estado contraído pasa la pasada de axe en claro y en oscuro, y el widget entero
   también.
10. Con el teclado virtual simulado, el pie del panel flotante queda en el borde de la zona
    visible.
11. `npm run verify` y `npm run test:browser` en verde.

## Riesgos

- **La variante flotante rompe la página que la aloja**: es un `position: fixed` con
  `z-index: 50`. Mitigación: es opt-in; el sitio host decide.
- **El teclado virtual en la variante flotante queda sin verificar** si no se escribe su
  escenario: el existente asume el widget embebido a pantalla completa. Mitigación: D20.
- **El foco se pierde al cerrar** si el lanzador se desmonta de otra manera: ningún
  contrato lo vigila. Mitigación: un aserto explícito de `document.activeElement` en el
  test de componente.
- **El estado contraído es un hueco en el flujo** para quien use la variante embebida: por
  eso la embebida no tiene estado contraído.
- **jsdom no mide**: todo lo que sea tamaño real es trabajo del nivel de Chromium.

## Fuera de alcance

- Teaser proactivo, auto-apertura por inactividad y pip de «disponible en vivo» (Stitch).
- Animación de apertura y cierre.
- Cerrar con click fuera.
- Persistencia del estado entre visitas.
- API imperativa para que otro elemento del sitio abra el chat.
- Avatar de Jorge en el lanzador.

## Verificación

```bash
npm run verify        # lint + typecheck + build + test -- --run
npm run test:browser  # suite de Playwright (Chromium)
```

Los tests de navegador necesitan Chromium instalado. Es el mismo par de comandos que ejecutan
el hook pre-commit y CI.

## Referencias

- Requisito: `../../docs/stitch-frontend-design/SPEC-FRONTEND.md` (RF-F64, §12.2).
- Glosario: `../../GLOSSARY.md` (RF-F64).
- Diseño de referencia: `../../docs/stitch-frontend-design/stitch_portfolio_ai_chat_widget_ui/prd_widget_asistente_de_jorge.md`
  (FR-02, Modo Burbuja Flotante) y `.../widget_lab_modo_burbuja_floating_launcher/code.html`.
- Decisión heredada: `../../docs/decisions/011-teclado-virtual.md` (la variante flotante es
  el caso «panel anclado por su borde inferior» que la decisión anticipa).
- Issue: #127.
