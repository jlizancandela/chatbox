import { describe, expect, it, vi } from "vitest";
import { createTokenBuffer } from "../../../../src/chat/infrastructure/token-buffer";

describe("token buffer", () => {
	it("groups tokens until the scheduled frame", () => {
		let callback: (() => void) | undefined;
		const onFlush = vi.fn();
		const buffer = createTokenBuffer({
			onFlush,
			requestFrame: (next) => {
				callback = () => next(0);
				return 1;
			},
			cancelFrame: vi.fn(),
		});

		buffer.enqueue("Hola");
		buffer.enqueue(" mundo");
		expect(onFlush).not.toHaveBeenCalled();
		callback?.();
		expect(onFlush).toHaveBeenCalledWith("Hola mundo");
	});

	it("flushes synchronously and cancels a pending frame", () => {
		const cancelFrame = vi.fn();
		const onFlush = vi.fn();
		const buffer = createTokenBuffer({
			onFlush,
			requestFrame: () => 7,
			cancelFrame,
		});

		buffer.enqueue("respuesta");
		buffer.flush();
		expect(onFlush).toHaveBeenCalledWith("respuesta");

		buffer.enqueue("pendiente");
		buffer.cancel();
		expect(cancelFrame).toHaveBeenCalledWith(7);
	});
});
