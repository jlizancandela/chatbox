import type { Chunk } from "@chonkiejs/core";
import { GoogleGenAI } from "@google/genai";
import pgvector from "pgvector/pg";

type DocumentChunk = {
	chunkIndex: number;
	text: string;
	embedding: string;
};

export const documentEmbeddingsService = () => {
	const genAI = new GoogleGenAI({
		apiKey: process.env.GEMINI_API_KEY || "",
	});

	const getDocumentEmbeddings = async (
		file: string,
		chunks: Chunk[],
	): Promise<DocumentChunk[]> => {
		const embeddedChunks: DocumentChunk[] = [];

		for (const [chunkIndex, chunk] of chunks.entries()) {
			const response = await genAI.models.embedContent({
				model: "gemini-embedding-001",
				contents: chunk.text,
				config: {
					outputDimensionality: 768,
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
