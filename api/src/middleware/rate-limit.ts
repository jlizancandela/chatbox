import rateLimit from "@fastify/rate-limit";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

export const BURST_MAX = 20;
export const BURST_WINDOW = "1 minute";
export const DAILY_MAX = 100;
export const DAILY_WINDOW = "1 day";

/**
 * El tope global: turnos diarios de **todos** los visitantes sumados.
 *
 * El límite por IP no protege contra la rotación de IPs, y la cuota del proveedor es
 * global: un atacante con varias IPs agota el día para todos (#143).
 *
 * El valor sale de la cuota real medida del proveedor: unos 100 turnos diarios con el
 * historial completo y unos 250 con el caché caliente. Se queda en 250, que es el
 * orden de magnitud con la caché — el caso bueno — y corta antes de que la cuota se
 * agote de verdad.
 */
export const GLOBAL_MAX = 250;
export const GLOBAL_WINDOW = "1 day";

export type RateLimitConfig = {
	burstMax: number;
	burstWindow: number | string;
	dailyMax: number;
	dailyWindow: number | string;
	globalMax: number;
	globalWindow: number | string;
};

export const defaultRateLimitConfig: RateLimitConfig = {
	burstMax: BURST_MAX,
	burstWindow: BURST_WINDOW,
	dailyMax: DAILY_MAX,
	dailyWindow: DAILY_WINDOW,
	globalMax: GLOBAL_MAX,
	globalWindow: GLOBAL_WINDOW,
};

/** Cuál de los tres límites se ha superado. */
export type RateLimitOutcome = "none" | "burst" | "daily" | "global";

/**
 * Los tres límites.
 *
 * Registrar el plugin dos veces en el mismo ámbito **no** los encadena: el segundo
 * registro sustituye al primero, así que la ráfaga nunca llegó a aplicarse (#143).
 * La API manual del plugin sí permite tener varios: cada `createRateLimit` es un
 * contador propio.
 *
 * La comprobación correcta es la **marca de exceso** (`isExceeded`), no la de exclusión:
 * con la de exclusión se rechazan todas las peticiones —medido: 0 aceptadas de 25—,
 * y con la de exceso, 20 aceptadas y 5 rechazadas con límite 20.
 *
 * El middleware **no** añade un hook: los límites son para las peticiones que cuestan
 * tokens, no para el `health check` ni para la raíz. Un hook global cortaría también las
 * comprobaciones de salud (#143). En su lugar, el middleware **decora** la instancia con
 * `checkRateLimits` y es la ruta de `/api/chat` la que lo llama: la protección queda
 * donde tiene que estar, y solo en las peticiones que la necesitan.
 */
export const createRateLimitMiddleware = (
	config: RateLimitConfig = defaultRateLimitConfig
): FastifyPluginAsync =>
	fp(async (fastify) => {
		await fastify.register(rateLimit, {
			global: false,
			max: config.burstMax,
			timeWindow: config.burstWindow,
		});

		const checkBurst = fastify.createRateLimit({
			max: config.burstMax,
			timeWindow: config.burstWindow,
		});

		const checkDaily = fastify.createRateLimit({
			max: config.dailyMax,
			timeWindow: config.dailyWindow,
		});

		/**
		 * El tope global cuenta **todos** los turnos, los de quien sea.
		 *
		 * La clave es una constante, no la IP: por eso es global. Y por eso el tope
		 * global corta con su propio código, para que el visitante distinga "se acabó
		 * el día" de "se acabó tu conversación" (#143, #148).
		 */
		const checkGlobal = fastify.createRateLimit({
			max: config.globalMax,
			timeWindow: config.globalWindow,
			keyGenerator: () => "global",
		});

		/**
		 * Comprueba los tres límites y deja las cabeceras del límite en la respuesta.
		 *
		 * Las cabeceras las pone el plugin solo cuando actúa globalmente. Con
		 * `global: false` hay que escribirlas a mano, y son parte del contrato: el
		 * cliente tiene que poder ver cuánto le queda (#143).
		 */
		fastify.decorate(
			"checkRateLimits",
			async (request: FastifyRequest, reply: FastifyReply): Promise<RateLimitOutcome> => {
				const burst = await checkBurst(request);
				const daily = await checkDaily(request);
				const global = await checkGlobal(request);

				const burstExceeded = !burst.isAllowed && burst.isExceeded;
				const dailyExceeded = !daily.isAllowed && daily.isExceeded;
				const globalExceeded = !global.isAllowed && global.isExceeded;

				if (burstExceeded || dailyExceeded || globalExceeded) {
					const exceeded = globalExceeded ? global : burstExceeded ? burst : daily;

					// El tipo del plugin es una unión: la parte "permitida" no expone los
					// campos del límite. Aquí solo se llega con la parte "excedida".
					const limit = exceeded as {
						max: number;
						remaining: number;
						ttlInSeconds: number;
					};

					reply.header("x-ratelimit-limit", String(limit.max));
					reply.header("x-ratelimit-remaining", String(limit.remaining));
					reply.header("x-ratelimit-reset", String(limit.ttlInSeconds));
					reply.header("retry-after", String(limit.ttlInSeconds));

					if (globalExceeded) {
						return "global";
					}

					return dailyExceeded ? "daily" : "burst";
				}

				const remaining =
					burst.isAllowed && daily.isAllowed
						? Math.min(config.burstMax - 1, config.dailyMax - 1)
						: 0;

				reply.header("x-ratelimit-limit", String(config.burstMax));
				reply.header("x-ratelimit-remaining", String(remaining));
				reply.header("x-ratelimit-reset", String(windowSeconds(config.burstWindow)));

				return "none";
			}
		);
	});

const windowSeconds = (window: number | string): number =>
	typeof window === "number" ? Math.ceil(window / 1000) : 60;

const rateLimitMiddleware: FastifyPluginAsync = createRateLimitMiddleware();

export default rateLimitMiddleware;

declare module "fastify" {
	export interface FastifyInstance {
		/**
		 * Comprueba los tres límites de la petición y dice cuál se ha superado, para que
		 * la respuesta distinga la ráfaga, el diario y el tope global (#143).
		 */
		checkRateLimits: (request: FastifyRequest, reply: FastifyReply) => Promise<RateLimitOutcome>;
	}
}
