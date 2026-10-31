import * as assert from "node:assert";
import { test } from "node:test";
import { build, testDependencies } from "../helper";

/**
 * El primer origen permitido. `CORS_ORIGIN` admite una lista separada por comas (el
 * sitio real y, en desarrollo, el servidor de Vite), así que el test no puede mandar la
 * cadena entera como si fuera un origen.
 */
const allowedOrigin = (process.env.CORS_ORIGIN ?? "").split(",")[0].trim();

test("CORS allows the configured origin", async (t) => {
	const app = await build(t, testDependencies());

	const res = await app.inject({
		method: "OPTIONS",
		url: "/health",
		headers: {
			origin: allowedOrigin,
			"access-control-request-method": "GET",
		},
	});

	assert.equal(res.statusCode, 204);
	assert.equal(res.headers["access-control-allow-origin"], allowedOrigin);
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
