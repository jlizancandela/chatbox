export type EmbeddingConfig = {
	geminiApiKey: string;
	geminiEmbeddingModel: string;
	geminiVectorDimension: number;
};

/**
 * Tipos de tarea de Gemini para la recuperación. Una consulta y un documento no se
 * codifican igual: el corpus se embebe como documento y la pregunta como consulta.
 */
export const EMBEDDING_TASK = {
	document: "RETRIEVAL_DOCUMENT",
	query: "RETRIEVAL_QUERY",
} as const;

export type EmbedPurpose = keyof typeof EMBEDDING_TASK;

/**
 * La dimensión por defecto es la del esquema: `document_chunks.embedding` es
 * `vector(768)` y la migración no admite otra cosa.
 */
const DEFAULT_VECTOR_DIMENSION = 768;

const rawVectorDimension = process.env.GEMINI_VECTOR_DIMENSION?.trim();

const vectorDimension = rawVectorDimension
	? parseInt(rawVectorDimension, 10)
	: DEFAULT_VECTOR_DIMENSION;

export const embeddingConfig: EmbeddingConfig = {
	geminiApiKey: process.env.GEMINI_API_KEY ?? "",
	geminiEmbeddingModel:
		process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001",
	geminiVectorDimension: vectorDimension,
};

/**
 * Identifica la configuración que produce los embeddings. Forma parte de la versión
 * de los documentos: cambiarla invalida el corpus y obliga a reingerirlo.
 */
export const embeddingSignature = `${embeddingConfig.geminiEmbeddingModel}:${embeddingConfig.geminiVectorDimension}:${EMBEDDING_TASK.document}`;

if (
	!Number.isInteger(embeddingConfig.geminiVectorDimension) ||
	embeddingConfig.geminiVectorDimension <= 0
) {
	throw new Error("GEMINI_VECTOR_DIMENSION must be a positive integer");
}

/**
 * Valida la configuración **cuando se va a usar el proveedor real**.
 *
 * La clave no se exige al importar el módulo: los tests inyectan el proveedor de
 * embeddings y no tienen por qué tener una credencial. Pero si el proveedor real es
 * el que se va a usar, la clave tiene que estar: por eso se comprueba aquí y no al
 * importar.
 *
 * Recibe la configuración por parámetro para poder comprobarse sin tocar el entorno.
 */
export const assertEmbeddingConfig = (
	config: EmbeddingConfig = embeddingConfig,
): void => {
	if (config.geminiApiKey === "") {
		throw new Error("GEMINI_API_KEY is required");
	}
};
