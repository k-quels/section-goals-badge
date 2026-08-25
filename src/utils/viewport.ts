/**
 * Tracks the visual viewport on mobile devices to handle software keyboard appearances.
 * Uses requestAnimationFrame throttling to avoid 60-120fps event thrashing during scrolling.
 */
export class ViewportTracker {
	private onResizeCallback: () => void;
	private handler: () => void;
	private rafId: number | null = null;

	constructor(onResizeCallback: () => void) {
		this.onResizeCallback = onResizeCallback;
		this.handler = () => {
			if (this.rafId === null) {
				this.rafId = window.requestAnimationFrame(() => {
					this.rafId = null;
					this.onResizeCallback();
				});
			}
		};

		if (window.visualViewport) {
			window.visualViewport.addEventListener('resize', this.handler, { passive: true });
			window.visualViewport.addEventListener('scroll', this.handler, { passive: true });
		}
	}

	public destroy(): void {
		if (this.rafId !== null) {
			window.cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
		if (window.visualViewport) {
			window.visualViewport.removeEventListener('resize', this.handler);
			window.visualViewport.removeEventListener('scroll', this.handler);
		}
	}

	/**
	 * Get current viewport bottom offset (useful when virtual keyboard is shown).
	 */
	public static getViewportOffset(): { bottomOffset: number; viewportHeight: number } {
		if (!window.visualViewport) {
			return { bottomOffset: 0, viewportHeight: window.innerHeight };
		}

		const vv = window.visualViewport;
		const bottomOffset = window.innerHeight - (vv.height + vv.offsetTop);
		return {
			bottomOffset: Math.max(0, bottomOffset),
			viewportHeight: vv.height,
		};
	}
}
