import { App, Editor, parseYaml, TFile, TFolder } from 'obsidian';
import { FolderGoalConfig, GoalFrontmatter, HeadingGoalItem, PluginSettings } from '../types';

export interface FileGoalData {
	fileGoal?: number;
	defaultSectionGoal?: number;
	headingLevelGoals?: Record<number, number>;
	sectionGoals: HeadingGoalItem[];
	styleId?: number;
}

export interface EffectiveGoalData extends FileGoalData {
	inheritedDefaults?: {
		fileGoal?: number;
		defaultSectionGoal?: number;
		headingLevelGoals?: Record<number, number>;
		styleId?: number;
	};
}

/**
 * Handles reading and writing goal data in note frontmatter.
 */
export class FrontmatterManager {
	constructor(private app: App) {}

	/**
	 * Resolves effective goal data by cascading:
	 * Note Frontmatter -> Current Folder -> Parent Folders -> Global Settings
	 */
	public getEffectiveGoalData(file: TFile, settings: PluginSettings, content?: string): EffectiveGoalData {
		const fmData = this.getGoalData(file, content);

		const folderGoalsMap = new Map<string, FolderGoalConfig>();
		for (const fg of settings.folderGoals || []) {
			if (fg.folderPath) {
				const normalized = fg.folderPath.trim().replace(/^\/+|\/+$/g, '');
				if (normalized) {
					folderGoalsMap.set(normalized, fg);
				}
			}
		}

		let inheritedFileGoal: number | undefined;
		let inheritedDefaultSectionGoal: number | undefined;
		let inheritedStyleId: number | undefined;
		const inheritedHeadingLevelGoals: Record<number, number> = {};

		// Traverse upwards from note's folder to vault root
		let currentFolder: TFolder | null = file.parent;
		while (currentFolder && currentFolder.path && currentFolder.path !== '/') {
			const normalizedPath = currentFolder.path.replace(/^\/+|\/+$/g, '');
			const folderGoal = folderGoalsMap.get(normalizedPath);
			if (folderGoal) {
				if (inheritedFileGoal === undefined && folderGoal.fileGoal !== undefined && folderGoal.fileGoal > 0) {
					inheritedFileGoal = folderGoal.fileGoal;
				}
				if (
					inheritedDefaultSectionGoal === undefined &&
					folderGoal.defaultSectionGoal !== undefined &&
					folderGoal.defaultSectionGoal > 0
				) {
					inheritedDefaultSectionGoal = folderGoal.defaultSectionGoal;
				}
				if (inheritedStyleId === undefined && folderGoal.styleId !== undefined) {
					inheritedStyleId = folderGoal.styleId;
				}
				if (folderGoal.headingLevelGoals) {
					for (let level = 1; level <= 6; level++) {
						const val = folderGoal.headingLevelGoals[level];
						if (inheritedHeadingLevelGoals[level] === undefined && val !== undefined && val > 0) {
							inheritedHeadingLevelGoals[level] = val;
						}
					}
				}
			}
			currentFolder = currentFolder.parent;
		}

		// Fallback style to global default
		if (inheritedStyleId === undefined) {
			inheritedStyleId = settings.defaultStyleId ?? 1;
		}

		// Apply cascade: Note Frontmatter takes precedence over inherited folder goals
		const fileGoal = fmData.fileGoal !== undefined ? fmData.fileGoal : inheritedFileGoal;
		const defaultSectionGoal =
			fmData.defaultSectionGoal !== undefined ? fmData.defaultSectionGoal : inheritedDefaultSectionGoal;
		const styleId = fmData.styleId !== undefined ? fmData.styleId : inheritedStyleId;

		const headingLevelGoals: Record<number, number> = {};
		for (let level = 1; level <= 6; level++) {
			const fmVal = fmData.headingLevelGoals?.[level];
			const inheritedVal = inheritedHeadingLevelGoals[level];
			if (fmVal !== undefined && fmVal > 0) {
				headingLevelGoals[level] = fmVal;
			} else if (inheritedVal !== undefined && inheritedVal > 0) {
				headingLevelGoals[level] = inheritedVal;
			}
		}

		return {
			fileGoal,
			defaultSectionGoal,
			headingLevelGoals: Object.keys(headingLevelGoals).length > 0 ? headingLevelGoals : undefined,
			sectionGoals: fmData.sectionGoals,
			styleId,
			inheritedDefaults: {
				fileGoal: inheritedFileGoal,
				defaultSectionGoal: inheritedDefaultSectionGoal,
				headingLevelGoals:
					Object.keys(inheritedHeadingLevelGoals).length > 0 ? inheritedHeadingLevelGoals : undefined,
				styleId: inheritedStyleId,
			},
		};
	}


	/**
	 * Parse goal data from frontmatter object.
	 */
	public parseGoalFrontmatter(frontmatter: GoalFrontmatter | undefined): FileGoalData {
		if (!frontmatter) {
			return { sectionGoals: [] };
		}

		const fileGoal = typeof frontmatter['goal-file'] === 'number' ? frontmatter['goal-file'] : undefined;
		const defaultSectionGoal =
			typeof frontmatter['goal-section'] === 'number' ? frontmatter['goal-section'] : undefined;

		let styleId: number | undefined;
		if (typeof frontmatter['goal-style'] === 'number') {
			styleId = frontmatter['goal-style'];
		} else if (typeof frontmatter['goal-style'] === 'string') {
			const parsed = parseInt(frontmatter['goal-style'], 10);
			if (!isNaN(parsed) && parsed > 0) {
				styleId = parsed;
			}
		}

		const headingLevelGoals: Record<number, number> = {};
		for (let level = 1; level <= 6; level++) {
			const key = `goal-section-h${level}` as keyof GoalFrontmatter;
			const val = frontmatter[key];
			if (typeof val === 'number' && val > 0) {
				headingLevelGoals[level] = val;
			}
		}

		const sectionGoals: HeadingGoalItem[] = [];

		if (Array.isArray(frontmatter.goals)) {
			for (const item of frontmatter.goals) {
				if (typeof item === 'object' && item !== null) {
					// Handle standard `{ "Heading": 1500 }` or `{ heading: "Heading", goal: 1500 }`
					if ('heading' in item && 'goal' in item) {
						const typedItem = item as { heading: string; goal: number };
						if (typeof typedItem.heading === 'string' && typeof typedItem.goal === 'number') {
							sectionGoals.push({ [typedItem.heading]: typedItem.goal });
						}
					} else {
						for (const [heading, goal] of Object.entries(item)) {
							if (typeof goal === 'number') {
								sectionGoals.push({ [heading]: goal });
							}
						}
					}
				}
			}
		}

		return {
			fileGoal,
			defaultSectionGoal,
			headingLevelGoals: Object.keys(headingLevelGoals).length > 0 ? headingLevelGoals : undefined,
			sectionGoals,
			styleId,
		};
	}

	/**
	 * Parse goal data from file frontmatter cache or content string.
	 */
	public getGoalData(file: TFile, content?: string): FileGoalData {
		if (content) {
			const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
			if (fmMatch && fmMatch[1]) {
				try {
					const parsed = parseYaml(fmMatch[1]) as GoalFrontmatter | undefined;
					if (parsed && typeof parsed === 'object') {
						return this.parseGoalFrontmatter(parsed);
					}
				} catch {
					// Fallback to cache on YAML parse error
				}
			}
		}

		const cache = this.app.metadataCache?.getFileCache(file);
		const frontmatter = cache?.frontmatter as GoalFrontmatter | undefined;
		return this.parseGoalFrontmatter(frontmatter);
	}

	/**
	 * Save file goal, default section goal, level-specific default goals, specific section goals, and color style to frontmatter.
	 */
	public async saveGoalData(
		file: TFile,
		fileGoal: number | undefined,
		defaultSectionGoal: number | undefined,
		sectionGoals: HeadingGoalItem[],
		headingLevelGoals?: Record<number, number>,
		styleId?: number,
		defaultStyleId = 1,
	): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			if (fileGoal !== undefined && fileGoal > 0) {
				fm['goal-file'] = fileGoal;
			} else {
				delete fm['goal-file'];
			}

			if (defaultSectionGoal !== undefined && defaultSectionGoal > 0) {
				fm['goal-section'] = defaultSectionGoal;
			} else {
				delete fm['goal-section'];
			}

			if (styleId !== undefined && styleId !== defaultStyleId) {
				fm['goal-style'] = styleId;
			} else {
				delete fm['goal-style'];
			}

			for (let level = 1; level <= 6; level++) {
				const key = `goal-section-h${level}`;
				const val = headingLevelGoals?.[level];
				if (typeof val === 'number' && val > 0) {
					fm[key] = val;
				} else {
					delete fm[key];
				}
			}

			if (sectionGoals.length > 0) {
				// Clean list format for YAML: array of single-key objects
				fm.goals = sectionGoals.map((item) => ({ ...item }));
			} else {
				delete fm.goals;
			}
		});
	}

	/**
	 * Save goal data directly into the active editor buffer's frontmatter.
	 * Avoids triggering Obsidian external file modification warnings.
	 */
	public saveGoalDataToEditor(
		editor: Editor,
		fileGoal?: number,
		defaultSectionGoal?: number,
		sectionGoals: HeadingGoalItem[] = [],
		headingLevelGoals: Record<number, number> = {},
		styleId?: number,
		inheritedDefaultStyleId?: number,
	): boolean {
		const fullText = editor.getValue();
		const fmMatch = fullText.match(/^---\r?\n([\s\S]*?)\r?\n---/);
		let parsed: GoalFrontmatter = {};

		if (fmMatch) {
			try {
				parsed = (parseYaml(fmMatch[1] ?? '') as GoalFrontmatter) || {};
			} catch {
				parsed = {};
			}
		}

		if (fileGoal !== undefined && fileGoal > 0) {
			parsed['goal-file'] = fileGoal;
		} else {
			delete parsed['goal-file'];
		}

		if (defaultSectionGoal !== undefined && defaultSectionGoal > 0) {
			parsed['goal-section'] = defaultSectionGoal;
		} else {
			delete parsed['goal-section'];
		}

		for (let level = 1; level <= 6; level++) {
			const key = `goal-section-h${level}` as 'goal-section-h1' | 'goal-section-h2' | 'goal-section-h3' | 'goal-section-h4' | 'goal-section-h5' | 'goal-section-h6';
			const val = headingLevelGoals[level];
			if (val !== undefined && val > 0) {
				parsed[key] = val;
			} else {
				delete parsed[key];
			}
		}

		if (styleId !== undefined && styleId > 0 && styleId !== (inheritedDefaultStyleId ?? 1)) {
			parsed['goal-style'] = styleId;
		} else {
			delete parsed['goal-style'];
		}

		if (sectionGoals.length > 0) {
			parsed.goals = sectionGoals;
		} else {
			delete parsed.goals;
		}

		const yamlLines: string[] = ['---'];
		if (parsed['goal-file'] !== undefined) yamlLines.push(`goal-file: ${parsed['goal-file']}`);
		if (parsed['goal-section'] !== undefined) yamlLines.push(`goal-section: ${parsed['goal-section']}`);
		for (let level = 1; level <= 6; level++) {
			const key = `goal-section-h${level}` as 'goal-section-h1' | 'goal-section-h2' | 'goal-section-h3' | 'goal-section-h4' | 'goal-section-h5' | 'goal-section-h6';
			const val = parsed[key];
			if (typeof val === 'number') yamlLines.push(`${key}: ${val}`);
		}
		if (parsed['goal-style'] !== undefined) yamlLines.push(`goal-style: ${parsed['goal-style']}`);
		if (parsed.goals && parsed.goals.length > 0) {
			yamlLines.push('goals:');
			for (const item of parsed.goals) {
				const [hName, val] = Object.entries(item)[0] ?? [];
				if (hName && typeof val === 'number') {
					const needsQuotes = /[:#\-[\]{}>|%&*!?'",@]/.test(hName);
					const formattedKey = needsQuotes ? JSON.stringify(hName) : hName;
					yamlLines.push(`  - ${formattedKey}: ${val}`);
				}
			}
		}
		yamlLines.push('---');

		const newFmBlock = yamlLines.join('\n');

		if (fmMatch) {
			const lineCount = editor.lineCount();
			let endLine = 0;
			let foundEnd = false;
			for (let i = 1; i < lineCount; i++) {
				const line = editor.getLine(i);
				if (line !== undefined && line.trim() === '---') {
					endLine = i;
					foundEnd = true;
					break;
				}
			}
			if (foundEnd) {
				const endLineLen = editor.getLine(endLine)?.length ?? 3;
				editor.replaceRange(newFmBlock, { line: 0, ch: 0 }, { line: endLine, ch: endLineLen });
				return true;
			}
		} else {
			editor.replaceRange(newFmBlock + '\n', { line: 0, ch: 0 }, { line: 0, ch: 0 });
			return true;
		}

		return false;
	}

	/**
	 * Rename a specific heading in the frontmatter goals list if it exists.
	 * Preserves the goal value and original order.
	 * Directly reads and writes inside processFrontMatter to avoid cache latency.
	 * Returns true if a rename occurred, false otherwise.
	 */
	public async renameSectionGoal(file: TFile, oldHeading: string, newHeading: string): Promise<boolean> {
		const trimmedOld = oldHeading.trim();
		const trimmedNew = newHeading.trim();
		if (!trimmedOld || !trimmedNew || trimmedOld === trimmedNew) {
			return false;
		}

		// Fast check: avoid frontmatter I/O if no section goals exist or old heading is not present
		const { sectionGoals } = this.getGoalData(file);
		const hasOldHeading = sectionGoals.some((item) => {
			const entries = Object.entries(item);
			return entries.length > 0 && entries[0]![0] === trimmedOld;
		});

		if (!hasOldHeading) {
			return false;
		}

		let matched = false;

		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			if (!Array.isArray(fm.goals)) {
				return;
			}

			const updatedGoals: HeadingGoalItem[] = [];
			for (const item of fm.goals) {
				if (typeof item === 'object' && item !== null) {
					if ('heading' in item && 'goal' in item) {
						const typedItem = item as { heading: string; goal: number };
						if (typedItem.heading === trimmedOld && !matched) {
							matched = true;
							updatedGoals.push({ [trimmedNew]: typedItem.goal });
						} else {
							updatedGoals.push({ [typedItem.heading]: typedItem.goal });
						}
					} else {
						const entries = Object.entries(item);
						if (entries.length > 0) {
							const [hName, goalVal] = entries[0]!;
							if (hName === trimmedOld && !matched && typeof goalVal === 'number') {
								matched = true;
								updatedGoals.push({ [trimmedNew]: goalVal });
							} else if (typeof goalVal === 'number') {
								updatedGoals.push({ [hName]: goalVal });
							}
						}
					}
				}
			}

			if (matched) {
				fm.goals = updatedGoals.map((g) => ({ ...g }));
			}
		});

		return matched;
	}

	/**
	 * Rename a specific heading in the active editor buffer's frontmatter.
	 * Directly updates the editor line without causing external file change notifications or offset corruption.
	 * Returns true if a rename occurred, false otherwise.
	 */
	public renameSectionGoalInEditor(editor: Editor, oldHeading: string, newHeading: string): boolean {
		const trimmedOld = oldHeading.trim();
		const trimmedNew = newHeading.trim();
		if (!trimmedOld || !trimmedNew || trimmedOld === trimmedNew) {
			return false;
		}

		// Ensure first line is frontmatter delimiter
		const firstLine = editor.getLine(0);
		if (firstLine === undefined || firstLine.trim() !== '---') {
			return false;
		}

		const lineCount = editor.lineCount();
		let inFrontmatter = false;
		let inGoals = false;
		let targetLine = -1;
		let originalLineText = '';
		let goalValue: number | undefined;

		for (let i = 0; i < lineCount; i++) {
			const line = editor.getLine(i);
			if (line === undefined) break;

			if (i === 0 && line.trim() === '---') {
				inFrontmatter = true;
				continue;
			}
			if (inFrontmatter && i > 0 && line.trim() === '---') {
				// End of frontmatter block
				break;
			}

			if (inFrontmatter) {
				if (/^[a-zA-Z0-9_-]+:/.test(line)) {
					inGoals = /^goals\s*:/.test(line);
				}

				if (inGoals) {
					// Extract list item and key/value safely using lastIndexOf(':')
					const listMatch = line.match(/^(\s*-\s+)(.*)$/);
					if (listMatch) {
						const itemContent = listMatch[2]!.trim();
						const colonIdx = itemContent.lastIndexOf(':');
						if (colonIdx !== -1) {
							let keyPart = itemContent.slice(0, colonIdx).trim();
							const valPart = itemContent.slice(colonIdx + 1).trim();
							const valNum = parseInt(valPart, 10);

							// Strip surrounding quotes from keyPart if present
							if (
								(keyPart.startsWith('"') && keyPart.endsWith('"')) ||
								(keyPart.startsWith("'") && keyPart.endsWith("'"))
							) {
								keyPart = keyPart.slice(1, -1);
							}

							if (keyPart === trimmedOld && !isNaN(valNum)) {
								targetLine = i;
								originalLineText = line;
								goalValue = valNum;
								break;
							}
						}
					}
				}
			}
		}

		if (targetLine === -1 || goalValue === undefined) {
			return false;
		}

		// Format new heading safely for YAML if it contains special characters
		const needsQuotes = /[:#\-[\]{}>|%&*!?'",@]/.test(trimmedNew);
		const formattedNew = needsQuotes ? JSON.stringify(trimmedNew) : trimmedNew;

		const indentMatch = originalLineText.match(/^\s*-\s*/);
		const indent = indentMatch ? indentMatch[0] : '  - ';
		const newLineText = `${indent}${formattedNew}: ${goalValue}`;

		if (editor.setLine) {
			editor.setLine(targetLine, newLineText);
		} else {
			// Fallback if setLine is not available
			const lineContent = editor.getLine(targetLine) ?? '';
			const startPos = { line: targetLine, ch: 0 };
			const endPos = { line: targetLine, ch: lineContent.length };
			editor.replaceRange(newLineText, startPos, endPos);
		}

		return true;
	}
}




