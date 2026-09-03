import { GoogleGenAI } from "@google/genai";
import pgvector from "pgvector/pg";
import { embeddingConfig } from "./embedding.config";

export const embeddingService = () => {
	const genAI = new GoogleGenAI({
		apiKey: embeddingConfig.geminiApiKey,
	});

	const embedText = async (text: string, context = "text"): Promise<string> => {
		const response = await genAI.models.embedContent({
			model: embeddingConfig.geminiEmbeddingModel,
			contents: text,
			config: {
				outputDimensionality: embeddingConfig.geminiVectorDimension,
			},
		});

		const embedding = response.embeddings?.[0]?.values;
		if (!embedding) {
			throw new Error(`No embedding generated for ${context}`);
		}

		const sqlEmbedding = pgvector.toSql(embedding);
		if (!sqlEmbedding) {
			throw new Error(`Could not serialize embedding for ${context}`);
		}

		return sqlEmbedding;
	};

	return { embedText };
};
