/**
 * El identificador de sesión.
 *
 * El servidor lo usa para contabilizar el consumo por conversación (#148). Lo genera
 * el cliente y viaja en cada petición; sin él, el servidor no puede atribuir el
 * consumo a nadie.
 *
 * Sin autenticación, este identificador lo controla el cliente: borrarlo o rotarlo
 * reinicia el presupuesto. Es **equidad entre visitantes**, no seguridad —el respaldo
 * real es el tope global diario del servidor.
 */

export const SESSION_HEADER = "x-session-id";

export const SESSION_STORAGE_KEY = "chatbox:session";

/**
 * Un identificador de sesión nuevo.
 *
 * Se usa `crypto.randomUUID` cuando está disponible y un identificador derivado del
 * azar y del tiempo cuando no: el identificador solo tiene que ser único entre
 * conversaciones, no criptográficamente seguro.
 */
export const newSessionId = (): string => {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}

	return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * El identificador de sesión guardado, o uno nuevo si no hay ninguno.
 *
 * Se guarda en `sessionStorage`: vive mientras la pestaña siga abierta, que es
 * justo la vida de una conversación.
 */
export const loadOrCreateSessionId = (): string => {
	try {
		if (typeof sessionStorage === "undefined") {
			return newSessionId();
		}

		const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);

		if (stored !== null && stored.trim().length > 0) {
			return stored;
		}

		const created = newSessionId();
		sessionStorage.setItem(SESSION_STORAGE_KEY, created);
		return created;
	} catch {
		// Si el almacenamiento no está disponible, la conversación funciona igual: el
		// servidor simplemente no puede contabilizarle el consumo.
		return newSessionId();
	}
};

/** Empieza una conversación nueva: el identificador cambia y el presupuesto se reinicia. */
export const rotateSessionId = (): string => {
	const created = newSessionId();

	try {
		if (typeof sessionStorage !== "undefined") {
			sessionStorage.setItem(SESSION_STORAGE_KEY, created);
		}
	} catch {
		// Sin almacenamiento no hay nada que reiniciar en el cliente: el servidor lo
		// reinicia con la llamada de reset.
	}

	return created;
};
