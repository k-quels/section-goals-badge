export interface CounterOptions {
	excludeWhitespace?: boolean;
	excludeRuby?: boolean;
	excludeCharacters?: string;
}

/**
 * Counts characters in the provided text based on options.
 * Excludes newline characters (\r, \n) by default.
 */
export function countCharacters(text: string, options: CounterOptions = {}): number {
	if (!text) return 0;

	let cleaned = text;

	// 1. Exclude Japanese novel ruby (e.g. ｜漢字《かんじ》, |ルビ《るび》, 漢字《かんじ》)
	if (options.excludeRuby) {
		// Remove 《...》 including ruby text
		cleaned = cleaned.replace(/《[^》\r\n]*》/g, '');
		// Remove ruby prefix markers (| and ｜)
		cleaned = cleaned.replace(/[|｜]/g, '');
	}

	// 2. Exclude user-specified characters
	if (options.excludeCharacters && options.excludeCharacters.length > 0) {
		// Escape special regex characters in the user string
		const escaped = options.excludeCharacters.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		if (escaped.length > 0) {
			const regex = new RegExp(`[${escaped}]`, 'g');
			cleaned = cleaned.replace(regex, '');
		}
	}

	// 3. Remove carriage returns and line feeds
	cleaned = cleaned.replace(/[\r\n]/g, '');

	// 4. Remove whitespace if option enabled
	if (options.excludeWhitespace) {
		// Remove full-width spaces, half-width spaces, and tabs
		cleaned = cleaned.replace(/[\s\u3000]/g, '');
	}

	// Count unicode code points (surrogate pairs / emojis) without array allocation
	let count = 0;
	const iterator = cleaned[Symbol.iterator]();
	while (!iterator.next().done) {
		count++;
	}
	return count;
}

/**
 * Future extension interface for word counter or custom tokenizers.
 */
export interface TextCounter {
	count(text: string, options?: CounterOptions): number;
}

export class CharacterCounter implements TextCounter {
	count(text: string, options?: CounterOptions): number {
		return countCharacters(text, options);
	}
}
