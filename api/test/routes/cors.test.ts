import * as assert from "node:assert";
import { test } from "node:test";
import { build, testDependencies } from "../helper";

test("CORS allows the configured origin", async (t) => {
	const app = await build(t, testDependencies());

	const res = await app.inject({
		method: "OPTIONS",
		url: "/health",
		headers: {
			origin: process.env.CORS_ORIGIN,
			"access-control-request-method": "GET",
		},
	});

	assert.equal(res.statusCode, 204);
	assert.equal(res.headers["access-control-allow-origin"], process.env.CORS_ORIGIN);
});

test("CORS does not allow an origin that is not configured", async (t) => {
	const app = await build(t, testDependencies());

	const res = await app.inject({
		method: "OPTIONS",
		url: "/health",
		headers: {
			origin: "https://un-sitio-cualquiera.example",
			"access-control-request-method": "GET",
		},
	});

	// Un origen que no está en la lista no recibe la cabecera de permiso: sin ella, el
	// navegador no deja leer la respuesta (#143).
	assert.notEqual(
		res.headers["access-control-allow-origin"],
		"https://un-sitio-cualquiera.example"
	);
});
