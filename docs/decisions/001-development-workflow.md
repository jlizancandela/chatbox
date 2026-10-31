# Decisión 001: flujo de trabajo y documentación proporcional

## Estado

Aceptada.

## Contexto

Chatbox es un monorepo con `api/` y `frontend/`. El flujo de trabajo debe ser
consistente entre ambos proyectos, pero las instrucciones específicas de cada
proyecto no deben duplicar las reglas globales del agente.

Además, no todos los cambios tienen el mismo nivel de riesgo. Una corrección
mecánica no necesita la misma documentación que una migración o un cambio de
contrato.

## Decisiones

### Flujo global

El flujo issue → plan → aprobación → implementación → verificación → commit → PR
→ merge está definido en los skills globales `plan` y `comitear`. Los
`AGENTS.md` de cada proyecto solo deben añadir restricciones y verificaciones
específicas de ese proyecto.

Antes de implementar se debe presentar un plan con alcance, archivos afectados,
riesgos y verificaciones. No se modifica código hasta recibir aprobación
explícita.

### Documentación proporcional

Toda modificación debe tener una issue, pero el nivel de documentación depende
del riesgo:

- **Spec formal en `docs/specs/`** para features, cambios de API, arquitectura,
  seguridad, migraciones o cambios con riesgo técnico.
- **Spec ligera en `docs/specs/`** para refactors, configuración, documentación
  relevante o ajustes de UX.
- **Issue y PR sin spec** para correcciones tipográficas, formato,
  actualizaciones mecánicas y fixes obvios.

Cuando existe una spec, es la fuente de verdad funcional y técnica de la
implementación. La issue registra el motivo y la PR aporta la evidencia.

### Ubicación de decisiones

Las decisiones generales de proceso, arquitectura o convenciones que no
especifican una implementación concreta se guardan en `docs/decisions/`. No se
mezclan con las specs de implementación.

### Restricciones que atraviesan el flujo

Algunas decisiones son restricciones sobre **cómo se trabaja**, no sobre cómo se
construye una cosa. Se enlazan desde aquí para que quien siga el flujo las
encuentre antes de empezar:

- [015 — Las migraciones publicadas no se borran ni se renombran](./015-migraciones-publicadas-no-se-borran.md):
  una migración que llegó a `main` es historial, no estado.

## Consecuencias

- `AGENTS.md` puede mantenerse corto y específico del proyecto.
- `docs/specs/` queda reservado para implementaciones concretas y puede vincularse
  directamente a issues.
- Las decisiones generales tienen una ubicación estable y no se pierden al
  reorganizar un módulo.
- Los skills globales son la fuente operativa del flujo de trabajo; este
  documento conserva la decisión y su motivación.

## Verificación

- `frontend/AGENTS.md` no contiene el procedimiento completo de issue, rama,
  commit, PR y merge.
- `docs/specs/` conserva solo documentos de implementaciones.
- Las decisiones de proceso están disponibles bajo `docs/decisions/`.
