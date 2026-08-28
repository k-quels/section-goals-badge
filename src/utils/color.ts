/**
 * Parses a hex color string (#RGB, #RRGGBB) to [r, g, b] in range [0, 255].
 * Returns null if invalid.
 */
export function parseHexColor(hex: string): [number, number, number] | null {
	const trimmed = hex.trim().replace(/^#/, '');
	if (trimmed.length === 3) {
		const r = parseInt(trimmed[0]! + trimmed[0]!, 16);
		const g = parseInt(trimmed[1]! + trimmed[1]!, 16);
		const b = parseInt(trimmed[2]! + trimmed[2]!, 16);
		if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
		return [r, g, b];
	} else if (trimmed.length === 6) {
		const r = parseInt(trimmed.substring(0, 2), 16);
		const g = parseInt(trimmed.substring(2, 4), 16);
		const b = parseInt(trimmed.substring(4, 6), 16);
		if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
		return [r, g, b];
	}
	return null;
}

/**
 * Formats [r, g, b] (range 0..255) into standard '#rrggbb' hex format.
 */
export function rgbToHex(r: number, g: number, b: number): string {
	const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
	const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Convert standard sRGB component (0..1) to linear sRGB
function sRGBToLinear(c: number): number {
	return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// Convert linear sRGB component (0..1) to standard sRGB
function linearToSRGB(c: number): number {
	const clamped = Math.max(0, Math.min(1, c));
	return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

/**
 * Converts sRGB [0..255] to Oklab [L, a, b].
 */
export function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
	const lr = sRGBToLinear(r / 255);
	const lg = sRGBToLinear(g / 255);
	const lb = sRGBToLinear(b / 255);

	const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
	const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
	const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
}

/**
 * Converts Oklab [L, a, b] to sRGB [0..255].
 */
export function oklabToRgb(L: number, a: number, b: number): [number, number, number] {
	const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
	const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
	const s_ = L - 0.0894841775 * a - 1.291485548 * b;

	const l = l_ * l_ * l_;
	const m = m_ * m_ * m_;
	const s = s_ * s_ * s_;

	const lr = +4.0767439362 * l - 3.3077115913 * m + 0.2309699292 * s;
	const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
	const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

	return [
		Math.round(linearToSRGB(lr) * 255),
		Math.round(linearToSRGB(lg) * 255),
		Math.round(linearToSRGB(lb) * 255),
	];
}

/**
 * Interpolates two hex colors in Oklab space at factor t (0 <= t <= 1).
 */
export function interpolateOklab(hex1: string, hex2: string, t: number): string {
	const rgb1 = parseHexColor(hex1) ?? [171, 171, 171];
	const rgb2 = parseHexColor(hex2) ?? [32, 125, 255];
	const lab1 = rgbToOklab(rgb1[0], rgb1[1], rgb1[2]);
	const lab2 = rgbToOklab(rgb2[0], rgb2[1], rgb2[2]);

	const factor = Math.max(0, Math.min(1, t));
	const labInterp: [number, number, number] = [
		lab1[0] + (lab2[0] - lab1[0]) * factor,
		lab1[1] + (lab2[1] - lab1[1]) * factor,
		lab1[2] + (lab2[2] - lab1[2]) * factor,
	];

	const [r, g, b] = oklabToRgb(labInterp[0], labInterp[1], labInterp[2]);
	return rgbToHex(r, g, b);
}

/**
 * Computes intermediate colors (Warn, Good) between Default and Done colors
 * equally spaced at 1/3 and 2/3 intervals.
 */
export function interpolateGoalColors(
	colorDefault: string,
	colorDone: string,
): { colorWarn: string; colorGood: string } {
	return {
		colorWarn: interpolateOklab(colorDefault, colorDone, 1 / 3),
		colorGood: interpolateOklab(colorDefault, colorDone, 2 / 3),
	};
}
