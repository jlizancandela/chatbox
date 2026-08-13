import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import {
	documentIdParamsSchema,
	documentSchema,
	newDocumentSchema,
} from "../schemas/documents";

const schemas: FastifyPluginAsync = async (fastify) => {
	for (const schema of [
		documentSchema,
		newDocumentSchema,
		documentIdParamsSchema,
	]) {
		fastify.addSchema(schema);
	}
};

export default fp(schemas);
