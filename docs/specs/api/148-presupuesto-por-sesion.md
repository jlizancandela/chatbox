# Presupuesto de consumo por sesión y recorte de coste por turno

> Spec del issue #148. Decisiones de proceso en `docs/decisions/` de la raíz,
> glosario en `GLOSSARY.md`.

## Problema

El plan gratuito del proveedor de generación no se agota por número de peticiones sino
por **tokens al día**: unos 200.000, compartidos por todos los visitantes.

El coste crece con la conversación porque cada turno reenvía el historial completo.
Medido sobre la API real: un turno sin historial son ~945 tokens, con el historial en su
tope ~2.024. Una conversación de diez turnos consume unos 16.650 tokens: el **8 % del
día**. Con la configuración actual, doce conversaciones agotan la cuota de todos.

Hoy nada acota lo que una sola sesión puede consumir, y la aplicación no contabiliza nada,
así que tampoco se puede saber cuánto ha gastado cada una.

## Decisiones

- **D1 — Se cuenta la cifra del proveedor, no una estimación.** El proveedor devuelve el
  consumo real en el último fragmento del stream (`usage.total_tokens`). Los tokens
  servidos desde el caché de prompt no cuentan contra el límite, y esa cifra ya lo
  refleja. Contar por caracteres estimaría mal y rompería la promesa de "lo que gastaste".

- **D2 — El turno sin respuesta también cuenta.** Si el modelo termina sin generar
  texto, el consumo se ha producido igual: se pagaron los tokens de la pregunta y del
  razonamiento. Contar solo los turnos con texto dejaría un camino gratis.

- **D3 — El presupuesto por sesión vive en memoria del proceso.** La instancia es única,
  así que un `Map` basta. Un reinicio del proceso lo borra, y eso se documenta: el
  presupuesto es equidad entre visitantes, no un registro contable.

- **D4 — El identificador de sesión lo genera el cliente.** Viaja en la cabecera
  `x-session-id` con cada petición. Sin autenticación, el cliente lo controla: borrarlo o
  rotarlo reinicia el presupuesto. **El presupuesto por sesión es equidad, no seguridad.**
  Lo único que no se puede eludir es el tope global diario, que vive en #143.

- **D5 — El corte por presupuesto tiene su propio código.** `SESSION_BUDGET_EXCEEDED`,
  distinto de la cuota global (`QUOTA_EXHAUSTED`) y del fallo genérico
  (`GENERATION_FAILED`). El visitante necesita poder distinguir "se acabó tu
  conversación" de "se acabó el día".

- **D6 — Al cortar, se ofrece una conversación nueva.** El mensaje invita a empezar de
  cero, y empezar de cero reinicia el presupuesto. Un corte sin salida es un callejón
  sin salida.

- **D7 — Hay dos topes, y se complementan.** Uno de **turnos** —predecible para el
  visitante: "no puedes pasar de N preguntas"— y otro de **tokens** —exacto para el
  gasto—. El de turnos avisa antes de que el de tokens duela.

- **D8 — Se reduce el historial que se reenvía.** Es la palanca que más reduce el coste
  por turno: el historial se reenvía **completo** en cada turno, así que una
  conversación de diez turnos paga diez veces la misma pregunta. El recorte baja el
  coste del turno y el efecto está medido y documentado.

- **D9 — El techo de tokens de generación sigue permitiendo la extensión que pide el
  prompt.** El prompt pide un máximo de 200 palabras. El techo baja lo justo para no
  truncar respuestas normales, con holgura para el razonamiento.

- **D10 — El consumo por turno queda en los logs.** Con el identificador de sesión, los
  tokens y el turno: es lo que permite ver un patrón abusivo (#146).

## Pruebas

- **Contador:** el consumo acumulado de una sesión crece con cada turno y usa la cifra
  del proveedor, con el proveedor sustituido.
- **Corte por presupuesto:** al superar el presupuesto, la petición se rechaza con su
  código propio **y no se llama al proveedor**.
- **Reinicio:** una conversación nueva empieza con el presupuesto intacto.
- **Sin respuesta:** un turno que termina sin texto sigue contabilizando.
- **No truncar:** una respuesta de la extensión que pide el prompt cabe en el techo
  configurado.
- **Tope de turnos:** al superarlo, el corte es con su propio mensaje.

## Fuera de alcance

- Autenticación o cuentas.
- Persistir el consumo entre reinicios.
- Facturación o cuotas por usuario.
- El tope global diario: vive en #143.
