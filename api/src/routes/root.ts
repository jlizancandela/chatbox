import type { FastifyPluginAsync } from "fastify";

const root: FastifyPluginAsync = async (fastify): Promise<void> => {
	fastify.get("/", async () => ({ root: true }));

	fastify.get("/health", async () => ({ status: "ok" }));
};

export default root;
