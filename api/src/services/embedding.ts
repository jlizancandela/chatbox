import { GoogleGenAI } from "@google/genai";
import pgvector from "pgvector/pg";
import {
	EMBEDDING_TASK,
	embeddingConfig,
	type EmbedPurpose,
} from "./embedding.config";

export type EmbedContentParams = {
	model: string;
	contents: string;
	config: {
		outputDimensionality: number;
		taskType: string;
		title?: string;
	};
};

export type EmbedContentResponse = {
	embeddings?: Array<{ values?: number[] }>;
};

export type EmbedContentFn = (
	params: EmbedContentParams,
) => Promise<EmbedContentResponse>;

export type EmbedTextOptions = {
	purpose: EmbedPurpose;
	title?: string;
	context?: string;
};

export const embeddingService = (embedContent?: EmbedContentFn) => {
	const genAI = new GoogleGenAI({ apiKey: embeddingConfig.geminiApiKey });
	const embed =
		embedContent ??
		((params: EmbedContentParams) => genAI.models.embedContent(params));

	const embedText = async (
		text: string,
		options: EmbedTextOptions,
	): Promise<string> => {
		const response = await embed({
			model: embeddingConfig.geminiEmbeddingModel,
			contents: text,
			config: {
				outputDimensionality: embeddingConfig.geminiVectorDimension,
				taskType: EMBEDDING_TASK[options.purpose],
				...(options.title ? { title: options.title } : {}),
			},
		});

		const embedding = response.embeddings?.[0]?.values;
		if (!embedding) {
			throw new Error(
				`No embedding generated for ${options.context ?? options.purpose}`,
			);
		}

		const sqlEmbedding = pgvector.toSql(embedding);
		if (!sqlEmbedding) {
			throw new Error(`Could not serialize embedding for ${options.purpose}`);
		}

		return sqlEmbedding;
	};

	return { embedText };
};
