# Decisión 002: estrategia de tests para CSS y theming

## Estado

Aceptada (2026-10-17).

## Contexto

El theming del chatbox (RF-F61) introduce tokens CSS, capas de tema
(`@media (prefers-color-scheme: dark)`, `[data-theme]`, `forced-colors`) y
contratos de contraste WCAG. Los tests corren en jsdom con Vitest.

Dos limitaciones de jsdom están verificadas empíricamente y condicionan lo que
se puede assertear:

- `getComputedStyle` devuelve `var(--chatbox-color-*)` sin resolver: jsdom no
  calcula el valor final de una custom property.
- jsdom **parsea** las reglas `@media` y las expone en `document.styleSheets`
  como `CSSMediaRule` con `mediaText`/`conditionText`, pero **no las evalúa**.
  Con `window.matchMedia('(prefers-color-scheme: dark)')` devolviendo `true`,
  el estilo computado sigue mostrando el valor del bloque base.

Consecuencia: mockear `matchMedia` y leer `getComputedStyle` no verifica el tema
oscuro. Un test así pasaría en verde sin probar nada, que es peor que no tenerlo.

## Decisión

Los tests de CSS y theming se separan en dos niveles explícitos:

1. **Verificación de mecanismo (jsdom, por defecto).** Se parsea el CSS con
   `postcss` (devDependency explícita; ya estaba en el árbol vía Vite) y se
   assertea la estructura: declaraciones, hex exactos, selectores, orden de las
   capas de tema por `source.start.offset`, y consumo de tokens con `var()`.
   En componente se assertea que la hoja importada está en
   `document.styleSheets` con las reglas esperadas, y los valores crudos de las
   propiedades. El contraste se comprueba con umbrales WCAG 2.x calculados en
   un unit test sobre los tokens parseados, no con números mágicos de ratio.
2. **Verificación de resolución (navegador real, ticket dedicado).** Los valores
   finales computados se verifican con el esquema de color emulado del
   navegador (`colorScheme: 'dark'`), no con mocks de `matchMedia`. Vive en el
   ticket RF-F61/T5 y cubre T2, T3 y T4 más la auditoría con axe-core.

El runner de la verificación de resolución (Playwright vs. Vitest browser mode)
se decide al abrir T5.

## Consecuencias

- Ningún test verde finge cobertura que no existe: cada assert declara qué nivel
  verifica.
- El orden de las capas de tema es un assert estructural de primera clase, no un
  detalle interno: es el mecanismo del que depende la precedencia.
- T3 y T4 extienden el mismo test unitario (mismo parser) en vez de inventar
  verificación nueva.
- El CSS de producción no gana dependencias: `postcss` es devDependency y en
  runtime el CSS lo procesa Vite.
- El proyecto asume deuda explícita: hasta que T5 exista, la resolución real no
  está cubierta por CI.

## Alternativas rechazadas

- **Mockear `matchMedia` + `getComputedStyle`:** no funciona (jsdom no evalúa
  `@media`) y produce falsos verdes.
- **Regex sobre el texto del CSS:** se rompe con el anidamiento de `@media` y de
  los selectores de T3.
- **`css-tree`:** AST más rico para un archivo de ~50 líneas; dependencia nueva
  real sin necesidad.
- **Adoptar Playwright dentro del PR de theming:** mezcla infraestructura de
  tests con un cambio de CSS y bloquea el épico.
