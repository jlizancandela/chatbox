import type { FastifyPluginAsync } from "fastify";

const root: FastifyPluginAsync = async (fastify): Promise<void> => {
	fastify.get("/", async () => ({ root: true }));

	// La API solo empieza a escuchar cuando el modelo de embeddings está cargado
	// (ver `plugins/embedding.ts`), así que este endpoint no puede responder antes.
	fastify.get("/health", async () => ({ status: "ok" }));
};

export default root;
