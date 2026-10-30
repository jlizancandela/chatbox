import assert from "node:assert";
import { test } from "node:test";
import { serverOptions, trustProxyFrom } from "../src/app";

test("los timeouts del servidor son finitos", () => {
	const options = serverOptions({});

	// Los valores por defecto del framework son 0, y su propia documentación advierte
	// del riesgo de denegación de servicio: una conexión a goteo se queda abierta
	// indefinidamente (#143).
	assert.ok(options.requestTimeout > 0, "requestTimeout tiene que ser finito");
	assert.ok(options.connectionTimeout > 0, "connectionTimeout tiene que ser finito");
});

test("los timeouts se pueden configurar", () => {
	const options = serverOptions({
		REQUEST_TIMEOUT_MS: "5000",
		CONNECTION_TIMEOUT_MS: "2500",
	});

	assert.strictEqual(options.requestTimeout, 5000);
	assert.strictEqual(options.connectionTimeout, 2500);
});

test("un timeout configurado a cero es un error", () => {
	// Un timeout de 0 es exactamente el agujero que se quiere cerrar.
	assert.throws(() => serverOptions({ REQUEST_TIMEOUT_MS: "0" }), /REQUEST_TIMEOUT_MS/);
	assert.throws(() => serverOptions({ CONNECTION_TIMEOUT_MS: "-1" }), /CONNECTION_TIMEOUT_MS/);
});

test("sin proxy configurado, la aplicación no confía en nadie", () => {
	// En local no hay proxy: no hay nada que confiar, y confiar en cualquier cabecera
	// dejaría que un cliente falsificase su IP (#143).
	assert.strictEqual(trustProxyFrom({}), undefined);
});

test("el proxy se configura con su IP o su rango", () => {
	// Un contador de saltos sería falsificable por un cliente directo.
	assert.strictEqual(trustProxyFrom({ TRUST_PROXY: "10.0.1.0/24" }), "10.0.1.0/24");
	assert.strictEqual(trustProxyFrom({ TRUST_PROXY: "127.0.0.1" }), "127.0.0.1");
});

test("un proxy vacío cuenta como no configurado", () => {
	assert.strictEqual(trustProxyFrom({ TRUST_PROXY: "  " }), undefined);
});

test("las opciones del servidor llevan el proxy y los timeouts", () => {
	const options = serverOptions({ TRUST_PROXY: "10.0.1.0/24" });

	assert.strictEqual(options.trustProxy, "10.0.1.0/24");
	assert.ok(options.requestTimeout > 0);
});
