# Decisión 005: verificación de la región viva del chatbox

## Estado

Aceptada (2026-10-20).

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

La verificación de la región viva tiene tres niveles, y cada assert declara el suyo:

1. **Estructura (jsdom, por defecto).** El rol y los atributos existen, la secuencia de
   textos en la región es la del contrato evento → texto, la rehidratación no anuncia y la
   proyección de texto plano hace lo que dice. Aserta qué lleva la región, no que suene.
2. **Resolución (Chromium, Playwright).** La secuencia real de `.chatbox__status` con el API
   mockeado por SSE, más una pasada de `axe` sobre el widget. Sigue sin probar que algo se
   anuncie; prueba que lo que se anuncia existe en el árbol correcto.
3. **Manual (NVDA y VoiceOver), condición de cierre.** Único nivel que verifica que hay
   sonido. Se ejecuta sobre la checklist de la issue: inicio, respuesta completa, respuesta
   idéntica a la anterior, fallo, aborto y montaje con conversación restaurada.

Un test verde de nivel 1 no habilita el cierre de la RF. La condición es el nivel 3.

## Consecuencias

- Ningún verde finge cobertura: cada test dice qué nivel verifica, en el nombre o en un
  comentario, como ya hace la suite de theming.
- La suite unitaria puede seguir siendo rápida y exhaustiva sobre el contrato, que es donde
  se concentran los fallos reales (un evento que no emite, un texto que no llega).
- El nivel 3 no es automatizable y no se va a automatizar: un lector de pantalla de verdad
  en un SO de verdad, una vez por cambio de la región.
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
