import type { FastifyPluginAsync } from "fastify";
import { findChunksByEmbedding } from "../../repositories/documents";
import { embeddingService } from "../../services/embedding";

// TODO: refactorizar la orquestación del pipeline RAG (embed → búsqueda →
// ensamblado de contexto → generación) a un service layer (ej. chatService),
// moviendo el umbral de similitud y la construcción de la respuesta fuera del handler.
const SIMILARITY_THRESHOLD = 0.5;

const chatOptions = {
	schema: {
		body: {
			type: "object",
			required: ["question"],
			additionalProperties: false,
			properties: {
				question: {
					type: "string",
					minLength: 1,
				},
			},
		},
	},
};

const api: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
	fastify.post("/chat", chatOptions, async (request, reply) => {
		const { question } = request.body as { question: string };

		if (question.trim().length === 0 || question.trim().length > 1000) {
			return reply.code(400).send({
				error: {
					code: "INVALID_QUESTION",
					message: "Question must be between 1 and 1000 characters long.",
				},
			});
		}

		const { embedText } = embeddingService();
		const sqlEmbedding = await embedText(question, "question");
		const relevantChunks = await findChunksByEmbedding(
			fastify.pg,
			sqlEmbedding,
			SIMILARITY_THRESHOLD,
			5,
		);

		const sources = relevantChunks.map((chunk) => ({
			documentId: chunk.document_id,
			chunkIndex: chunk.chunk_index,
			content: chunk.content,
			distance: chunk.distance,
		}));

		if (sources.length === 0) {
			return reply.send({
				answer: null,
				sources,
				insufficientContext: true,
			});
		}

		const context = sources.map((source) => source.content).join("\n\n");

		const completion = await fastify.groq.client.chat.completions.create({
			model: fastify.groq.options.modelDefault,
			messages: [
				{
					role: "system",
					content: `You are a helpful assistant that answers questions based only on the provided context. If the context does not contain the answer, say you do not know.\n\nContext:\n${context}`,
				},
				{ role: "user", content: question },
			],
		});

		const answer = completion.choices[0]?.message?.content ?? "";

		return reply.send({
			answer,
			sources,
			insufficientContext: false,
		});
	});
};

export default api;
