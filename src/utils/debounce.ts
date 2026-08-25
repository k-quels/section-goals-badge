/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 */
export function debounce<T extends (...args: unknown[]) => void>(
	func: T,
	wait: number,
): (...args: Parameters<T>) => void {
	let timeoutId: number | null = null;

	return function (this: unknown, ...args: Parameters<T>) {
		if (timeoutId !== null) {
			window.clearTimeout(timeoutId);
		}
		timeoutId = window.setTimeout(() => {
			func.apply(this, args);
			timeoutId = null;
		}, wait);
	};
}
