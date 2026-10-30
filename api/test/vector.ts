import { EMBEDDING_DIMENSION } from "../src/services/embedding.config";

/**
 * Un vector determinista con la dimensión del esquema. Sirve de doble en los tests
 * que solo necesitan que el vector viaje; no representa ningún embedding real.
 */
export const vectorOf = (dimension = EMBEDDING_DIMENSION): number[] =>
	Array.from({ length: dimension }, (_, index) => (index % 10) / 10);
