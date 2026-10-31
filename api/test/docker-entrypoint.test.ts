import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

/**
 * El contenedor arranca con `fastify start`, y esa orden tiene que llevar `--options`.
 *
 * Sin la marca, `fastify-cli` **ignora** el `options` que exporta `app.ts`: el nivel de
 * log, `requestTimeout`, `connectionTimeout` y `trustProxy` no se aplican, y el
 * servidor arranca igual. Es una falta que no se nota hasta que hace falta un timeout
 * o se busca una traza que nunca se escribió (#143, #146).
 *
 * Medido en el contenedor: con la marca, una petición deja su línea de traza; sin ella,
 * deja cero.
 */

const entrypoint = readFileSync(join(__dirname, "..", "docker-entrypoint.sh"), "utf8");

/** La línea del entrypoint que arranca el servidor, con las continuaciones unidas. */
const startCommand = (script: string): string => {
	// La orden está partida con `\` al final de línea; sin unirlas, la marca quedaría
	// en una línea que el filtro no ve.
	const collapsed = script.replace(/\\\s*\n\s*/g, " ");

	return (
		collapsed
			.split("\n")
			.map((line) => line.trim())
			.find((line) => line.includes("fastify start")) ?? ""
	);
};

/**
 * La guarda. Falla si la orden de arranque no lleva `--options`.
 *
 * Se escribe aparte de los tests para poder comprobarla con una entrada que rechaza:
 * una guarda que nunca falla no protege nada.
 */
export const assertStartUsesOptions = (script: string): void => {
	const command = startCommand(script);

	if (!command.includes("fastify start")) {
		throw new Error("no se encontró la orden `fastify start` en el entrypoint");
	}

	if (!command.includes("--options")) {
		throw new Error(
			"`fastify start` necesita `--options`: sin esa marca no se aplica el `options` de app.ts (nivel de log, timeouts y trustProxy)"
		);
	}
};

test("el entrypoint arranca fastify con --options", () => {
	assertStartUsesOptions(entrypoint);
});

test("el entrypoint lee el nivel de log del entorno", () => {
	// Antes estaba fijado a `warn`, así que LOG_LEVEL no servía de nada.
	assert.match(startCommand(entrypoint), /-l\s+"\$\{LOG_LEVEL:-info\}"/);
});

test("la guarda muerde: una orden sin --options la rompe", () => {
	// `replaceAll` a propósito: la marca aparece también en los comentarios, y quitar
	// solo la primera ocurrencia dejaría el test en verde sin probar nada.
	const broken = entrypoint.replaceAll("--options", "");

	assert.throws(() => assertStartUsesOptions(broken), /--options/);
});

test("la guarda muerde: un entrypoint sin la orden también la rompe", () => {
	assert.throws(() => assertStartUsesOptions("#!/bin/sh\necho hola\n"), /fastify start/);
});
