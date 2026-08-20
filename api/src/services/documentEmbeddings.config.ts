export type DocumentEmbeddingsConfig = {
	geminiApiKey: string;
	geminiEmbeddingModel: string;
	geminiVectorDimension: number;
};

export const documentEmbeddingsConfig: DocumentEmbeddingsConfig = {
	geminiApiKey: process.env.GEMINI_API_KEY ?? "",
	geminiEmbeddingModel:
		process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001",
	geminiVectorDimension: parseInt(
		process.env.GEMINI_VECTOR_DIMENSION ?? "0",
		10,
	),
};

if (
	Number.isNaN(documentEmbeddingsConfig.geminiVectorDimension) ||
	documentEmbeddingsConfig.geminiVectorDimension <= 0
) {
	throw new Error("GEMINI_VECTOR_DIMENSION must be a positive integer");
}

if (documentEmbeddingsConfig.geminiApiKey === "") {
	throw new Error("GEMINI_API_KEY is required");
}
