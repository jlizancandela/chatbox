import assert from "node:assert";
import { test } from "node:test";
import { build, fakeEmbedContent, fakePg } from "./helper";

/**
 * La hermeticidad, comprobada.
 *
 * La suite corre con un guardián que cierra `fetch` a todo lo que no sea el bucle
 * local (`test/setup.ts`, cargado con `-r` en el comando de test). Estos dos tests son
 * la prueba de que la red no está a mano: uno comprueba que el guardián corta, y el
 * otro que quitarle el doble a un test de ruta lo devuelve al proveedor de verdad.
 *
 * Si alguien quita el guardián del comando de test, el primero falla. Sin él, quitarle
 * el doble a un test lo mandaría a la red sin que nadie se enterase.
 */

const withoutGroqKey = async (body: () => Promise<void>): Promise<void> => {
	const previous = process.env.GROQ_API_KEY;
	delete process.env.GROQ_API_KEY;

	try {
		await body();
	} finally {
		if (previous !== undefined) {
			process.env.GROQ_API_KEY = previous;
		}
	}
};

test("la suite no puede llamar a un proveedor por la red", async () => {
	const attempt = () =>
		new Promise((resolve, reject) => {
			try {
				resolve(fetch("https://example.invalid/v1/models"));
			} catch (error) {
				reject(error);
			}
		});

	await assert.rejects(attempt, /Network access is blocked in the test suite/);
});

test("sin el doble, un test de ruta necesita las credenciales del proveedor", async (t) => {
	// Al quitar el cliente de Groq, la aplicación construye el real y, sin clave, se
	// niega a arrancar: el fallo dice por qué, no un `timeout` de red. Con el doble
	// puesto —que es como corre el resto de la suite— no hace falta ninguna credencial.
	await withoutGroqKey(async () => {
		await assert.rejects(
			build(t, { pg: fakePg([]), embedContent: fakeEmbedContent() }),
			/GROQ_API_KEY is required/
		);
	});
});
