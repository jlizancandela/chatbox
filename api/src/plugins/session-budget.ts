import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { chatConfig } from "../services/chat.config";
import { createSessionBudget, type SessionBudget } from "../services/sessionBudget";

/**
 * El presupuesto de consumo por sesión.
 *
 * Vive en memoria del proceso: la instancia es única, así que un `Map` basta. Un
 * reinicio lo borra, y eso es aceptable porque reparte justicia entre visitantes, no
 * lleva las cuentas (#148).
 *
 * El identificador de sesión lo genera el cliente y viaja en `x-session-id`. Sin
 * autenticación, el cliente lo controla: borrarlo o rotarlo reinicia el presupuesto.
 * El presupuesto es **equidad, no seguridad**; el respaldo real es el tope global
 * diario de #143.
 */
const sessionBudget: FastifyPluginAsync = async (fastify) => {
	const budget: SessionBudget = createSessionBudget(chatConfig.sessionBudget);

	fastify.decorate("budget", budget);
};

export default fp(sessionBudget);
export type { SessionBudget };

declare module "fastify" {
	export interface FastifyInstance {
		budget: SessionBudget;
	}
}
