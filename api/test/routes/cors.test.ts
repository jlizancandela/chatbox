import * as assert from "node:assert";
import { test } from "node:test";
import { build } from "../helper";

test("CORS allows the configured origin", async (t) => {
	const app = await build(t);

	const res = await app.inject({
		method: "OPTIONS",
		url: "/health",
		headers: {
			origin: process.env.CORS_ORIGIN,
			"access-control-request-method": "GET",
		},
	});

	assert.equal(res.statusCode, 204);
	assert.equal(
		res.headers["access-control-allow-origin"],
		process.env.CORS_ORIGIN,
	);
});
