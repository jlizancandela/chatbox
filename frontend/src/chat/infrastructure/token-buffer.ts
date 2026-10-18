export type TokenBuffer = {
	enqueue: (token: string) => void;
	flush: () => void;
	cancel: () => void;
};

export type TokenBufferOptions = {
	onFlush: (tokens: string) => void;
	requestFrame: (callback: FrameRequestCallback) => number;
	cancelFrame: (frame: number) => void;
};

export const createTokenBuffer = ({
	onFlush,
	requestFrame,
	cancelFrame,
}: TokenBufferOptions): TokenBuffer => {
	let pending = "";
	let frame: number | null = null;

	const flush = (): void => {
		if (frame !== null) {
			cancelFrame(frame);
			frame = null;
		}
		if (pending.length > 0) {
			const tokens = pending;
			pending = "";
			onFlush(tokens);
		}
	};

	return {
		enqueue(token) {
			pending += token;
			if (frame === null) frame = requestFrame(flush);
		},
		flush,
		cancel() {
			if (frame !== null) cancelFrame(frame);
			frame = null;
			pending = "";
		},
	};
};
