import assert from "node:assert";
import { test } from "node:test";
import { createGenerationConfig } from "../../src/services/chat.config";

/**
 * El prompt pide un máximo de 200 palabras (#148). El techo de tokens de generación
 * tiene que caber esa respuesta con holgura para el razonamiento, y bajarlo más
 * truncaría respuestas normales.
 */

/** Una estimación conservative: los tokens suelen ser más que las palabras. */
const tokensOf = (words: number): number => Math.ceil(words * 1.6);

test("el techo de generación deja caber la respuesta máxima que pide el prompt", () => {
	const config = createGenerationConfig({});
	const wordsInThePromptLimit = 200;
	const tokensNeeded = tokensOf(wordsInThePromptLimit);

	assert.ok(
		config.maxCompletionTokens >= tokensNeeded,
		`el techo (${config.maxCompletionTokens}) no cabe la respuesta de ${wordsInThePromptLimit} palabras (~${tokensNeeded} tokens)`
	);
});

test("el techo deja holgura para el razonamiento", () => {
	const config = createGenerationConfig({});
	const tokensForTheAnswer = tokensOf(200);

	// Lo que sobra es la holgura: sin ella, una respuesta larga se trunca a media.
	assert.ok(
		config.maxCompletionTokens - tokensForTheAnswer >= 500,
		`quedan ${config.maxCompletionTokens - tokensForTheAnswer} tokens de holgura para el razonamiento`
	);
});

test("el techo configurable sigue admitiendo una respuesta normal", () => {
	const config = createGenerationConfig({ GENERATION_MAX_COMPLETION_TOKENS: "1200" });

	assert.ok(config.maxCompletionTokens >= tokensOf(200));
});
