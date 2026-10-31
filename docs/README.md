# Documentación

Este directorio es la puerta de entrada a la documentación del monorepo. Cada dato
tiene **una** fuente de verdad; el resto de documentos la enlazan en vez de repetirla.

## Mapa de autoridad

| Qué | Fuente única |
|---|---|
| Requisitos de la API | [`spec.md`](spec.md) |
| Requisitos del widget | [`design/SPEC-FRONTEND.md`](design/SPEC-FRONTEND.md) |
| Decisiones y su porqué | [`decisions/`](decisions/) |
| Specs de implementación | [`specs/api/`](specs/api/) y [`specs/frontend/`](specs/frontend/) |
| Estado del MVP | [`../api/TODO.md`](../api/TODO.md) y [`../frontend/TODO.md`](../frontend/TODO.md) |
| Operación de la API | [`../api/README.md`](../api/README.md) |
| Uso del widget | [`../frontend/README.md`](../frontend/README.md) |
| Arquitectura del frontend | [`../frontend/AGENTS.md`](../frontend/AGENTS.md) y [`frontend/`](frontend/) |
| Vocabulario del dominio | [`../GLOSSARY.md`](../GLOSSARY.md) |
| Flujo de trabajo | [`../AGENTS.md`](../AGENTS.md) y [`decisions/001-development-workflow.md`](decisions/001-development-workflow.md) |
| Diseño de referencia | [`design/`](design/) |

## Regla

Un documento no repite un número que vive en el código o en `.env.example`. Lo nombra
por su variable y enlaza al sitio donde se declara.

Si hace falta que un valor aparezca en dos sitios, el segundo lo verifica un test que
falla cuando dejan de coincidir. Sin esa guardia, la copia se queda atrás sin avisar:
ya pasó con los límites del historial, con el umbral de similitud y con el umbral de
seguimiento.

## Contenido

- `spec.md` — requisitos funcionales de la API en formato EARS.
- `design/` — requisitos del widget y el export de diseño de Stitch.
- `decisions/` — ADRs; se conservan aunque la implementación cambie, porque registran
  el momento en que se decidió.
- `specs/api/` y `specs/frontend/` — un spec por issue cuando la decisión no es obvia.
  Registran la decisión de su momento; el comportamiento vigente vive en el código y en
  el spec de requisitos.
- `frontend/` — contrato del hook de streaming y descripción de la implementación.
- `agents/` — convenciones para agentes (issue tracker, dominio).
- `api/plan.md` — plan KISS original del MVP; es histórico y el estado real vive en
  `api/TODO.md`.
