import assert from "node:assert";
import { test } from "node:test";
import {
	createGenerationConfig,
	createSessionBudgetConfig,
	createTopK,
} from "../../src/services/chat.config";

test("la generación usa los valores por defecto", () => {
	assert.deepStrictEqual(createGenerationConfig({}), {
		temperature: 0.6,
		// El techo baja para que una respuesta de 200 palabras quepa con holgura para el
		// razonamiento, sin truncar ninguna (#148).
		maxCompletionTokens: 1200,
		reasoningEffort: "low",
	});
});

test("la generación lee la temperatura, el límite de tokens y el razonamiento", () => {
	const config = createGenerationConfig({
		GENERATION_TEMPERATURE: "0.3",
		GENERATION_MAX_COMPLETION_TOKENS: "512",
		GENERATION_REASONING_EFFORT: "medium",
	});

	assert.strictEqual(config.temperature, 0.3);
	assert.strictEqual(config.maxCompletionTokens, 512);
	assert.strictEqual(config.reasoningEffort, "medium");
});

test("una temperatura fuera del rango del proveedor es un error", () => {
	assert.throws(
		() => createGenerationConfig({ GENERATION_TEMPERATURE: "2.5" }),
		/GENERATION_TEMPERATURE/
	);
	assert.throws(
		() => createGenerationConfig({ GENERATION_TEMPERATURE: "-0.1" }),
		/GENERATION_TEMPERATURE/
	);
});

test("un límite de tokens que no es un entero positivo es un error", () => {
	assert.throws(
		() => createGenerationConfig({ GENERATION_MAX_COMPLETION_TOKENS: "0" }),
		/GENERATION_MAX_COMPLETION_TOKENS/
	);
	assert.throws(
		() => createGenerationConfig({ GENERATION_MAX_COMPLETION_TOKENS: "muchos" }),
		/GENERATION_MAX_COMPLETION_TOKENS/
	);
});

test("un esfuerzo de razonamiento desconocido es un error", () => {
	assert.throws(
		() => createGenerationConfig({ GENERATION_REASONING_EFFORT: "mucho" }),
		/GENERATION_REASONING_EFFORT/
	);
});

test("el top-k por defecto es 5 y se puede configurar", () => {
	assert.strictEqual(createTopK({}), 5);
	assert.strictEqual(createTopK({ RETRIEVAL_TOP_K: "8" }), 8);
	assert.throws(() => createTopK({ RETRIEVAL_TOP_K: "0" }), /RETRIEVAL_TOP_K/);
});

test("el presupuesto por sesión usa los valores por defecto", () => {
	// 20.000 tokens deja unas 17 conversaciones completas al día sobre una cuota de
	// ~200.000; 12 turnos hacen que se agote antes de que el visitante la note larga.
	assert.deepStrictEqual(createSessionBudgetConfig({}), {
		maxTokens: 20_000,
		maxTurns: 12,
	});
});

test("el presupuesto por sesión se puede configurar", () => {
	assert.deepStrictEqual(
		createSessionBudgetConfig({
			SESSION_BUDGET_MAX_TOKENS: "5000",
			SESSION_BUDGET_MAX_TURNS: "3",
		}),
		{ maxTokens: 5000, maxTurns: 3 }
	);
});

test("un presupuesto por sesión inválido es un error", () => {
	// Un tope de cero cortaría todas las conversaciones: tiene que ser un error
	// visible, no un valor silencioso.
	assert.throws(
		() => createSessionBudgetConfig({ SESSION_BUDGET_MAX_TOKENS: "0" }),
		/SESSION_BUDGET_MAX_TOKENS/
	);
	assert.throws(
		() => createSessionBudgetConfig({ SESSION_BUDGET_MAX_TURNS: "-1" }),
		/SESSION_BUDGET_MAX_TURNS/
	);
});
