/**
 * La condición de una media query, normalizada: los espacios no son parte del nombre.
 *
 * Vive en su propio módulo, sin dependencias, porque lo usan los dos lados de la
 * verificación: la suite unitaria, que lee la hoja con `?raw`, y la de navegador, que no
 * puede leer un CSS importado. `test/motion.ts` lo usa y lo importa la suite de navegador,
 * así que no puede depender de nada que cargue la hoja de estilos.
 */
export const normalizeMediaParams = (params: string | number | undefined): string =>
	typeof params === "string" ? params.replace(/\s+/g, " ").trim() : "";
