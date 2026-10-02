import type Groq from "groq-sdk";
import {
	findChunksByEmbedding,
	type QueryClient,
} from "../repositories/documents";
import { chatConfig } from "./chat.config";
import { embeddingService } from "./embedding";

type ChatSource = {
	documentId: string;
	chunkIndex: number;
	content: string;
	distance: number;
};

type ChatResult = {
	answer: string | null;
	sources: ChatSource[];
	insufficientContext: boolean;
};

export const chatService = (
	pg: QueryClient,
	groqClient: Groq,
	modelDefault: string,
) => {
	const retrieve = async (question: string): Promise<ChatSource[]> => {
		const { embedText } = embeddingService();
		const sqlEmbedding = await embedText(question, "question");

		const relevantChunks = await findChunksByEmbedding(
			pg,
			sqlEmbedding,
			chatConfig.similarityThreshold,
			5,
		);

		const sources: ChatSource[] = relevantChunks.map((chunk) => ({
			documentId: chunk.document_id,
			chunkIndex: chunk.chunk_index,
			content: chunk.content,
			distance: chunk.distance,
		}));

		return sources;
	};

	const ask = async (question: string): Promise<ChatResult> => {
		const sources = await retrieve(question);

		if (sources.length === 0) {
			return { answer: null, sources, insufficientContext: true };
		}

		const context = sources.map((source) => source.content).join("\n\n");

		const completion = await groqClient.chat.completions.create({
			model: modelDefault,
			messages: [
				{
					role: "system",
					content: `You are a helpful assistant that answers questions based only on the provided context. If the context does not contain the answer, say you do not know.\n\nContext:\n${context}`,
				},
				{ role: "user", content: question },
			],
		});

		const answer = completion.choices[0]?.message?.content ?? "";

		return { answer, sources, insufficientContext: false };
	};

	return { ask, retrieve };
};
