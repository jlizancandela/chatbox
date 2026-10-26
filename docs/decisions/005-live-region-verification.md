# Decisión 005: verificación de la región viva del chatbox

## Estado

Aceptada (2026-10-20). Enmendada el 2026-10-26 (issue #113): el nivel manual se retira y
quedan dos niveles.

## Contexto

RF-F41 define una región `role="status"` / `aria-live="polite"` que anuncia el inicio del
turno, la respuesta completa una sola vez al recibir `done`, y el desenlace en error o
aborto. La lista de mensajes no es región viva.

La Decisión 002 ya mostró, para el CSS, que jsdom tiene límites empíricos que producen
falsos verdes: no resuelve custom properties ni evalúa `@media`. La región viva tiene un
límite del mismo tipo y peor: **jsdom no implementa semántica de región viva**. No hay
`role="status"`, no hay `aria-live`, no hay ninguna noción de que un cambio de texto sea un
anuncio. Un test en jsdom puede asertar que la región contiene el texto correcto en el
momento correcto, y eso es exactamente lo que hace; no puede asertar que un lector de
pantalla lo hable, y un test que lo insinúe miente sobre su propia cobertura.

`axe-core` comprueba estructura y relaciones (rol, atributos, nombres accesibles), no que
el anuncio ocurra ni cuándo. Tampoco puede saberlo: no hay lector de pantalla en el bucle.

## Decisión

La verificación de la región viva tiene dos niveles, y cada assert declara el suyo:

1. **Estructura (jsdom, por defecto).** El rol y los atributos existen, la secuencia de
   textos en la región es la del contrato evento → texto, la rehidratación no anuncia y la
   proyección de texto plano hace lo que dice. Aserta qué lleva la región, no que suene.
2. **Resolución (Chromium, Playwright).** La secuencia real de `.chatbox__status` con el API
   mockeado por SSE, más la **pasada automática con axe** sobre el widget en todos sus
   estados. Sigue sin probar que algo se anuncie; prueba que lo que se anuncia existe en el
   árbol correcto.

Un test verde de nivel 1 no habilita el cierre de la RF. El cierre es el nivel 2.

## Enmienda (2026-10-26, issue #113)

El tercer nivel —**manual, con NVDA y VoiceOver**, como condición de cierre— se retira.

**Por qué.** Ese nivel nunca se ejecutó: el checklist de la issue #91 quedó con sus ocho
ítems sin marcar. Un nivel que no se ejecuta no es un control: finge una garantía que nadie
ha comprobado y, mientras siga escrito, deja la RF bloqueada. El nivel 2 pasa a ser la
condición de cierre.

**Qué se pierde.** Lo que el nivel manual añadía era la **fonética**: que la frase suene
natural a quien la oye. Eso no es un contrato del widget, y no hay forma de automatizarlo sin
un lector de pantalla real en el bucle —un test que verifica una emulación daría la misma
falsa confianza con más coste.

**Qué lo compensa.** El texto que se anuncia es, desde RF-F46 y RF-F47, el mismo que se ve
en la burbuja: la región lo anuncia sin volver a pintarlo. La proyección a texto plano
(`toAnnouncementText`) tiene sus propios tests unitarios, y la secuencia
`""` → `escribiendo` → desenlace está fijada en los dos niveles que quedan.

**Qué no cambia.** El nivel 1 no se toca. El nivel 2 se refuerza: la pasada de axe
(`frontend/test/browser/accessibility.spec.ts`) recorre el widget en los ocho estados en que
puede encontrarse, en los dos esquemas de color, y tiene una entrada que rechaza —inyecta
una violación real y exige que la pasada la reporte—. El nivel auditado y la raíz del
escaneo viven en un único sitio (`frontend/test/axe.ts`), no en cuatro bloques copiados.

**Consecuencia.** RF-F41 se cierra con dos niveles, como el contraste (Decisión 006), los
objetivos táctiles (007), el movimiento reducido (008) y los nombres accesibles (009).

## Consecuencias

- Ningún verde finge cobertura: cada test dice qué nivel verifica, en el nombre o en un
  comentario, como ya hace la suite de theming.
- La suite unitaria puede seguir siendo rápida y exhaustiva sobre el contrato, que es donde
  se concentran los fallos reales (un evento que no emite, un texto que no llega).
- El cierre de la RF depende de la pasada automática, que corre en CI.
- Si en el futuro se toca el contrato de anuncios, cambia también el nivel 1; si se toca el
  CSS de la región, cambia también el nivel 2.

## Alternativas rechazadas

- **Un único nivel en jsdom:** es el falso verde que la Decisión 002 ya veló para el CSS,
  reproducido en la accesibilidad.
- **Playwright como prueba del sonido:** automatizar el anuncio exigiría un lector de
  pantalla en el bucle; el resultado sería un test que verifica una emulación, no el
  comportamiento real, y daría la misma falsa confianza con más coste.
- **axe como verificación suficiente:** axe valida que el rol y los atributos estén, que es
  la mitad estática del requisito. No dice nada del orden ni del contenido del anuncio.
- **Mantener el nivel manual como condición de cierre:** un checklist que nadie ejecuta no
  cierra nada; deja la RF esperando una verificación que no llega.
