import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import Groq from "groq-sdk";

type GroqPlugin = {
	client: Groq;
	options: {
		modelDefault: string;
		apiKey: string;
	};
};

const groq: FastifyPluginAsync = async (fastify) => {
	const groqApiKey = process.env.GROQ_API_KEY?.trim();
	const groqModelDefault =
		process.env.GROQ_MODEL_DEFAULT?.trim() || "openai/gpt-oss-20b";

	if (!groqApiKey) {
		throw new Error("GROQ_API_KEY is required");
	}

	const groqClient = new Groq({ apiKey: groqApiKey });

	const groqPlugin: GroqPlugin = {
		client: groqClient,
		options: {
			modelDefault: groqModelDefault,
			apiKey: groqApiKey,
		},
	};

	fastify.decorate("groq", groqPlugin);
};

export default fp(groq);
export type { GroqPlugin };
