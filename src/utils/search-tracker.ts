/**
 * Tracks the document search bar in Obsidian editor panes.
 * Automatically detects when the in-document search bar is opened, closed, or resized,
 * providing the bottom offset to prevent floating UI elements from overlapping with it.
 */
export class SearchTracker {
	private onOffsetChanged: () => void;
	private currentParentEl: HTMLElement | null = null;
	private currentSearchEl: HTMLElement | null = null;

	private mutationObserver: MutationObserver | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private rafId: number | null = null;

	constructor(onOffsetChanged: () => void) {
		this.onOffsetChanged = onOffsetChanged;
	}

	/**
	 * Attaches tracker to the current editor parent element (e.g. workspace-leaf-content).
	 */
	public attach(parentEl: HTMLElement): void {
		if (this.currentParentEl === parentEl) return;

		this.disconnect();
		this.currentParentEl = parentEl;

		this.setupObservers();
		this.updateSearchElement();
		this.onOffsetChanged();
	}

	/**
	 * Disconnects all observers and resets tracked elements.
	 */
	public disconnect(): void {
		if (this.rafId !== null) {
			window.cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}

		if (this.mutationObserver) {
			this.mutationObserver.disconnect();
			this.mutationObserver = null;
		}

		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}

		this.currentParentEl = null;
		this.currentSearchEl = null;
	}

	/**
	 * Destroys the tracker instance completely.
	 */
	public destroy(): void {
		this.disconnect();
	}

	/**
	 * Calculates the additional downward shift caused by the document search bar.
	 * Accurately positions the badge below the search bar while preserving the user's
	 * desired margin (distance between the badge and the upper bar/header).
	 */
	public getSearchShiftOffset(currentOffsetY: number): number {
		if (!this.currentParentEl) return 0;

		const searchEl = this.findSearchElement();
		if (!searchEl) return 0;

		const searchRect = searchEl.getBoundingClientRect();
		if (searchRect.height === 0) return 0;

		const parentRect = this.currentParentEl.getBoundingClientRect();
		const searchBottom = searchRect.bottom - parentRect.top;

		// Find current header / upper bar bottom (if present and visible)
		const headerEl = this.currentParentEl.querySelector<HTMLElement>('.view-header');
		let headerBottom = 0;
		if (headerEl && headerEl.offsetParent !== null) {
			const headerRect = headerEl.getBoundingClientRect();
			headerBottom = Math.max(0, headerRect.bottom - parentRect.top);
		}

		// Calculate user's normal margin below the upper bar (or container top if no visible header)
		const normalMargin = Math.max(0, currentOffsetY - headerBottom);

		// Target top position: search bar bottom + the exact same margin
		const targetTop = searchBottom + normalMargin;

		return Math.max(0, Math.round(targetTop - currentOffsetY));
	}

	private findSearchElement(): HTMLElement | null {
		if (!this.currentParentEl) return null;

		const searchEl = this.currentParentEl.querySelector<HTMLElement>(
			'.document-search-container, .document-search',
		);

		if (!searchEl) return null;

		// Verify element is not hidden via display: none
		if (searchEl.offsetParent === null && searchEl.getBoundingClientRect().height === 0) {
			return null;
		}

		return searchEl;
	}

	private scheduleOffsetUpdate(): void {
		if (this.rafId !== null) return;

		this.rafId = window.requestAnimationFrame(() => {
			this.rafId = null;
			this.updateSearchElement();
			this.onOffsetChanged();
		});
	}

	private updateSearchElement(): void {
		const newSearchEl = this.findSearchElement();

		if (newSearchEl !== this.currentSearchEl) {
			if (this.resizeObserver && this.currentSearchEl) {
				this.resizeObserver.unobserve(this.currentSearchEl);
			}

			this.currentSearchEl = newSearchEl;

			if (this.resizeObserver && this.currentSearchEl) {
				this.resizeObserver.observe(this.currentSearchEl);
			}
		}
	}

	private setupObservers(): void {
		if (!this.currentParentEl) return;

		// MutationObserver observes childList across subtree, but filters only search container additions/removals
		// to ensure zero performance overhead during regular typing in the editor.
		this.mutationObserver = new MutationObserver((mutations) => {
			let relevant = false;
			for (const mutation of mutations) {
				for (let i = 0; i < mutation.addedNodes.length; i++) {
					const node = mutation.addedNodes[i];
					if (node instanceof HTMLElement) {
						if (
							node.classList.contains('document-search-container') ||
							node.classList.contains('document-search') ||
							node.querySelector('.document-search-container, .document-search')
						) {
							relevant = true;
							break;
						}
					}
				}
				if (relevant) break;

				for (let i = 0; i < mutation.removedNodes.length; i++) {
					const node = mutation.removedNodes[i];
					if (node instanceof HTMLElement) {
						if (
							node.classList.contains('document-search-container') ||
							node.classList.contains('document-search') ||
							node.querySelector('.document-search-container, .document-search')
						) {
							relevant = true;
							break;
						}
					}
				}
				if (relevant) break;
			}

			if (relevant) {
				this.scheduleOffsetUpdate();
			}
		});

		this.mutationObserver.observe(this.currentParentEl, {
			childList: true,
			subtree: true,
		});

		// ResizeObserver to track search bar and parent size changes
		if (typeof ResizeObserver !== 'undefined') {
			this.resizeObserver = new ResizeObserver(() => {
				this.scheduleOffsetUpdate();
			});
			this.resizeObserver.observe(this.currentParentEl);
		}
	}
}
