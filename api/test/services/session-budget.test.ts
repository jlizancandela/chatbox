import assert from "node:assert";
import { test } from "node:test";
import {
	BUDGET_SESSION_HEADER,
	createSessionBudget,
	type SessionBudgetConfig,
} from "../../src/services/sessionBudget";

const config = (overrides: Partial<SessionBudgetConfig> = {}): SessionBudgetConfig => ({
	maxTokens: 1000,
	maxTurns: 3,
	...overrides,
});

test("la cabecera de sesión es la acordada", () => {
	assert.strictEqual(BUDGET_SESSION_HEADER, "x-session-id");
});

test("una sesión nueva no tiene consumo", () => {
	const budget = createSessionBudget(config());

	assert.strictEqual(budget.usedTokens("sesion-1"), 0);
	assert.strictEqual(budget.usedTurns("sesion-1"), 0);
});

test("el consumo de una sesión crece con cada turno", () => {
	const budget = createSessionBudget(config());

	budget.record("sesion-1", 400);
	budget.record("sesion-1", 250);

	assert.strictEqual(budget.usedTokens("sesion-1"), 650);
	assert.strictEqual(budget.usedTurns("sesion-1"), 2);
});

test("las sesiones se llevan la una a la otra", () => {
	const budget = createSessionBudget(config());

	budget.record("sesion-1", 400);
	budget.record("sesion-2", 100);

	assert.strictEqual(budget.usedTokens("sesion-1"), 400);
	assert.strictEqual(budget.usedTokens("sesion-2"), 100);
});

test("el presupuesto de tokens se agota y corta", () => {
	const budget = createSessionBudget(config({ maxTokens: 500 }));

	assert.strictEqual(budget.exceeded("sesion-1"), "none");

	budget.record("sesion-1", 400);
	assert.strictEqual(budget.exceeded("sesion-1"), "none");

	budget.record("sesion-1", 200);
	assert.strictEqual(budget.exceeded("sesion-1"), "tokens");
});

test("el tope de turnos se agota y corta", () => {
	const budget = createSessionBudget(config({ maxTurns: 2 }));

	budget.record("sesion-1", 1);
	assert.strictEqual(budget.exceeded("sesion-1"), "none");

	budget.record("sesion-1", 1);
	assert.strictEqual(budget.exceeded("sesion-1"), "turns");
});

test("reiniciar la sesión devuelve el presupuesto a cero", () => {
	const budget = createSessionBudget(config({ maxTokens: 100 }));

	budget.record("sesion-1", 200);
	assert.strictEqual(budget.exceeded("sesion-1"), "tokens");

	budget.reset("sesion-1");

	assert.strictEqual(budget.usedTokens("sesion-1"), 0);
	assert.strictEqual(budget.usedTurns("sesion-1"), 0);
	assert.strictEqual(budget.exceeded("sesion-1"), "none");
});

test("una sesión sin identificador no se puede agotar", () => {
	// Sin identificador no hay a quién contabilizar: cortarle sería cortar a todos.
	const budget = createSessionBudget(config({ maxTokens: 10 }));

	budget.record("", 100);

	assert.strictEqual(budget.usedTokens(""), 0);
	assert.strictEqual(budget.exceeded(""), "none");
});
