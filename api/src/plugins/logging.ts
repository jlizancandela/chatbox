import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import type { AppOptions } from "../dependencies";
import {
	type ConsumptionTrace,
	type FailureTrace,
	type Logger,
	REQUEST_ID_HEADER,
	type RequestTrace,
	requestIdOf,
	resolveLogLevel,
} from "../infrastructure/logging";

/**
 * El logger de la aplicación.
 *
 * Fastify ya trae Pino: activarlo con opciones es configurarlo, no montar nada
 * (#146). El nivel viene del entorno y su valor por defecto es `info`.
 */
export const loggerOptions = (env: NodeJS.ProcessEnv = process.env) => ({
	level: resolveLogLevel(env.LOG_LEVEL),
});

/**
 * La traza de una petición que terminó.
 *
 * Sin cuerpo, sin historial y sin contenido del corpus: método, ruta, código de
 * estado y duración. Es lo justo para distinguir "lento" de "roto" (#146).
 */
export const requestTrace = (
	request: { method: string; url: string },
	requestId: string,
	statusCode: number,
	elapsed: number
): RequestTrace => ({
	requestId,
	method: request.method,
	url: request.url,
	statusCode,
	durationMs: Math.round(elapsed),
});

/**
 * El identificador de correlación y la traza de cada petición.
 *
 * El identificador lo genera el servidor y viaja en la cabecera `x-request-id`, de
 * modo que la traza del servidor y la del cliente se emparejen. Si el cliente ya
 * envía uno, se respeta (#146).
 */
const logging: FastifyPluginAsync<AppOptions> = async (fastify, opts) => {
	const injected = opts.dependencies?.logger;

	fastify.addHook("onRequest", async (request, reply) => {
		const requestId = requestIdOf(request.headers[REQUEST_ID_HEADER]);

		(request as { id: string }).id = requestId;
		reply.header(REQUEST_ID_HEADER, requestId);
	});

	fastify.addHook("onResponse", async (request, reply) => {
		const trace = requestTrace(request, request.id, reply.statusCode, reply.elapsedTime);

		if (injected) {
			injected.request(trace);
			return;
		}

		request.log.info({ ...trace, msg: "request completed" });
	});

	/**
	 * El logger para los servicios.
	 *
	 * Un fallo de generación dentro de un stream no pasa por el manejador de errores
	 * de Fastify —la respuesta ya empezó—, así que se registra donde se clasifica
	 * (#146).
	 */
	const logger: Logger = {
		request: (trace) => {
			if (injected) {
				injected.request(trace);
				return;
			}

			fastify.log.info({ ...trace, msg: "request completed" });
		},
		consumption: (usage: ConsumptionTrace) => {
			if (injected) {
				injected.consumption(usage);
				return;
			}

			fastify.log.info({ ...usage, msg: "turn consumed" });
		},
		failure: (failure: FailureTrace) => {
			if (injected) {
				injected.failure(failure);
				return;
			}

			fastify.log.warn({ ...failure, msg: "failure" });
		},
	};

	fastify.decorate("logger", logger);
};

export default fp(logging);
export type { Logger };

declare module "fastify" {
	export interface FastifyInstance {
		logger: Logger;
	}
}
