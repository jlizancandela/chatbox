# RF-F41 — Pasada automática con axe y cierre sin nivel manual

> Convención del proyecto: un spec por RF en `.specs/`, decisiones de proceso en
> `docs/decisions/` de la raíz, glosario en `GLOSSARY.md` de la raíz.
>
> Spec abierto el 2026-10-26 con el plan aprobado de la issue #113. Enmienda
> `.specs/RF-F41-region-estado.md` y `docs/decisions/005-live-region-verification.md`.

## Objetivo

Cerrar el último ítem pendiente de RF-F41 en `frontend/TODO.md`: **una pasada automática
con axe sobre el widget en todos sus estados** y **la retirada del nivel manual** de
verificación (NVDA y VoiceOver) con el fixture de desarrollo que lo alimentaba.

## Contexto

El axe ya se ejecutaba, pero a medias y por duplicado:

- Cuatro specs de navegador copiaban el mismo bloque `axe.run` sobre el widget, con **dos
  niveles distintos**: `live-region`, `keyboard` y `theming` usaban `wcag2a+wcag2aa`, y
  `contrast` usaba `wcag2a+aa+21a+aa+22aa`. Cada copia era una definición más de qué se
  audita, y la más amplia no era la que se usaba en todas partes.
- Cada spec escaneaba **un solo estado** del widget. El estado inicial, con una respuesta y
  con la confirmación abierta no se escaneaban por el mismo camino: el DOM es otro en cada
  uno, y un escaneo del estado inicial no audita el widget, audita una de sus formas.

El nivel manual tenía su aparato: `frontend/src/dev/manual-announcements.tsx` montaba el
widget real con un `fetch` sustituido por un guion, en seis escenarios `?manual=<escenario>`,
para poder recorrer el checklist de NVDA y VoiceOver sin levantar la API.

## Decisiones

### D1 — Un nivel auditado, declarado en un sitio

`frontend/test/axe.ts` es la única fuente de dos cosas: **qué se audita** (WCAG 2.0, 2.1 y
2.2, niveles A y AA) y **dónde** (la raíz `.chatbox`). El escaneo se limita al widget: es lo
que se distribuye y lo que el sitio host embebe; las reglas de página —el `lang` del
documento, un único `h1`— no son responsabilidad del widget.

### D2 — La pasada recorre los estados

`frontend/test/browser/accessibility.spec.ts` escanea el widget en ocho estados —vacío,
turno en marcha, respuesta anunciada, turno sin respuesta, turno fallido, turno detenido,
conversación restaurada y confirmación abierta— en los dos esquemas de color. Son dieciséis
escaneos: el widget en cada forma en que puede encontrarse.

### D3 — La pasada tiene una entrada que rechaza

Un escaneo que no mira, o que mira un sitio donde no puede haber nada, pasa en verde y no
protege nada. La pasada **inyecta una imagen sin texto alternativo** dentro del widget —una
violación de WCAG 1.1.1 que cae de lleno en el nivel auditado— y exige que la reporte. Con
la raíz del escaneo rota a propósito, ese test se pone rojo: está verificado.

### D4 — Sin nivel manual

El nivel 3 de la ADR 005 (NVDA y VoiceOver) se retira. La razón no es que el sonido no
importe: es que **ese nivel nunca se ejecutó** —el checklist de la issue #91 quedó con sus
ocho ítems sin marcar—, y un nivel que no se ejecuta no es un control: finge una garantía
que nadie ha comprobado y deja la RF bloqueada mientras siga escrito.

Lo que el nivel manual añadía era la **fonética**: que la frase suene natural a quien la
oye. Eso no es un contrato del widget, y lo que sí es un contrato queda verificado:

- El texto que se anuncia es, desde RF-F46 y RF-F47, el mismo que se ve en la burbuja: la
  región lo anuncia sin volver a pintarlo.
- La proyección a texto plano (`toAnnouncementText`) tiene sus propios tests unitarios.
- La secuencia `""` → `escribiendo` → desenlace está fijada en jsdom y en Chromium.

### D5 — El fixture manual se va con el nivel manual

El fixture existía para el checklist y para nada más: sin checklist, es código muerto que
además alguien tiene que mantener. Se van el archivo, su wiring en el arranque de la
aplicación, los dos tests de navegador que lo mantenían vivo y las exclusiones que los
inventarios de fuentes llevaban para él.

### D6 — Los bloques de axe duplicados se retiran

Sus estados quedan en la matriz: la respuesta anunciada, la confirmación abierta y el estado
vacío están todos. Lo que queda es un sitio donde se audita, no cuatro.

### D7 — El diseño se toca en una línea

`docs/stitch-frontend-design/SPEC-FRONTEND.md` decía, en su sección de pruebas, que la
accesibilidad se verificaba «con una pasada automática con axe y una prueba manual con NVDA
y VoiceOver». La D10 de `RF-F41-region-estado.md` decía que ese documento no se toca; esa
D10 hablaba de los **identificadores** `RF-Fxx`, que son el contrato de trazabilidad con
`TODO.md`, y no de la estrategia de verificación. Una línea que dice lo contrario de lo que
se hace es deuda: se actualiza, y solo esa línea.

## Fuera de alcance

- La prueba manual en móvil real (iOS Safari) del Paso 8: no es de RF-F41 ni es axe.
- Cambios de comportamiento del widget.
- El copy de los mensajes de error.
- Un lector de pantalla real en el bucle de CI: eso no existe y no se va a inventar.

## Verificación

- `cd frontend && npm run verify` — lint, typecheck, build y suite unitaria.
- `cd frontend && npm run test:browser` — la suite de navegador, con la pasada incluida.
