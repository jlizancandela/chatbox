/**
 * El guardián de red de la suite.
 *
 * Los tests no hablan con el exterior: ni con Gemini, ni con Groq. Este módulo se
 * carga **antes** de cada archivo de test (`-r ./test/setup.ts`) y convierte `fetch`
 * en una puerta que solo se abre al bucle local: el proveedor se inyecta por el seam
 * de la aplicación, no se alcanza por la red.
 *
 * Esto vale por dos cosas a la vez: un test al que se le olvide un doble falla al
 * instante y con un mensaje claro —en vez de quedarse colgado hasta que la red
 * agota el tiempo— y la suite no gasta la cuota del proveedor.
 *
 * Se vigila `fetch` porque por ahí piden los dos SDK que usamos —Gemini y Groq—, que
 * capturan la función global al construir el cliente. Un transporte distinto sería
 * invisible para este guardián.
 *
 * `API_TEST_ALLOW_NETWORK=1` lo desactiva para quien necesite hablar con el
 * proveedor de verdad a propósito.
 */

const LOOPBACK_HOSTS = new Set([
	"localhost",
	"127.0.0.1",
	"::1",
	"[::1]",
	"0.0.0.0",
]);

const urlOf = (input: unknown): string | undefined => {
	if (typeof input === "string") return input;
	if (input instanceof URL) return input.href;
	const url = (input as { url?: unknown } | undefined)?.url;
	return typeof url === "string" ? url : undefined;
};

const hostOf = (url: string | undefined): string | undefined => {
	if (url === undefined) return undefined;

	try {
		return new URL(url).hostname;
	} catch {
		return undefined;
	}
};

if (process.env.API_TEST_ALLOW_NETWORK !== "1") {
	const originalFetch = globalThis.fetch;

	globalThis.fetch = ((input: unknown, init?: unknown) => {
		const url = urlOf(input);
		const host = hostOf(url);

		if (host === undefined || !LOOPBACK_HOSTS.has(host)) {
			const reason = `Network access is blocked in the test suite (${url ?? "unknown url"}). Inyecta el proveedor por el seam de la aplicación (dependencies).`;

			// El cliente de la ruta nunca ve este mensaje: el servicio lo convierte en un
			// error genérico. Se escribe aquí para que, cuando un test se olvide de un
			// doble, el fallo señale la causa y no un `timeout` de red.
			console.error(reason);

			throw new Error(reason);
		}

		return originalFetch(input as never, init as never);
	}) as typeof fetch;
}
