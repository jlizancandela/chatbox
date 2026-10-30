import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import type { AppOptions } from "../dependencies";
import { embeddingService } from "../services/embedding";

type EmbeddingPlugin = ReturnType<typeof embeddingService>;

/**
 * El proveedor de embeddings.
 *
 * Con `dependencies.embedContent` se decora la instancia con esa función y no hace
 * falta modelo: es lo que usan los tests para no cargar ONNX.
 *
 * Sin ella se carga EmbeddingGemma en el proceso. El registro espera a que el modelo
 * esté listo, así que la aplicación no empieza a escuchar hasta que puede embeber: no
 * hay tráfico servido a medias.
 *
 * La ingesta no pasa por aquí: construye el servicio con el colaborador por defecto.
 */
const embedding: FastifyPluginAsync<AppOptions> = async (fastify, opts) => {
	const service = embeddingService(opts.dependencies?.embedContent);

	fastify.decorate("embedding", service);
	await service.ready;
};

export default fp(embedding);
export type { EmbeddingPlugin };

declare module "fastify" {
	export interface FastifyInstance {
		embedding: EmbeddingPlugin;
	}
}
