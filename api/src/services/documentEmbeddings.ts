import type { DocumentChunk } from "../repositories/documents";
import { embeddingService, type EmbedContentFn } from "./embedding";

/**
 * Los embeddings de un documento.
 *
 * `embedContent` es el colaborador: si viene, se usa; si no, se carga el modelo local.
 * La ingesta lo cablea con el modelo de verdad y los tests con un doble.
 */
export const documentEmbeddingsService = (embedContent?: EmbedContentFn) => {
	const { embedText } = embeddingService(embedContent);

	const getDocumentEmbeddings = async (
		file: string,
		chunks: string[],
		title?: string,
	): Promise<DocumentChunk[]> => {
		const embeddedChunks: DocumentChunk[] = [];

		for (const [chunkIndex, text] of chunks.entries()) {
			const sqlEmbedding = await embedText(text, {
				purpose: "document",
				title,
				context: `chunk ${chunkIndex} of file: ${file}`,
			});
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
