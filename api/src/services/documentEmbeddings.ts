import type { DocumentChunk } from "../repositories/documents";
import { embeddingService } from "./embedding";

export const documentEmbeddingsService = () => {
	const { embedText } = embeddingService();

	const getDocumentEmbeddings = async (
		file: string,
		chunks: string[],
	): Promise<DocumentChunk[]> => {
		const embeddedChunks: DocumentChunk[] = [];

		for (const [chunkIndex, text] of chunks.entries()) {
			const sqlEmbedding = await embedText(
				text,
				`chunk ${chunkIndex} of file: ${file}`,
			);
			embeddedChunks.push({
				chunkIndex,
				text,
				embedding: sqlEmbedding,
			});
		}

		return embeddedChunks;
	};
	return { getDocumentEmbeddings };
};
