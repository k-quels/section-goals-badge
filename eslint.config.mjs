import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default defineConfig([
	{
		ignores: [
			'node_modules/**',
			'dist/**',
			'esbuild.config.mjs',
			'eslint.config.mjs',
			'version-bump.mjs',
			'versions.json',
			'main.js',
			'package-lock.json',
			'tsconfig.json',
			'vitest.config.mts',
			'tests/**',
			'manual-test-vault/**',
		],
	},
	...obsidianmd.configs.recommendedWithLocalesEn,
	{
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.*'],
				},
			},
		},
		rules: {
			'obsidianmd/ui/sentence-case': [
				'warn',
				{
					brands: [
						'iOS', 'iPadOS', 'macOS', 'Windows', 'Android', 'Linux', 'Obsidian',
						'Obsidian Sync', 'Obsidian Publish', 'Google', 'Gemini', 'Vertex AI',
						'OpenAI', 'GPT', 'Anthropic', 'Claude', 'Microsoft', 'Google Drive',
						'Dropbox', 'OneDrive', 'iCloud Drive', 'YouTube', 'Slack', 'Discord',
						'Telegram', 'WhatsApp', 'Twitter', 'X', 'Readwise', 'Zotero', 'Excalidraw',
						'Mermaid', 'Markdown', 'LaTeX', 'JavaScript', 'TypeScript', 'Node.js',
						'npm', 'pnpm', 'Yarn', 'Git', 'GitHub', 'GitLab', 'Anki', 'CalDAV',
						'CardDAV', 'Evernote', 'IntelliJ IDEA', 'Jekyll', 'Logseq', 'Notion',
						'PyCharm', 'React', 'Reddit', 'Roam Research', 'Svelte', 'VS Code',
						'Visual Studio Code', 'WebDAV', 'WebStorm',
					],
					acronyms: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'],
					ignoreWords: ['Japanese'],
				},
			],
			'obsidianmd/ui/sentence-case-locale-module': [
				'warn',
				{
					brands: [
						'iOS', 'iPadOS', 'macOS', 'Windows', 'Android', 'Linux', 'Obsidian',
						'Obsidian Sync', 'Obsidian Publish', 'Google', 'Gemini', 'Vertex AI',
						'OpenAI', 'GPT', 'Anthropic', 'Claude', 'Microsoft', 'Google Drive',
						'Dropbox', 'OneDrive', 'iCloud Drive', 'YouTube', 'Slack', 'Discord',
						'Telegram', 'WhatsApp', 'Twitter', 'X', 'Readwise', 'Zotero', 'Excalidraw',
						'Mermaid', 'Markdown', 'LaTeX', 'JavaScript', 'TypeScript', 'Node.js',
						'npm', 'pnpm', 'Yarn', 'Git', 'GitHub', 'GitLab', 'Anki', 'CalDAV',
						'CardDAV', 'Evernote', 'IntelliJ IDEA', 'Jekyll', 'Logseq', 'Notion',
						'PyCharm', 'React', 'Reddit', 'Roam Research', 'Svelte', 'VS Code',
						'Visual Studio Code', 'WebDAV', 'WebStorm',
					],
					acronyms: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'],
					ignoreWords: ['Japanese'],
				},
			],
		},
	},
]);
