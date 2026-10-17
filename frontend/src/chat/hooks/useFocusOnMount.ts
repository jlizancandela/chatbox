import { useEffect } from "preact/hooks";

/** Focuses a ref'd element on mount. */
export function useFocusOnMount(ref: { current: HTMLElement | null }): void {
	useEffect(() => {
		ref.current?.focus();
	}, []);
}
