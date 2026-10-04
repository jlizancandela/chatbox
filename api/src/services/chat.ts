import type Groq from "groq-sdk";
import {
	findChunksByEmbedding,
	type QueryClient,
} from "../repositories/documents";
import { chatConfig } from "./chat.config";
import { embeddingService } from "./embedding";

export type ChatSource = {
	documentId: string;
	chunkIndex: number;
	content: string;
	distance: number;
};

export type ChatEvent =
	| { type: "sources"; sources: ChatSource[] }
	| { type: "token"; token: string }
	| { type: "done" }
	| { type: "error"; message: string };

export type ChatMessage = {
	role: "system" | "user" | "assistant";
	content: string;
};

type CompletionChunk = {
	choices?: Array<{ delta?: { content?: string | null } }>;
};

type AskStreamDeps = {
	retrieve: (question: string) => Promise<ChatSource[]>;
	groqClient: Groq;
	modelDefault: string;
};

export type AskStreamOptions = {
	history: ChatMessage[];
	signal?: AbortSignal;
};

const GENERIC_ERROR_MESSAGE =
	"An unexpected error occurred while generating the answer";

const systemPrompt = (context: string): string =>
	`You are a helpful assistant that answers questions based only on the provided context. If the context does not contain the answer, say you do not know.\n\nContext:\n${context}`;

const mergeAdjacentRoles = (messages: ChatMessage[]): ChatMessage[] => {
	const merged: ChatMessage[] = [];

	for (const message of messages) {
		const previous = merged[merged.length - 1];

		if (previous && previous.role === message.role) {
			merged[merged.length - 1] = {
				role: previous.role,
				content: `${previous.content}\n\n${message.content}`,
			};
			continue;
		}

		merged.push({ ...message });
	}

	return merged;
};

export const buildChatMessages = (
	context: string,
	history: ChatMessage[],
	question: string,
): ChatMessage[] =>
	mergeAdjacentRoles([
		{ role: "system", content: systemPrompt(context) },
		...history,
		{ role: "user", content: question },
	]);

export const createAskStream =
	({ retrieve, groqClient, modelDefault }: AskStreamDeps) =>
	async function* askStream(
		question: string,
		options: AskStreamOptions,
	): AsyncIterable<ChatEvent> {
		const { history, signal } = options;

		let sources: ChatSource[];
		try {
			sources = await retrieve(question);
		} catch {
			yield { type: "error", message: GENERIC_ERROR_MESSAGE };
			return;
		}

		yield { type: "sources", sources };

		if (sources.length === 0) {
			yield { type: "done" };
			return;
		}

		const context = sources.map((source) => source.content).join("\n\n");

		try {
			const completion = (await groqClient.chat.completions.create(
				{
					model: modelDefault,
					stream: true,
					messages: buildChatMessages(context, history, question),
				},
				{ signal },
			)) as AsyncIterable<CompletionChunk>;

			for await (const chunk of completion) {
				const delta = chunk.choices?.[0]?.delta?.content;
				if (typeof delta === "string" && delta.length > 0) {
					yield { type: "token", token: delta };
				}
			}

			yield { type: "done" };
		} catch {
			if (signal?.aborted) {
				return;
			}
			yield { type: "error", message: GENERIC_ERROR_MESSAGE };
		}
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

		const sources: ChatSource[] = relevantChunks.map(
			(chunk: {
				document_id: string;
				chunk_index: number;
				content: string;
				distance: number;
			}) => ({
				documentId: chunk.document_id,
				chunkIndex: chunk.chunk_index,
				content: chunk.content,
				distance: chunk.distance,
			}),
		);

		return sources;
	};

	return {
		askStream: createAskStream({
			retrieve,
			groqClient,
			modelDefault,
		}),
		retrieve,
	};
};
