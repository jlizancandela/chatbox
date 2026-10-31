import { randomUUID } from "node:crypto";

/**
 * El nivel del logger, tal como lo entiende Pino. La lista es cerrada: un nivel que no
 * está aquí no se pasa a Pino, porque Pino aceptaría cualquier cadena y acabaría sin
 * registrar nada (#146).
 */
export const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/** El nivel por defecto: en un servidor hay que ver las peticiones sin llenar el disco. */
export const DEFAULT_LOG_LEVEL: LogLevel = "info";

/**
 * El nivel configurado por entorno, o el de por defecto si no hay uno válido.
 *
 * Un nivel desconocido **no** rompe el arranque: cae en `info`. Un servidor que no
 * levanta por un `LOG_LEVEL` mal escrito es un servidor que no registra nada, que es
 * justo el problema que esto viene a arreglar.
 */
export const resolveLogLevel = (value: string | undefined): LogLevel => {
	const candidate = value?.trim().toLowerCase();

	return LOG_LEVELS.includes(candidate as LogLevel) ? (candidate as LogLevel) : DEFAULT_LOG_LEVEL;
};

/** La cabecera que empareja la traza del servidor con la del cliente. */
export const REQUEST_ID_HEADER = "x-request-id";

/**
 * El identificador de correlación de una petición.
 *
 * Lo genera el servidor, pero si el cliente ya envía uno se respeta: es el suyo y
 * cambiarlo rompería el emparejamiento de sus trazas (#146).
 */
export const requestIdOf = (header: string | string[] | undefined): string => {
	const fromClient = Array.isArray(header) ? header[0] : header;

	if (typeof fromClient === "string" && fromClient.trim().length > 0) {
		return fromClient.trim();
	}

	return randomUUID();
};

/**
 * Lo que se registra de una petición que terminó.
 *
 * Sin cuerpo, sin historial y sin contenido del corpus: solo lo que hace falta para
 * saber qué pasó y cuánto tardó (#146).
 */
export type RequestTrace = {
	requestId: string;
	method: string;
	url: string;
	statusCode: number;
	durationMs: number;
};

/**
 * El consumo de un turno.
 *
 * Es un evento propio y no una traza de petición: un turno tiene una sesión y unos
 * tokens, y **no** tiene un identificador de correlación ni una duración de HTTP. Meterlo
 * en la traza obligaba a rellenar esos campos con algo inventado (#146, #148).
 */
export type ConsumptionTrace = {
	sessionId: string;
	tokens: number;
};

/**
 * El registro de un fallo clasificado.
 *
 * La clasificación es lo que permite distinguir la cuota agotada de un fallo
 * cualquiera sin mirar la respuesta que recibió el visitante (#144, #146).
 */
export type FailureTrace = {
	requestId?: string;
	code: string;
	status?: number;
	/** La sesión a la que se atribuye el fallo (#148). */
	sessionId?: string;
};

export type Logger = {
	/** La traza de una petición que terminó. */
	request: (trace: RequestTrace) => void;
	/** El consumo de un turno. */
	consumption: (usage: ConsumptionTrace) => void;
	/** El registro de un fallo clasificado. */
	failure: (failure: FailureTrace) => void;
};

/**
 * Las claves que nunca pueden aparecer en un log.
 *
 * Es la lista de lo que la API maneja y no debe sacar: la clave del proveedor de
 * generación y las de los proveedores de embeddings. Vive aquí, junto al logger, para
 * que añadir una clave nueva obligue a decidir si se puede registrar (#146).
 */
export const SECRET_KEYS = ["GROQ_API_KEY", "EMBEDDING_API_KEY", "DATABASE_URL"] as const;

/**
 * Extrae de un objeto cualquier valor cuya clave sea secreta.
 *
 * Se usa para comprobar, en los tests, que nada de eso llega al log. Devuelve las
 * parejas `{ clave, valor }` que encuentra, en cualquier nivel de anidamiento.
 */
export const findSecretValues = (
	value: unknown,
	secrets: readonly string[],
	path = ""
): { path: string; value: string }[] => {
	if (typeof value === "object" && value !== null) {
		return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
			const here = path === "" ? key : `${path}.${key}`;

			if (secrets.includes(key)) {
				return [{ path: here, value: typeof entry === "string" ? entry : JSON.stringify(entry) }];
			}

			return findSecretValues(entry, secrets, here);
		});
	}

	return [];
};
