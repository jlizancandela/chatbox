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
	// define your routes in one of these
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
 * Las opciones del servidor.
 *
 * `fastify-cli` las lee de aquí al construir la instancia, así que es el sitio donde
 * se configura el logger: sin esto, el servidor no registra nada (#146).
 */
export const options = {
	logger: loggerOptions(),
};
