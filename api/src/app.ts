import { join } from "node:path";
import AutoLoad from "@fastify/autoload";
import type { FastifyPluginAsync } from "fastify";
import type { AppOptions } from "./dependencies";
import { loggerOptions } from "./plugins/logging";

/**
 * La aplicación se construye aquí, y aquí es donde se inyectan los proveedores de
 * fuera (base de datos, generación y embeddings).
 *
 * `opts.dependencies` es el **único** seam de la API: lo que se pase ahí sustituye a
 * los proveedores reales, y lo que no se pase los deja como estaban. Autoload reparte
 * estas mismas opciones a todos los plugins de `src/plugins` y a las rutas de
 * `src/routes`, así que no hay que cablear nada en otro sitio.
 *
 * Ver `src/dependencies.ts` para el contrato y `test/helper.ts` para cómo lo usan los
 * tests.
 */
const app: FastifyPluginAsync<AppOptions> = async (fastify, opts): Promise<void> => {
	// Do not touch the following lines

	// This loads all plugins defined in plugins
	// those should be support plugins that are reused
	// through your application
	// eslint-disable-next-line no-void
	void fastify.register(AutoLoad, {
		dir: join(__dirname, "plugins"),
		options: opts,
	});

	// This loads all plugins defined in routes
	// define your routes in this folder
	// eslint-disable-next-line no-void
	void fastify.register(AutoLoad, {
		dir: join(__dirname, "routes"),
		options: opts,
	});
};

export default app;
export type { AppDependencies, AppOptions } from "./dependencies";
export { app };

/**
 * El proxy de confianza.
 *
 * Detrás del proxy inverso, la IP que ve la aplicación es la del proxy: sin esto, todos
 * los visitantes comparten una clave de cuota y el límite por IP deja de distinguir a
 * nadie (#143).
 *
 * Se configura con la IP o el rango del proxy, **no** con un contador de saltos: un
 * cliente directo podría falsificar las cabeceras de reenvío. Sin valor configurado
 * —que es el caso en local— la aplicación no confía en ninguna cabecera y arranca
 * igual.
 */
export const trustProxyFrom = (env: NodeJS.ProcessEnv = process.env): string | undefined => {
	const configured = env.TRUST_PROXY?.trim();

	return configured !== undefined && configured.length > 0 ? configured : undefined;
};

const readPositiveInt = (env: NodeJS.ProcessEnv, key: string, fallback: number): number => {
	const raw = env[key];

	if (raw === undefined || raw.trim() === "") {
		return fallback;
	}

	const value = Number(raw);

	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${key} must be a positive integer`);
	}

	return value;
};

/**
 * Las opciones del servidor.
 *
 * `fastify-cli` las lee de aquí al construir la instancia, así que es el sitio donde se
 * configuran el logger (#146), la confianza en el proxy y los timeouts (#143).
 */
export const serverOptions = (env: NodeJS.ProcessEnv = process.env) => {
	const trustProxy = trustProxyFrom(env);

	return {
		logger: loggerOptions(env),
		// Los timeouts del framework valen 0, y su propia documentación advierte del
		// riesgo de denegación de servicio. Con un valor finito, una conexión que
		// envía el cuerpo a goteo se cierra en vez de retener un socket para siempre.
		requestTimeout: readPositiveInt(env, "REQUEST_TIMEOUT_MS", 30_000),
		connectionTimeout: readPositiveInt(env, "CONNECTION_TIMEOUT_MS", 10_000),
		...(trustProxy === undefined ? {} : { trustProxy }),
	};
};

export const options = serverOptions();
