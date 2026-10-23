/**
 * Regla de seguimiento del hilo (RF-F48).
 *
 * El widget desplaza la conversación hacia el final mientras llega la respuesta. Para saber
 * si la persona sigue el hilo o se ha apartado hace falta una regla: a menos de un umbral
 * del final, se está siguiendo.
 *
 * La regla vive aquí y no en el componente por dos razones: se puede probar sin DOM, y el
 * test de navegador puede derivar de ella su precondición en vez de adivinarla. Con un
 * número duplicado, el test se rompía cada vez que el widget cambiaba de alto.
 */

/**
 * El umbral del final, en píxeles.
 *
 * 16 px tienen que ser las dos cosas que este número es a la vez: el ruido que se ignora
 * (un dedo tembloroso, un rebote del navegador) y el recorrido máximo que el seguimiento
 * devuelve al final. Son 16 px porque ese tirón no se ve; con 80 px, un gesto deliberado de
 * 30 px en un trackpad volvía al final sin avisar.
 *
 * No depende de la altura del contenedor: si dependiera, la definición de «apartado» se
 * movería sola cuando el widget cambia de alto.
 */
export const followThreshold = (): number => 16;

/**
 * ¿Está la persona apartada del final del hilo?
 *
 * `distanceFromEnd` son los píxeles que le quedan al final de la conversación.
 */
export const isAwayFromEnd = (distanceFromEnd: number): boolean =>
	distanceFromEnd >= followThreshold();
