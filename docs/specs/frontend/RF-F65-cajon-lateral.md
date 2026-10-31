# RF-F65 — Variante cajón del chatbox

> Convención del proyecto: un spec por RF en `docs/specs/frontend/`, decisiones de proceso en
> `docs/decisions/` de la raíz, glosario en `GLOSSARY.md` de la raíz.
>
> Spec del 2026-10-31. Issue: #162.

## Requisito

> RF-F65 | El widget tendrá una variante cajón: un panel de altura completa pegado al borde
> derecho de la pantalla, que se superpone a la página sin empujarla. Nace contraído —un
> lanzador circular de 56×56 en la esquina inferior derecha— y se abre como panel. Contraer no
> interrumpe el turno ni borra la conversación. | I |

Este RF añade la **tercera** forma del widget, al lado de la embebida y la flotante de RF-F64:
el panel de chat que se abre desde el borde derecho de la pantalla, como el de una tienda
online.

## Decisiones

- **D1 — Es una variante, no un cambio de la flotante**: la tarjeta flotante de RF-F64 ya
  está mergeada y es la que el sitio monta por defecto (PR #131). El cajón entra **al lado**:
  `variant="drawer"`. Ni una prop, ni una clase, ni un test de las variantes existentes se
  rompen.
- **D2 — El nombre**: `drawer` en el código y «cajón lateral» en el glosario. *Sidebar*
  evoca una columna permanente —que es la variante embebida— y *drawer* evoca el panel que
  sale del borde. El widget tiene **variantes**, no modos (RF-F64, D2): no hay un «modo cajón».
- **D3 — Se superpone y no empuja**: el widget es una isla dentro del sitio host y no conoce
  su layout. Empujar el contenido exigiría tocar el DOM del host —mutarlo desde el widget—,
  que es justo el acoplamiento que este repositorio evita. El panel se superpone y el sitio
  conserva su geometría. El panel de una tienda online tampoco empuja.
- **D4 — No es modal**: sin scrim, sin `aria-modal` y sin trampa de foco. La página sigue
  viva detrás y quien está en el chat puede seguir usando el sitio. Un scrim que atenúa la
  página sin atrapar el foco es peor que no tener scrim: promete una exclusividad que no
  existe.
- **D5 — Sin animación**: la guarda de movimiento (RF-F44) rechaza toda `transition` fuera
  del bloque `prefers-reduced-motion: no-preference`, y RF-F64 ya decidió que abrir y cerrar
  no se mueven. El cajón aparece y desaparece.
- **D6 — La geometría es una regla**: `top: 0`, `right: 0`, `width: min(100%, 460px)` y
  `height: 100dvh`. `dvh` y no `vh` porque la unidad acompaña a la barra del navegador
  (RF-F50); `100%` y no `100vw` porque el bloque contenedor inicial de un elemento fijo no
  incluye la barra de desplazamiento. El ancho máximo es un tercio de una pantalla de
  escritorio: más ancho que la tarjeta flotante —que son 380 px— porque el cajón tiene que
  dar cabida a la transcripción y a las fuentes, y más estrecho que la pantalla porque la
  página tiene que seguir siendo legible al lado.
- **D7 — Contraído, el lanzador vuelve a la esquina**: la regla de la variante ancla el
  panel arriba y a la derecha, así que el estado contraído necesita su propia regla
  compuesta —`.chatbox[data-variant="drawer"][data-state="collapsed"]`— que deshace el
  anclaje y devuelve el círculo al de la variante flotante: abajo a la derecha, con la safe
  area **sumada** al margen (RF-F50). El tamaño, el fondo y la sombra los declara la regla
  genérica del estado contraído, que va después.
- **D8 — La franja del teclado la hereda**: la reserva la declara la raíz
  (`padding-bottom: var(--chatbox-keyboard-inset, 0px)`) y la regla de la variante **no**
  puede declarar `padding-bottom`: dos reglas que lo declaran, y la última gana, y la
  franja se queda en cero (guarda de RF-F51). El cajón, que llega al borde inferior de la
  pantalla, reserva el teclado **entero** —la tarjeta flotante reserva el teclado menos los
  16 px de su separación con el borde—.
- **D9 — El defecto sigue siendo la flotante**: cambiarlo alteraría la apariencia del sitio
  sin que nadie lo pida. El cajón es opt-in: `variant="drawer"`.
- **D10 — `?widget=drawer` en la página de desarrollo**: es lo que permite que la suite de
  navegador lo monte y lo mida sin tocar los escenarios existentes.
- **D11 — El custom element admite el atributo**: `variant="drawer"` deja de ignorarse en
  silencio; la lista de valores admitidos es cerrada y hay que ampliarla.
- **D12 — Los contratos que cambian y los que no**: la pasada de axe **suma un estado** —el
  cajón expandido—, porque su geometría es nueva aunque su árbol de accesibilidad sea el
  del widget abierto. Los nombres accesibles y los objetivos táctiles **no** cambian: el DOM
  del widget es el mismo en las tres variantes, y el inventario de controles ya declara el
  lanzador y el botón de contraer.
- **D13 — El texto de una respuesta vive en dos sitios**: en la burbuja y en la región de
  estado, que la anuncia (RF-F41). Un aserto que lo busca en toda la página lo encuentra
  dos veces, y cuál de las dos responde depende de cuándo se cargue el markdown diferido
  (RF-F30). Los asertos van acotados al hilo.

## Auditoría (por qué no es un retoque de CSS)

| Hecho | Consecuencia |
|---|---|
| La raíz tiene que conservar su clase literal `chatbox` (RF-F45) | La variante y el estado van en atributos de datos, no en clases |
| La guarda de estilos acotados acepta selectores que empiezan por `.chatbox` | `.chatbox[data-variant="drawer"]` vale; una clase modificadora no |
| La guarda de RF-F51 vigila el `padding-bottom` de la raíz | La regla de la variante no puede declararlo |
| La guarda de viewport exige `dvh` y rechaza `vh`/`lvh`/`svh` | La altura se declara con `100dvh` |
| La guarda de movimiento rechaza toda `transition` fuera del bloque `no-preference` | El cajón no se desliza |
| La raíz del escaneo de axe es fija (`test/axe.ts:47`) | El cajón se monta dentro de `.chatbox`, no con otra raíz |
| El widget es una isla: no conoce el layout del host | El panel se superpone; empujar el contenido del host queda fuera de alcance |

## Diseño

### API

```ts
export type ChatboxProps = {
	apiUrl: string;
	suggestions?: string[];
	contactUrl?: string;
	title?: string;
	/** Variante del widget: embebida, flotante o cajón. */
	variant?: "embedded" | "floating" | "drawer";
	/** Si el widget arranca contraído. Solo aplica a las variantes superpuestas. */
	initiallyCollapsed?: boolean;
};
```

El nombre público del componente no cambia: sigue siendo `<Chatbox>`.

### DOM: una raíz, tres presentaciones

El DOM es **el mismo** en las tres variantes. Lo que cambia es `data-variant` en la raíz y el
CSS que la aplica:

```text
variante embebida              variante flotante            variante cajón
<section class="chatbox">      <section class="chatbox"     <section class="chatbox"
                                  data-variant="floating">     data-variant="drawer">
```

Contraído, las dos variantes superpuestas montan el mismo lanzador.

### CSS

```css
.chatbox[data-variant="drawer"] {
	position: fixed;
	top: 0;
	right: 0;
	width: min(100%, 460px);
	height: 100dvh;
	box-shadow: -8px 0 24px rgb(0 0 0 / 0.16);
	z-index: 50;
}

.chatbox[data-variant="drawer"][data-state="collapsed"] {
	top: auto;
	right: max(1rem, env(safe-area-inset-right, 0px));
	bottom: max(1rem, env(safe-area-inset-bottom, 0px));
}
```

La regla de la variante va **antes** de la del estado contraído: contraído, el círculo es el
de la variante flotante —56×56, su fondo y su sombra—, y esa regla viene después. Es el mismo
mecanismo que usa la variante flotante.

## Archivos afectados

| Fichero | Cambio |
|---|---|
| `src/components/Chatbox.tsx` | Variante `drawer`; el estado contraído pasa a ser de las variantes superpuestas |
| `src/components/Chatbox.css` | Reglas de la variante y del estado contraído del cajón |
| `src/element.ts` | `variant="drawer"` entre los valores admitidos |
| `src/App.tsx` | `?widget=drawer` |
| `test/unit/strings-inventory.test.ts` | `drawer` en la lista blanca de valores de la variante |
| `test/component/chatbox-drawer.test.tsx` | Nuevo: el comportamiento en jsdom |
| `test/browser/drawer.spec.ts` | Nuevo: la geometría en Chromium |
| `test/browser/accessibility.spec.ts` | Estado `cajón expandido` en la pasada de axe |
| `test/browser/touch-targets.spec.ts` | Escenario del botón de contraer en el cajón |
| `test/browser/virtual-keyboard.spec.ts` | Escenarios de la franja del teclado en el cajón |
| `test/component/chatbox-collapsed.test.tsx` | Aserto acotado al hilo (D13) |
| `GLOSSARY.md`, `docs/design/SPEC-FRONTEND.md` | Vocabulario y requisito |
| `frontend/TODO.md`, `frontend/AGENTS.md` | Estado del MVP y el número de estados de axe |

## Criterios de aceptación

1. `variant="drawer"` monta un panel pegado al borde derecho, de altura completa, con el
   ancho máximo declarado.
2. En una pantalla más estrecha que el ancho declarado, el panel ocupa la pantalla entera y
   no se sale.
3. El widget nace contraído —lanzador en la esquina inferior derecha, de 56×56— y
   `initiallyCollapsed={false}` lo hace nacer expandido.
4. El botón de la cabecera contrae el panel y `Esc` también; al cerrar, el foco vuelve al
   lanzador.
5. Contraer no interrumpe el turno ni borra la conversación ni el borrador.
6. La variante embebida no cambia: mismas props, mismo comportamiento, mismos tests.
7. Con el teclado virtual simulado, el pie del cajón queda en el borde de la zona visible y
   la franja reservada es la del teclado entera.
8. El cajón expandido pasa la pasada de axe en claro y en oscuro.
9. Los controles del cajón alcanzan el suelo táctil de 44 px.
10. `npm run verify` y `npm run test:browser` en verde.

## Riesgos

- **El cajón tapa el contenido del sitio host**: en una pantalla estrecha ocupa el ancho
  entero. Es lo que hace un panel lateral, y es opt-in: el sitio decide.
- **El contenido que queda detrás sigue siendo tabulable**: el panel no es modal. Es el
  mismo comportamiento que la tarjeta flotante de RF-F64, que en un móvil ocupa casi toda
  la pantalla; no es una regresión, pero en el cajón se nota más.
- **El `z-index: 50` puede quedar por debajo de un header pegajoso del sitio host**: el
  widget no ve el contexto de apilamiento de quien lo aloja. Mitigación: es el mismo valor
  que usa la variante flotante; si el sitio necesita más, puede subirlo en su CSS.
- **El ancho de 460 px es una decisión de gusto**: el criterio es que el panel dé cabida a
  la transcripción sin comerse la pantalla. Si en el sitio se ve corto, el número se cambia
  en una regla.

## Fuera de alcance

- Que el panel empuje el contenido del sitio host.
- Scrim, foco atrapado y `aria-modal`.
- Animación de apertura y cierre.
- Cerrar con click fuera.
- Cambiar el defecto del widget.
- Persistencia del estado entre visitas.
- Un ancho proporcional al viewport en pantallas anchas.

## Verificación

```bash
npm run verify        # lint + typecheck + build + test -- --run
npm run test:browser  # suite de Playwright (Chromium)
```

Los tests de navegador necesitan Chromium instalado. Es el mismo par de comandos que ejecutan
el hook pre-commit y CI.

## Referencias

- Requisito: `../../docs/design/SPEC-FRONTEND.md` (RF-F65).
- Glosario: `../../GLOSSARY.md` (RF-F65).
- Decisión heredada: `RF-F64-modo-contraido.md` (variantes y estados del widget).
- Decisión heredada: `../../docs/decisions/011-teclado-virtual.md` (la franja que reserva la
  raíz).
- Issue: #162.
