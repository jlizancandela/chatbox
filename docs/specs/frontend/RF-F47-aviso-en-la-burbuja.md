# RF-F47 — El aviso de escritura vive dentro del bocadillo

> Convención del proyecto: un spec por RF en `docs/specs/frontend/`, decisiones de proceso en
> `docs/decisions/` de la raíz, glosario en `GLOSSARY.md` de la raíz.
>
> Enmienda de RF-F41 y RF-F44: el aviso «El asistente está escribiendo» deja de pintarse en la
> región de estado y se pinta dentro del bocadillo del asistente. Issue: #106.

## Síntesis (decisiones acordadas, 2026-10-23)

- **D1 — El aviso visible vive en el bocadillo.** Mientras el turno está en marcha y la burbuja
  todavía no tiene texto, el bocadillo del asistente muestra «El asistente está escribiendo»
  junto a los tres puntos: el mismo sitio donde aparecerá la respuesta.
- **D2 — La copia visible es decorativa** (`aria-hidden="true"`), igual que los puntos. La
  región de estado sigue siendo la única que anuncia: el texto visible y el texto oído son el
  mismo string, pero solo el de la región está en el árbol de accesibilidad. No se duplica texto
  visible y audible.
- **D3 — La región anuncia siempre y pinta solo lo que la conversación no muestra.** Es la regla
  de RF-F46, ampliada: ahora el aviso «escribiendo» también está en la conversación, así que la
  región lo anuncia y no lo pinta. El error y el aviso de turno detenido no están en ningún otro
  sitio: esos sí se pintan.
- **D4 — El aviso desaparece cuando llega el primer token.** La respuesta que llega ya se ve en
  la burbuja; el aviso solo ocupa el estado «todavía no ha dicho nada». Si el turno cierra sin
  respuesta no hay aviso: hay un desenlace (RF-F41).
- **D5 — El texto no cambia.** Se sigue usando `strings.messages.writing`, el mismo string que
  la región anuncia: lo que se ve y lo que se oye son las mismas palabras, y la referencia para
  contrastar lo que se oye sigue siendo la burbuja (RF-F46, D5). Acortar el texto («Escribiendo…»)
  cambiaría lo que oye quien usa lector de pantalla y no aporta nada a este cambio de sitio.
- **D6 — El aviso se pinta con el color heredado de la burbuja.** No entra ningún token nuevo en
  la tabla de contraste (RF-F42).

## Specs

- **S1 — «El mensaje de esta escribiendo, debería de verse dentro del bocadillo no arriba en la
  esquina superior.»** (petición de Jorge, 2026-10-23; textual)
  - Alcance: el aviso visible del turno en curso se pinta dentro del bocadillo del asistente y
    la región de estado deja de pintarlo.
  - Criterio: durante el turno, `strings.messages.writing` se ve dentro de
    `.chatbox__message--assistant` y la región `.chatbox__status` **no lo pinta**: su
    texto sigue ahí —para que se anuncie—, pero su caja es de 1×1 px.
  - Comprobación: test de navegador (nivel 2) y test de componente (nivel 1).
- **S2 — La región sigue anunciando lo mismo.**
  - Alcance: la región conserva rol, atributos y contenido; lo único que cambia es si se pinta.
  - Criterio: `.chatbox__status` **contiene** el aviso durante el turno (es lo que se
    anuncia) y sigue en el árbol de accesibilidad, aunque no lo pinte.
  - Comprobación: test de componente (el texto) + test de navegador (el árbol de accesibilidad).
- **S3 — La copia visible es decorativa.**
  - Alcance: la copia del bocadillo lleva `aria-hidden="true"`.
  - Criterio: el texto visible no aparece en el árbol de accesibilidad del bocadillo.
  - Comprobación: test de navegador (aria snapshot del bocadillo).
- **S4 — No cambia lo que se oye.**
  - Alcance: el mismo string, en el mismo momento, por la misma región.
  - Criterio: la secuencia de textos de la región (`"", "escribiendo", respuesta`) no cambia.
  - Comprobación: test de componente existente (`chatbox-region.test.tsx`).
- **S5 — El error y el aviso de parada se siguen viendo.**
  - Alcance: la región los pinta, porque no están en ningún otro sitio.
  - Criterio: sin cambio respecto a RF-F46.
  - Comprobación: test de navegador existente («el error se sigue viendo en la región»).

## Diseño

- `src/components/ChatMessages.tsx`: la burbuja en curso (la última, y solo mientras el turno
  está en marcha) muestra el aviso junto a los puntos, dentro de un `<span aria-hidden>`.
- `src/components/Chatbox.tsx`: la clase de la región pasa a depender también de `isBusy`: con
  el turno en marcha, el texto de la región es el aviso, que ya está en la conversación, así que
  la región lo anuncia y no lo pinta.
- `src/components/Chatbox.css`: `.chatbox__writing` (separación entre el texto y los puntos).

La ocultación de la región sigue siendo el patrón de «visualmente oculto» de RF-F46: `display:
none` y `visibility: hidden` la sacarían del árbol de accesibilidad y el anuncio no se oiría.

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/components/ChatMessages.tsx` | El aviso visible entra en el bocadillo |
| `src/components/Chatbox.tsx` | La región deja de pintar el aviso «escribiendo» |
| `src/components/Chatbox.css` | `.chatbox__writing` |
| `test/component/chatbox-behavior.test.tsx` | «leaves the writing notice only in the status region» fija lo contrario: se reescribe con el contrato nuevo |
| `test/browser/live-region.spec.ts` | Test nuevo: el aviso se ve en el bocadillo, la región lo anuncia sin pintarlo. Retiene la respuesta con una puerta que abre el test, no con un retardo fijo |
| `test/browser/scroll-follow.spec.ts` | La precondición de RF-F06: la respuesta tiene que desbordar el hilo antes de apartarse de él (ver «Riesgos») |
| `test/unit/strings-inventory.test.ts` | Lista blanca: `chatbox__writing` |
| `docs/specs/frontend/RF-F41-region-estado.md` | Enmienda: la región no pinta el aviso; la referencia manual es la burbuja |
| `docs/specs/frontend/RF-F44-movimiento-reducido.md` | Enmienda: D3 y el criterio 1 quedan invertidos |
| `docs/specs/frontend/RF-F46-respuesta-una-vez.md` | Enmienda: D2 y el criterio 2 (la región deja de pintar el aviso) |
| `../../GLOSSARY.md` | «Región de estado» (enmienda) y «Aviso de escritura» (entrada nueva) |
| `TODO.md` | RF-F47 |

## Riesgos

- **La copia visible es decorativa**: quien usa lector de pantalla no encuentra el aviso al
  navegar la conversación, pero lo oye anunciado por la región. Es el mismo trato que los tres
  puntos (RF-F44) y el mismo texto en los dos sitios.
- **El aviso desaparece al llegar el primer token**: durante el resto del turno el indicio es
  el texto que llega. La región sigue anunciando el aviso una vez, al inicio del turno.
- **La región colapsa durante el turno**: pasa a 1×1 px (patrón de «visualmente oculto»). El
  salto es el mismo que ya introdujo RF-F46 y menor que el que había cuando la región pintaba
  la respuesta entera.
- **Verificación manual**: el aviso ahora se ve dentro del bocadillo y la región no lo pinta. La
  pasada de NVDA/VoiceOver tiene que confirmar que el aviso **se sigue oyendo** con la región
  oculta: es el único nivel que verifica que hay sonido (ADR 005). La checklist queda en la
  issue #106.
  > *Enmienda (2026-10-26, issue #113):* ese nivel manual se retiró: nunca se ejecutó y lo
  > que añadía era la fonética, que no es un contrato del widget. El cierre de la RF es la
  > pasada automática con axe.

## Verificación

```bash
npm run verify        # lint + typecheck + build + test -- --run
npm run test:browser  # suite de Playwright (Chromium)
```

## Tareas

| Tarea | Specs | Ruta | Estado |
|---|---|---|---|
| T1 — El aviso en el bocadillo y la región que no lo pinta | S1-S5 | inline | hecho (`533d9b5`) |
| T2 — Spec, enmiendas, glosario y TODO | S1-S5 | inline | hecho (`f0aca9c`) |
| T3 — Corrección de la revisión nativa (R3-001) | S1-S2 | inline | hecho (`a91cfe5`) |
| T4 — Avisos de la revisión: tests, código y spec | S1-S5 | inline | hecho (`e93e218`, `ad07507`, `000afba`) |

## Plan de commits

1. `fix(frontend): el aviso de escritura se ve dentro del bocadillo (RF-F47)`
2. `docs(frontend): spec de RF-F47 y enmiendas de RF-F41, RF-F44 y RF-F46 (RF-F47)`

## Referencias

- Requisito: `RF-F44-movimiento-reducido.md` (D3 y el criterio 1, invertidos) y
  `RF-F41-region-estado.md` (la región no pinta lo que está en la conversación).
- Regla de la región: `RF-F46-respuesta-una-vez.md` (D1).
- Verificación por niveles: `../../docs/decisions/005-live-region-verification.md`.
- Issue: #106.

## Log

- **L1 (2026-10-23)**: "implementa https://github.com/jlizancandela/chatbox/issues/106, revisa,
  haz pr y mergea. no dejes nada sin atar."
- **L2 (2026-10-23)**: petición original de Jorge (2026-10-23, issue #106): "El mensaje de esta
  escribiendo, debería de verse dentro del bocadillo no arriba en la esquina superior." La issue
  #106 se creó con `type:feature` y sin `status:approved`; la aprobación de Jorge llega con
  "implementa #106".
- **L3 (2026-10-23)**: la issue #106 dejaba abierta la decisión del texto (acortar a
  «Escribiendo…» o no). Queda cerrada en D5: el texto no cambia, porque cambiarlo cambiaría lo
  que oye quien usa lector de pantalla sin aportar nada al cambio de sitio.
- **L4 (2026-10-23)**: la nota pendiente de RF-F46 («la checklist manual de RF-F41 tiene que
  compararse con la burbuja, no con la región») se cierra aquí: la referencia manual de la
  región pasa a ser el bocadillo y la checklist actualizada queda en la issue #106.
- **L5 (2026-10-23)**: la región deja de pintar el aviso, así que la conversación gana 20 px
  de alto durante el turno. Eso destapó una precondición frágil en un test de RF-F06
  (`scroll-follow.spec.ts`): «no arrastra a quien se aparta del hilo» subía el hilo cuando la
  respuesta apenas desbordaba, y el widget —bien— lo seguía, porque a menos de ~80 px del
  final se está «siguiendo» (RF-F06). El test ahora espera a que el hilo desborde con holgura
  antes de apartarse. El widget no cambia: el efecto es del test, no del contrato.
- **L6 (2026-10-23)**: el test nuevo de navegador comprueba el árbol de accesibilidad con
  `ariaSnapshot()`: la región sigue exponiendo el texto que se anuncia y la copia visible del
  bocadillo no está en el árbol. Se verificó que falla de verdad si la región pasa a
  `display: none` o si la copia del bocadillo pierde su `aria-hidden`.
