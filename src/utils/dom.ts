/**
 * Helper to set CSS custom properties or styles dynamically on an element.
 */
export function setCssProps(el: HTMLElement, props: Record<string, string>): void {
	for (const [key, value] of Object.entries(props)) {
		el.style.setProperty(key, value);
	}
}
