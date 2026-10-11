# Spec: estado y persistencia de conversación

## Objetivo

Añadir la lógica pura y aislada para mantener la transcripción visible separada
del contexto enviado al API, recortar el historial según los límites del
contrato y restaurar la conversación durante la sesión del navegador.

## Alcance

- Crear `src/conversation.ts`.
- Exponer un store mínimo para `messages` y `context`.
- Recortar mensajes a 20 elementos, 2000 caracteres por mensaje y 8000
  caracteres totales.
- Validar preguntas de hasta 1000 caracteres y construir el body de
  `POST /api/chat`.
- Sustituir el contexto local por el historial canónico recibido del servidor.
- Persistir y restaurar datos bajo `chatbox:v1` sin romper el chat ante errores de
  `sessionStorage` o datos corruptos.

## Fuera de alcance

- Hook de streaming, componentes, UI y configuración de Vitest.

## Criterios de aceptación

- La lógica no depende del DOM ni de Preact.
- Los datos inválidos no atraviesan la frontera de persistencia ni del request.
- El historial conserva los mensajes más recientes dentro de todos los límites.
- Biome y el build de producción pasan.
