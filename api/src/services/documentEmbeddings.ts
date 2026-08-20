import type { Chunk } from "@chonkiejs/core";
import { GoogleGenAI } from "@google/genai";
import pgvector from "pgvector/pg";
import { documentEmbeddingsConfig } from "./documentEmbeddings.config";

type DocumentChunk = {
	chunkIndex: number;
	text: string;
	embedding: string;
};

export const documentEmbeddingsService = () => {
	const genAI = new GoogleGenAI({
		apiKey: documentEmbeddingsConfig.geminiApiKey,
	});

	const getDocumentEmbeddings = async (
		file: string,
		chunks: Chunk[],
	): Promise<DocumentChunk[]> => {
		const embeddedChunks: DocumentChunk[] = [];

		for (const [chunkIndex, chunk] of chunks.entries()) {
			const response = await genAI.models.embedContent({
				model: documentEmbeddingsConfig.geminiEmbeddingModel,
				contents: chunk.text,
				config: {
					outputDimensionality: documentEmbeddingsConfig.geminiVectorDimension,
				},
			});
			const embedding = response.embeddings?.[0]?.values;
			if (!embedding) {
				throw new Error(
					`No embedding generated for chunk ${chunkIndex} of file: ${file}`,
				);
			}
			const sqlEmbedding = pgvector.toSql(embedding);
			if (!sqlEmbedding) {
				throw new Error(
					`Could not serialize embedding for chunk ${chunkIndex} of file: ${file}`,
				);
			}
			embeddedChunks.push({
				chunkIndex,
				text: chunk.text,
				embedding: sqlEmbedding,
			});
		}

		return embeddedChunks;
	};
	return { getDocumentEmbeddings };
};
