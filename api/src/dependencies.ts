import type { AutoloadPluginOptions } from "@fastify/autoload";
import type { PostgresDb } from "@fastify/postgres";
import type { FastifyServerOptions } from "fastify";
import type Groq from "groq-sdk";
import type { EmbedContentFn } from "./services/embedding";

/**
 * Los proveedores de la aplicación: base de datos, generación y embeddings. Los
 * embeddings corren en el proceso; el seam existe para inyectar un doble en tests.
 *
 * Este es **el** punto de inyección de la API. Los plugins de `src/plugins` leen estas
 * dependencias de las opciones de construcción y las decoran en la instancia; las
 * rutas y los servicios usan siempre los decoradores, nunca al proveedor real.
 *
 * Ausentes —que es lo que pasa en producción— se usan los proveedores de verdad: la
 * aplicación se comporta como siempre y no hay que tocar nada. Presentes, se usan
 * esos: es lo que permite que la suite corra sin red y sin credenciales.
 *
 * El seam está en la **construcción** de la aplicación, no en cada servicio: así el
 * cableado de los dobles se escribe una vez (en el helper de los tests) y no se
 * repite en cada test.
 */
export type AppDependencies = {
	/** La base de datos. Sustituye a `@fastify/postgres`. */
	pg?: PostgresDb & Record<string, PostgresDb>;
	/** El cliente de generación. Sustituye al de `groq-sdk`. */
	groqClient?: Groq;
	/** El proveedor de embeddings. Sustituye a EmbeddingGemma en proceso. */
	embedContent?: EmbedContentFn;
};

export interface AppOptions
	extends FastifyServerOptions,
		Partial<AutoloadPluginOptions> {
	dependencies?: AppDependencies;
}
