import { createHmac } from "node:crypto";

const sessionSecret = process.env.HISTORY_HMAC_SECRET?.trim();

if (!sessionSecret) {
	throw new Error("HISTORY_HMAC_SECRET is required");
}

export const createSessionHasher = (secret: string) => {
	const normalizedSecret = secret.trim();

	if (normalizedSecret.length === 0) {
		throw new Error("HISTORY_HMAC_SECRET must not be empty");
	}

	return (ip: string): string => {
		const normalizedIp = ip.trim();

		if (normalizedIp.length === 0) {
			throw new Error("Cannot derive a session key from an empty IP");
		}

		return createHmac("sha256", normalizedSecret)
			.update(normalizedIp)
			.digest("hex");
	};
};

export const deriveSessionKey = createSessionHasher(sessionSecret);