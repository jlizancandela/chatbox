# Issue tracker: GitHub

Issues y specs de este repositorio viven en GitHub Issues.

## Convenciones

- Usar `gh issue create` para publicar issues.
- Usar `gh issue view` para consultar issues.
- Usar `gh issue comment` para comentar.
- Usar `gh issue edit` para modificar labels o asignaciones.
- Inferir el repositorio desde el remote Git actual.
- Las PRs no son una superficie de triage de solicitudes.

Cuando una skill indique publicar en el issue tracker, crear una issue de GitHub.

## Labels en uso

- `ready-for-agent` — issue tomable por un agente sin más contexto.
- `status:approved` — alcance aprobado por Jorge.

Una issue sin `ready-for-agent` no se toma: o le falta contexto, o está bloqueada
por otra issue (indicarlo en la sección "Blocked by").

## Specs

Las specs de implementación viven en el repo, no en GitHub: `frontend/.specs/`
para el frontend, `docs/` para decisiones y plan de la API. La issue define el
alcance y los ACs; la spec es la fuente de verdad técnica.
