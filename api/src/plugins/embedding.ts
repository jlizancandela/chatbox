import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import type { AppOptions } from "../dependencies";
import { embeddingService } from "../services/embedding";

type EmbeddingPlugin = ReturnType<typeof embeddingService>;

/**
 * El proveedor de embeddings.
 *
 * Con `dependencies.embedContent` se decora la instancia con esa llamada y no hace
 * falta ninguna credencial: es lo que usan los tests para no llamar a Gemini. Sin
 * ella, hace falta `GEMINI_API_KEY` y se construye el cliente de verdad.
 *
 * El decorador es el que usan las rutas: el servicio de embedding deja de construirse
 * dentro del handler y llega ya montado. La ingesta no pasa por aquí: construye el
 * servicio con el colaborador por defecto, que es el real.
 */
const embedding: FastifyPluginAsync<AppOptions> = async (fastify, opts) => {
	fastify.decorate(
		"embedding",
		embeddingService(opts.dependencies?.embedContent),
	);
};

export default fp(embedding);
export type { EmbeddingPlugin };

declare module "fastify" {
	export interface FastifyInstance {
		embedding: EmbeddingPlugin;
	}
}
