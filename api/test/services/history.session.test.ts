import assert from "node:assert";
import { test } from "node:test";
import {
	createSessionHasher,
	deriveSessionKey,
} from "../../src/services/history.session";

test("deriveSessionKey returns a 64 character hex digest", () => {
	const key = deriveSessionKey("192.168.1.10");

	assert.match(key, /^[0-9a-f]{64}$/);
});

test("deriveSessionKey is deterministic for the same IP and secret", () => {
	assert.strictEqual(
		deriveSessionKey("192.168.1.10"),
		deriveSessionKey("192.168.1.10"),
	);
});

test("deriveSessionKey differs when the IP changes", () => {
	assert.notStrictEqual(
		deriveSessionKey("192.168.1.10"),
		deriveSessionKey("192.168.1.11"),
	);
});

test("deriveSessionKey differs when the secret changes", () => {
	const hasherA = createSessionHasher("secret-a");
	const hasherB = createSessionHasher("secret-b");
	const ip = "192.168.1.10";

	assert.notStrictEqual(hasherA(ip), hasherB(ip));
});

test("deriveSessionKey never contains the raw IP", () => {
	const ip = "192.168.1.10";
	const key = deriveSessionKey(ip);

	assert.notStrictEqual(key, ip);
	assert.ok(!key.includes(ip));
});

test("deriveSessionKey trims the IP before signing", () => {
	assert.strictEqual(
		deriveSessionKey("  192.168.1.10  "),
		deriveSessionKey("192.168.1.10"),
	);
});

test("deriveSessionKey rejects an empty IP", () => {
	assert.throws(
		() => deriveSessionKey("   "),
		/Cannot derive a session key from an empty IP/,
	);
});

test("createSessionHasher rejects an empty secret", () => {
	assert.throws(
		() => createSessionHasher("   "),
		/HISTORY_HMAC_SECRET must not be empty/,
	);
});