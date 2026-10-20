/**
 * Proyección de anuncio (RF-F41): versión en texto plano del markdown que se entrega a la
 * región de estado, porque el anuncio se oye y no se lee con los símbolos encima.
 *
 * No es un parser de markdown. Cubre lo que el asistente emite en la práctica —negrita,
 * código en línea, enlaces y marcadores de lista— y **deja intacto lo que no reconoce**.
 * El asterisco y el guion bajo sueltos no se tocan: son indistinguibles de una
 * multiplicación (`3 * 4`) o de un identificador (`max__value`), y reescribir el texto de
 * una respuesta es peor que oír un símbolo de más.
 */

const LINK = /\[([^\]]+)\]\([^)]*\)/g;
const INLINE_CODE = /`([^`]+)`/g;
// Las comillas no pueden ir pegadas a una letra: `__` dentro de un identificador no es
// énfasis, y sin este borde `max__value__length` se leería como `maxvaluelength`.
const STRONG = /(?<![\w*])(\*\*|__)(?=\S)([\s\S]*?\S)\1(?![\w*])/g;
const BULLET = /^[ \t]*[-*+][ \t]+/gm;
// Solo de un dígito: `2024. La película...` es prosa, no una lista, y borrarle el año en
// silencio sería reescribir la respuesta. Una lista de más de nueve ítems conserva su número,
// que además es correcto leerlo en voz alta.
const ORDERED = /^[ \t]*[1-9]\.[ \t]+/gm;

export const toAnnouncementText = (markdown: string): string =>
	markdown
		.replace(LINK, "$1")
		.replace(INLINE_CODE, "$1")
		.replace(STRONG, "$2")
		.replace(BULLET, "")
		.replace(ORDERED, "")
		.trim();
