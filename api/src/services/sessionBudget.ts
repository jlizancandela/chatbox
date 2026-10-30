/**
 * El presupuesto de consumo por sesión.
 *
 * Sin autenticación, el identificador de sesión lo controla el cliente: borrarlo o
 * rotarlo reinicia el presupuesto. Esto es **equidad entre visitantes**, no seguridad:
 * lo único que no se puede eludir es el tope global diario, que vive en #143 (#148).
 */

/** La cabecera que lleva el identificador de sesión. */
export const BUDGET_SESSION_HEADER = "x-session-id";

export type SessionBudgetConfig = {
	/** Tope de tokens por sesión. */
	maxTokens: number;
	/** Tope de turnos por sesión. */
	maxTurns: number;
};

/** Por qué se corta una sesión. */
export type BudgetExceeded = "none" | "tokens" | "turns";

export type SessionBudget = {
	/** Los tokens que la sesión ya gastó. */
	usedTokens: (sessionId: string) => number;
	/** Los turnos que la sesión ya gastó. */
	usedTurns: (sessionId: string) => number;
	/** Anota el consumo de un turno. */
	record: (sessionId: string, tokens: number) => void;
	/** Por qué se corta la sesión, si se corta. */
	exceeded: (sessionId: string) => BudgetExceeded;
	/** Devuelve el presupuesto a cero: una conversación nueva empieza de cero. */
	reset: (sessionId: string) => void;
};

type SessionUsage = {
	tokens: number;
	turns: number;
};

/**
 * El presupuesto vive en memoria del proceso.
 *
 * La instancia es única, así que un `Map` basta. Un reinicio del proceso lo borra, y
 * eso es aceptable: el presupuesto reparte justicia entre visitantes, no lleva las
 * cuentas (#148).
 */
export const createSessionBudget = (config: SessionBudgetConfig): SessionBudget => {
	const sessions = new Map<string, SessionUsage>();

	const usageOf = (sessionId: string): SessionUsage => {
		const existing = sessions.get(sessionId);

		if (existing) {
			return existing;
		}

		const fresh: SessionUsage = { tokens: 0, turns: 0 };
		sessions.set(sessionId, fresh);
		return fresh;
	};

	// Sin identificador no hay a quién contabilizar, y cortarle a "todos" sería cortar a
	// todo el mundo. Una sesión sin identificador no consume presupuesto.
	const isBillable = (sessionId: string): boolean => sessionId.trim().length > 0;

	return {
		usedTokens: (sessionId) => (isBillable(sessionId) ? usageOf(sessionId).tokens : 0),
		usedTurns: (sessionId) => (isBillable(sessionId) ? usageOf(sessionId).turns : 0),
		record: (sessionId, tokens) => {
			if (!isBillable(sessionId)) {
				return;
			}

			const usage = usageOf(sessionId);
			usage.tokens += Math.max(0, tokens);
			usage.turns += 1;
		},
		exceeded: (sessionId) => {
			if (!isBillable(sessionId)) {
				return "none";
			}

			const usage = usageOf(sessionId);

			if (usage.tokens >= config.maxTokens) {
				return "tokens";
			}

			if (usage.turns >= config.maxTurns) {
				return "turns";
			}

			return "none";
		},
		reset: (sessionId) => {
			if (!isBillable(sessionId)) {
				return;
			}

			sessions.delete(sessionId);
		},
	};
};
