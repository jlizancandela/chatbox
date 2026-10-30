import { test } from "node:test";
import Fastify, { type FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type Groq from "groq-sdk";
import app from "../src/app";
import type { AppDependencies } from "../src/dependencies";
import type { EmbedContentFn } from "../src/services/embedding";
import { vectorOf } from "./vector";

export type TestContext = {
	after: typeof test.after;
};

/**
 * Construye la aplicación como en producción, pero con los proveedores que se le
 * pasen.
 *
 * El seam es el mismo que en `src/app.ts`: lo que no se pasa, se usa de verdad. Por
 * eso los tests de ruta pasan siempre los tres proveedores —base de datos,
 * generación y embeddings— y así la suite no toca la red ni gasta cuota.
 *
 * `fp(app)` es lo que hace el CLI (`skipOverride`): sin encapsular, los decoradores
 * quedan en la instancia que se devuelve y los tests pueden inspeccionarlos.
 */
export const build = async (
	t: TestContext,
	dependencies: AppDependencies = {},
): Promise<FastifyInstance> => {
	const instance = Fastify({ logger: false });

	await instance.register(fp(app), { dependencies });
	await instance.ready();

	// Tear down our app after we are done. Se devuelve la promesa para que el hook la
	// espere: si se descarta, un servidor que quedó escuchando mantiene vivo el proceso
	// y el archivo de test no termina nunca.
	t.after(() => instance.close());

	return instance;
};

export type SSEFrame = {
	event: string;
	data: unknown;
};

/** Trocea un cuerpo SSE en eventos, que es lo que devuelve `POST /api/chat`. */
export function parseSSE(payload: string): SSEFrame[] {
	const frames: SSEFrame[] = [];
	let current: { event?: string; data?: string } = {};

	for (const line of payload.split("\n")) {
		if (line === "") {
			if (current.event !== undefined && current.data !== undefined) {
				frames.push({
					event: current.event,
					data: JSON.parse(current.data),
				});
			}
			current = {};
			continue;
		}
		if (line.startsWith("event:")) current.event = line.slice(6).trim();
		else if (line.startsWith("data:")) current.data = line.slice(5).trim();
	}

	return frames;
}

export type FakeChunkRow = {
	document_id: string;
	chunk_index: number;
	title: string;
	content: string;
	distance: number;
};

/**
 * El fragmento que devuelve la base de datos de mentira.
 *
 * Antes de que existiera el seam esta fila salía de una búsqueda vectorial de verdad:
 * la suite gastaba cuota del proveedor y dependía de la red para poder afirmar nada.
 */
export const CHUNK: FakeChunkRow = {
	document_id: "1",
	chunk_index: 0,
	title: "Currículum",
	content: "Jorge es desarrollador full stack.",
	distance: 0.2,
};

/**
 * Una base de datos de mentira.
 *
 * `query` devuelve siempre las mismas filas: la búsqueda vectorial solo lee `rows`.
 * El resto del contrato de `PostgresDb` no está y el cast lo esconde a propósito: el
 * doble se reduce a `query`, que es lo único que usa la ruta. Si algún día se empieza
 * a usar `transact` o `pool`, el typecheck no lo verá —se declara completo con el
 * cast— pero el test fallará al ejecutarlo, que es donde importa.
 */
export const fakePg = (
	rows: FakeChunkRow[] = [],
): NonNullable<AppDependencies["pg"]> =>
	({
		query: async () => ({
			rows,
			rowCount: rows.length,
			command: "SELECT",
			oid: 0,
			fields: [],
		}),
	}) as unknown as NonNullable<AppDependencies["pg"]>;

/**
 * Un proveedor de embeddings de mentira.
 *
 * Devuelve siempre el mismo vector: lo que importa en los tests de ruta es que la
 * aplicación lo transporte hasta la base de datos, no lo que el proveedor devuelva.
 * Tiene la dimensión del esquema porque el servicio la comprueba antes de serializar.
 */
export const fakeEmbedContent = (
	values: number[] = vectorOf(),
): EmbedContentFn => {
	return async () => values;
};

export type FakeGroqOptions = {
	/** Pausa entre tokens, para que el stream dure lo que haga falta. */
	delayMs?: number;
	/** Falla al pedir la completación, como un proveedor que se cae. */
	failWith?: Error;
};

/**
 * Un cliente de Groq de mentira.
 *
 * Respeta la señal de aborto como el SDK real: al abortar, su stream lanza y el
 * `for await` de la ruta cae en el `catch`. Un doble que ignorase `signal`
 * devolvería la respuesta entera aunque el abort se hubiera disparado, y el test
 * pasaría con el fallo presente sin detectar nada (#93).
 *
 * `signal()` devuelve la señal que llegó al modelo: es lo que distingue "se canceló"
 * de "el cliente se fue y no llegó nada".
 */
export const fakeGroq = (
	tokens: string[] = [],
	{ delayMs = 0, failWith }: FakeGroqOptions = {},
): { client: Groq; signal: () => AbortSignal | undefined } => {
	let modelSignal: AbortSignal | undefined;

	const client = {
		chat: {
			completions: {
				create: async function* (
					_body: unknown,
					init?: { signal?: AbortSignal | null },
				) {
					modelSignal = init?.signal ?? undefined;

					if (failWith) {
						throw failWith;
					}

					for (const token of tokens) {
						if (delayMs > 0) {
							await new Promise((resolve) => setTimeout(resolve, delayMs));
						}

						if (init?.signal?.aborted) {
							throw Object.assign(new Error("The operation was aborted"), {
								name: "AbortError",
							});
						}

						yield { choices: [{ delta: { content: token } }] };
					}
				},
			},
		},
	} as unknown as Groq;

	return { client, signal: () => modelSignal };
};

/**
 * Los proveedores de mentira de siempre: sin base de datos, sin credenciales y sin
 * red. Cada test ajusta lo que necesita —las filas, los tokens— y lo que no, se
 * queda con estos.
 */
export const testDependencies = (
	overrides: Partial<AppDependencies> = {},
): AppDependencies => ({
	pg: fakePg([]),
	groqClient: fakeGroq([]).client,
	embedContent: fakeEmbedContent(),
	...overrides,
});
