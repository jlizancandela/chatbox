# El cierre del turno no pierde estado: turno vacío y abort

> Spec del issue #145. Decisiones de proceso en `docs/decisions/` de la raíz,
> glosario en `GLOSSARY.md`.

## Problema

Dos fallos del reducer del widget, independientes entre sí y ninguno avisa.

1. **Un turno sin respuesta borraba la pregunta del contexto.** `turn-completed` solo
   escribía en `context` dentro de la rama que exigía mensaje del asistente. Si el modelo
   terminaba sin texto —el camino normal cuando no hay contexto suficiente—, la pregunta
   quedaba visible en el hilo pero no viajaba al API. La siguiente pregunta se enviaba sin
   su antecedente: «¿Y en qué trabaja?» se quedaba sin referente.
2. **Abortar descartaba la respuesta parcial.** `turn-aborted` solo cambiaba `turnState`.
   El texto parcial seguía en `currentResponse`, que `ChatMessages` pinta mientras el turno
   está en marcha, pero nunca se confirmaba como mensaje: `sessionStorage` guarda `messages`
   y `context`, así que al recargar desaparecía. `turn-failed` tenía el mismo agujero, con
   el añadido de que tampoco cerraba el turno.

## Decisiones

- **D1 — Un solo cierre.** `turn-completed`, `turn-failed` y `turn-aborted` comparten
  `closeTurn`. La regla es una: la pregunta entra **siempre** en el contexto si el turno
  estaba abierto, y la respuesta entra en el hilo y en el contexto **solo si tiene texto**.
  Nunca se inventa un mensaje vacío del asistente.
- **D2 — Qué se guarda es lo que se ve.** Cerrar limpia `currentResponse`, `sources`,
  `turnState` y `error`. El parcial deja de ser estado de turno y pasa a ser un mensaje, así
  que `ChatMessages` ya no necesita pintar desenlaces (`isBusy` a secas) y `sessionStorage`
  persiste exactamente el hilo.
- **D3 — Abortar y fallar tratan igual el parcial.** `turn-aborted` gana `response?` y el
  runner le pasa `active.assistantText`, igual que ya hacía `failWith`. Lo que cambia entre
  ambos es el desenlace que se anuncia, no lo que se guarda.
- **D4 — El cierre exige un turno abierto.** Si el runner falla antes de abrir turno
  (pregunta inválida), no se confirma nada: `closeTurn` solo escribe con un `turnState` de
  `connecting`, `generating` o `streaming`.
- **D5 — Reintentar deshace el turno que se repite.** `currentQuestion` no se limpia al
  cerrar porque el botón de reintentar la necesita. Para que la pregunta no se duplique ni
  en el hilo ni en el contexto, `turn-retried` retira lo que el cierre fallido escribió:
  la respuesta confirmada en `messages` y el par pregunta/respuesta en `context` (helper
  puro `dropClosedTurn`, que solo actúa si la cola coincide con la pregunta reintentada).
  El runner construye el historial del reintento con ese mismo helper, porque la petición
  se arma antes de que el reducer aplique la acción.
- **D6 — Los límites de historial no cambian.** `trimHistory` sigue recortando al enviar;
  el contexto puede crecer un mensaje más entre turnos y se ajusta en la petición.
- **D7 — Lo que se guarda es lo que se pintó.** `active.assistantText` se acumula al **volcar**
  el búfer de tokens, no al encolarlos: el texto que aún no ha pasado por un frame de
  animación todavía no se ha visto, así que no puede estar en lo guardado. Sin esta regla,
  abortar persistía una respuesta del asistente que el visitante nunca vio —la ventana real
  entre que llega un token y que se pinta el siguiente frame—.
- **D8 — Abortar descarta lo pendiente; fallar lo conserva.** Las dos acciones guardan lo
  mismo —el texto pintado—, pero no lo vacían igual: abortar cancela el frame pendiente (la
  persona pidió parar, así que el token a medio pintar se pierde), mientras que fallar vuelca
  el búfer para que no se pierda lo ya generado. El texto se anuncia siempre como se pintó.

## Pruebas

- Reducer: turno completado sin respuesta deja la pregunta en `messages` y en `context`;
  aborto y fallo con parcial dejan el mismo par guardado; fallo sin texto no crea un
  mensaje vacío; un fallo sin turno abierto no escribe nada; reintentar no duplica.
- `dropClosedTurn`: quita el par completo, quita una pregunta cerrada sin respuesta y no
  toca un turno ajeno.
- Runner: un turno vacío deja la pregunta en el contexto; un error de stream confirma el
  parcial; el aborto conserva lo que ya se mostró; el reintento envía el historial sin la
  pregunta repetida.
- Runner: **abortar con un token a medio pintar no lo guarda** —el token está en el búfer
  pero su frame no ha llegado, así que nunca se vio; fallar con el mismo token sí lo muestra
  y lo guarda.
- Componente: tras una respuesta vacía, la petición siguiente lleva historial y el hilo no
  muestra un mensaje vacío del asistente; tras abortar, el parcial queda en
  `sessionStorage` y sigue visible al volver a montar el widget. Ambas entradas fallan con
  el comportamiento anterior (verificado).

## Fuera de alcance

El formato de los mensajes de error, la persistencia más allá de reflejar el estado,
cambiar los límites de historial y el comportamiento del scroll.
