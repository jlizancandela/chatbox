# Decisión 003: verificación de resolución del theming en navegador

## Estado

Aceptada (2026-10-17).

## Decisión

La resolución final de los tokens del Chatbox se verifica con Playwright y
Chromium headless. Playwright permite emular `prefers-color-scheme` y
`forced-colors` mediante `page.emulateMedia`, y los asserts leen
`getComputedStyle` en un navegador real.

La suite vive en `frontend/test/browser/` y se ejecuta con `npm run test:browser`.
CI instala únicamente Chromium y ejecuta la suite después del typecheck y de los
tests unitarios.

`prefers-contrast: more` se comprueba de forma compatible con el soporte del
runner: cuando el navegador expone la preferencia, se valida la resolución del
token; cuando no la expone, se valida que la regla de producción exista sin
inyectar CSS ni forzar el resultado. Esto evita falsos verdes producidos por
mockear `matchMedia` o añadir reglas de sustitución desde el test.

La página Vite de desarrollo monta `Chatbox` como fixture ejecutable para que
los browser tests cubran el CSS y el componente reales, sin duplicar los
asserts estructurales de los tests jsdom.
