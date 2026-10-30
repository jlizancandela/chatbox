import cors from "@fastify/cors";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

/**
 * Los orígenes permitidos.
 *
 * `CORS_ORIGIN` admite **varios** orígenes separados por comas: el sitio real donde se
 * publica el widget y, en desarrollo, el servidor de Vite. Lo que no vale es el origen
 * de desarrollo en producción: con ese valor, las peticiones del sitio real no
 * reciben la cabecera de permiso y el widget no funciona (#143).
 */
export const corsOrigins = (env: NodeJS.ProcessEnv = process.env): string[] =>
	(env.CORS_ORIGIN ?? "")
		.split(",")
		.map((origin) => origin.trim())
		.filter((origin) => origin.length > 0);

const corsPlugin: FastifyPluginAsync = async (fastify) => {
	const origins = corsOrigins();

	if (origins.length === 0) {
		throw new Error("CORS_ORIGIN must be configured");
	}

	await fastify.register(cors, {
		origin: origins,
		// Un origen permitido recibe su propia cabecera, no `*`: el widget lleva
		// credenciales y `*` no vale con ellas.
		credentials: true,
	});
};

export default fp(corsPlugin);
