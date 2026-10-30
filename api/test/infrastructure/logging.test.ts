import assert from "node:assert";
import { test } from "node:test";
import {
	findSecretValues,
	LOG_LEVELS,
	REQUEST_ID_HEADER,
	requestIdOf,
	resolveLogLevel,
} from "../../src/infrastructure/logging";

test("el nivel por defecto es info", () => {
	assert.strictEqual(resolveLogLevel(undefined), "info");
	assert.strictEqual(resolveLogLevel(""), "info");
	assert.strictEqual(resolveLogLevel("   "), "info");
});

test("un nivel configurado se respeta", () => {
	assert.strictEqual(resolveLogLevel("warn"), "warn");
	assert.strictEqual(resolveLogLevel("debug"), "debug");
	assert.strictEqual(resolveLogLevel("error"), "error");
});

test("un nivel que no existe cae en info en vez de romper el arranque", () => {
	// Un servidor que no levanta por un LOG_LEVEL mal escrito es un servidor que no
	// registra nada: justo el problema que el logging viene a arreglar.
	assert.strictEqual(resolveLogLevel("verbose"), "info");
	assert.strictEqual(resolveLogLevel("loud"), "info");
});

test("la lista de niveles es cerrada", () => {
	assert.ok(LOG_LEVELS.includes("info"));
	assert.ok(LOG_LEVELS.includes("warn"));
	assert.ok(LOG_LEVELS.includes("silent"));
});

test("la cabecera del identificador es la acordada", () => {
	assert.strictEqual(REQUEST_ID_HEADER, "x-request-id");
});

test("una petición sin identificador recibe uno generado", () => {
	const id = requestIdOf(undefined);

	assert.ok(id.length > 0);
	assert.notStrictEqual(id, requestIdOf(undefined));
});

test("el identificador que ya viaja en la petición se respeta", () => {
	// Cambiarlo rompería el emparejamiento de las trazas del cliente.
	assert.strictEqual(requestIdOf("abc-123"), "abc-123");
	assert.strictEqual(requestIdOf("  abc-123  "), "abc-123");
	assert.strictEqual(requestIdOf(["abc-123", "otro"]), "abc-123");
});

test("un identificador vacío se sustituye por uno generado", () => {
	assert.ok(requestIdOf("   ").length > 0);
});

test("el buscador de secretos encuentra la clave aunque esté anidada", () => {
	const found = findSecretValues({ a: { b: { GROQ_API_KEY: "secreto" } }, c: "texto" }, [
		"GROQ_API_KEY",
	]);

	assert.deepStrictEqual(found, [{ path: "a.b.GROQ_API_KEY", value: "secreto" }]);
});

test("el buscador de secretos no se equivoca con lo que no es secreto", () => {
	const found = findSecretValues({ model: "openai/gpt-oss-20b" }, ["GROQ_API_KEY"]);

	assert.deepStrictEqual(found, []);
});
