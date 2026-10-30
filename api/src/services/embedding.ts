import { GoogleGenAI } from "@google/genai";
import pgvector from "pgvector/pg";
import {
	EMBEDDING_TASK,
	assertEmbeddingConfig,
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

export type EmbedTextFn = (
	text: string,
	options: EmbedTextOptions,
) => Promise<string>;

/**
 * La llamada al proveedor real de embeddings.
 *
 * Solo se construye cuando no se inyecta otra: un test que doble el proveedor no
 * necesita credenciales, y una aplicación en producción sí.
 */
const createRealEmbedContent = (): EmbedContentFn => {
	assertEmbeddingConfig();

	const genAI = new GoogleGenAI({ apiKey: embeddingConfig.geminiApiKey });

	return (params: EmbedContentParams) => genAI.models.embedContent(params);
};

/**
 * El servicio de embeddings.
 *
 * `embedContent` es el colaborador: si viene, se usa; si no, se construye el cliente
 * de verdad. Quien lo llama decide — la aplicación lo decora en la instancia, la
 * ingesta lo cablea en el CLI— y así el servicio no sabe nada de quién lo usa.
 */
export const embeddingService = (embedContent?: EmbedContentFn) => {
	const embed = embedContent ?? createRealEmbedContent();

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
