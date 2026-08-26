import { GoogleGenAI } from "@google/genai";
import pgvector from "pgvector/pg";
import type { DocumentChunk } from "../repositories/documents";
import { documentEmbeddingsConfig } from "./documentEmbeddings.config";

export const documentEmbeddingsService = () => {
	const genAI = new GoogleGenAI({
		apiKey: documentEmbeddingsConfig.geminiApiKey,
	});

	const getDocumentEmbeddings = async (
		file: string,
		chunks: string[],
	): Promise<DocumentChunk[]> => {
		const embeddedChunks: DocumentChunk[] = [];

		for (const [chunkIndex, text] of chunks.entries()) {
			const response = await genAI.models.embedContent({
				model: documentEmbeddingsConfig.geminiEmbeddingModel,
				contents: text,
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
				text,
				embedding: sqlEmbedding,
			});
		}

		return embeddedChunks;
	};
	return { getDocumentEmbeddings };
};
