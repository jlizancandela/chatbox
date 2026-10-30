import { join } from "node:path";

/**
 * El modelo de embeddings vive dentro del proceso de la API.
 *
 * No hay selector de proveedor en tiempo de ejecución: un solo modelo, una sola ruta.
 * Cambiar de modelo es cambiar estas constantes, y eso cambia la firma de embeddings,
 * que invalida el corpus y obliga a reingerirlo.
 */
export const EMBEDDING_MODEL_ID = "onnx-community/embeddinggemma-300m-ONNX";

/**
 * El commit exacto del Hub, no `main`: si el repositorio republica los pesos, la
 * imagen no cambia por sorpresa y la firma de embeddings sigue describiendo lo que
 * hay guardado.
 */
export const EMBEDDING_MODEL_REVISION = "5090578d9565bb06545b4552f76e6bc2c93e4a66";

/** Cuantización del ONNX: `q4` son ~200 MB de pesos y la calidad medida no baja. */
export const EMBEDDING_DTYPE = "q4" as const;

/**
 * La dimensión por defecto es la del esquema: `document_chunks.embedding` es
 * `vector(768)` y la migración no admite otra cosa.
 */
export const EMBEDDING_DIMENSION = 768;

/**
 * EmbeddingGemma pide un prefijo distinto para la consulta y para el documento. El
 * documento lleva su título cuando lo tiene. Sin los prefijos, la recuperación se
 * degrada aunque los vectores sigan siendo válidos.
 */
export const QUERY_PROMPT = "task: search result | query: ";

export const documentPrompt = (title?: string): string => `title: ${title ?? "none"} | text: `;

export type EmbedPurpose = "query" | "document";

const DEFAULT_CACHE_DIR = join(process.cwd(), ".cache", "embeddings");

const rawCacheDir = process.env.EMBEDDING_CACHE_DIR?.trim();

/**
 * Dónde están (o se descargan) los ficheros del modelo. La imagen los trae ya dentro,
 * y el proceso no descarga nada al arrancar: `pnpm embeddings:fetch` es el único paso
 * que necesita red, y solo para desarrollo.
 */
export const embeddingCacheDir =
	rawCacheDir && rawCacheDir.length > 0 ? rawCacheDir : DEFAULT_CACHE_DIR;

/**
 * La carpeta exacta del snapshot dentro de la caché de `@huggingface/transformers`.
 *
 * En tiempo de ejecución se carga como directorio local, no como id de modelo: la
 * librería resuelve los ficheros del tokenizer sin la revisión cuando no hay red, y
 * con la revisión solo acierta si se le da la ruta ya resuelta.
 */
export const embeddingModelPath = (): string =>
	join(embeddingCacheDir, EMBEDDING_MODEL_ID, EMBEDDING_MODEL_REVISION);

/**
 * Identifica la configuración que produce los embeddings. Forma parte de la versión
 * de los documentos: cambiarla invalida el corpus y obliga a reingerirlo.
 *
 * Solo entra el prefijo del documento: es el que se aplicó al vector guardado. El de
 * la consulta no cambia los vectores del corpus.
 */
export const embeddingSignature = [
	EMBEDDING_MODEL_ID,
	EMBEDDING_MODEL_REVISION,
	EMBEDDING_DTYPE,
	String(EMBEDDING_DIMENSION),
	documentPrompt(),
].join(":");
