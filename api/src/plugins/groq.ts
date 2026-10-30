import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import Groq from "groq-sdk";
import type { AppOptions } from "../dependencies";

type GroqPlugin = {
	client: Groq;
	options: {
		modelDefault: string;
	};
};

/**
 * El proveedor de generación.
 *
 * Con `dependencies.groqClient` se decora la instancia con ese cliente y no hace
 * falta ninguna credencial: es lo que usan los tests para no llamar a Groq. Sin él,
 * hace falta `GROQ_API_KEY` y se construye el cliente de verdad.
 */
const groq: FastifyPluginAsync<AppOptions> = async (fastify, opts) => {
	const injected = opts.dependencies?.groqClient;
	const groqModelDefault =
		process.env.GROQ_MODEL_DEFAULT?.trim() || "openai/gpt-oss-20b";

	let client: Groq;

	if (injected) {
		client = injected;
	} else {
		const apiKey = process.env.GROQ_API_KEY?.trim();

		if (!apiKey) {
			throw new Error("GROQ_API_KEY is required");
		}

		client = new Groq({ apiKey });
	}

	const groqPlugin: GroqPlugin = {
		client,
		options: {
			modelDefault: groqModelDefault,
		},
	};

	fastify.decorate("groq", groqPlugin);
};

export default fp(groq);
export type { GroqPlugin };

declare module "fastify" {
	export interface FastifyInstance {
		groq: GroqPlugin;
	}
}
