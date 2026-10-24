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

export const embeddingConfig: EmbeddingConfig = {
	geminiApiKey: process.env.GEMINI_API_KEY ?? "",
	geminiEmbeddingModel:
		process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001",
	geminiVectorDimension: parseInt(
		process.env.GEMINI_VECTOR_DIMENSION ?? "0",
		10,
	),
};

/**
 * Identifica la configuración que produce los embeddings. Forma parte de la versión
 * de los documentos: cambiarla invalida el corpus y obliga a reingerirlo.
 */
export const embeddingSignature = `${embeddingConfig.geminiEmbeddingModel}:${embeddingConfig.geminiVectorDimension}:${EMBEDDING_TASK.document}`;

if (
	Number.isNaN(embeddingConfig.geminiVectorDimension) ||
	embeddingConfig.geminiVectorDimension <= 0
) {
	throw new Error("GEMINI_VECTOR_DIMENSION must be a positive integer");
}

if (embeddingConfig.geminiApiKey === "") {
	throw new Error("GEMINI_API_KEY is required");
}
