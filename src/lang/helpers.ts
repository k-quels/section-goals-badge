import { getLanguage } from 'obsidian';
import en from './locale/en';
import ja from './locale/ja';

const localeMap: Record<string, Partial<typeof en>> = {
	en,
	ja,
};

export function t(str: keyof typeof en, params?: Record<string, string | number>): string {
	const lang = getLanguage();
	const baseLang = lang.split('-')[0] ?? 'en';
	const currentLocale = localeMap[lang] || localeMap[baseLang] || en;

	let text = currentLocale[str] || en[str] || str;

	if (params) {
		for (const [key, value] of Object.entries(params)) {
			text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
		}
	}

	return text;
}
