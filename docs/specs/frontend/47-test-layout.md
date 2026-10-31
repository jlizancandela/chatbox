# Spec: organización de tests por tipo

## Objetivo

Separar los tests del código productivo y organizar los tests existentes por
responsabilidad y tipo de prueba.

## Alcance

- Mover los tests actuales a `test/unit/chat/`.
- Reservar `test/component/`, `test/integration/` y `test/accessibility/` para
  futuras pruebas de esas categorías.
- Configurar Vitest y Biome para descubrir y revisar `test/`.
- Mantener la misma cobertura y comportamiento.

## Criterios de aceptación

- No queda ningún test dentro de `src/`.
- Vitest ejecuta los 20 tests existentes.
- `npm run lint` incluye `src/` y `test/`.
- La documentación refleja las rutas nuevas.

## Fuera de alcance

- Tests de componentes, integración o accesibilidad.
- Cambios en la lógica productiva.
