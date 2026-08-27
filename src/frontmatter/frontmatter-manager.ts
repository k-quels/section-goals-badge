import { App, TFile, TFolder } from 'obsidian';
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
	public getEffectiveGoalData(file: TFile, settings: PluginSettings): EffectiveGoalData {
		const fmData = this.getGoalData(file);

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
	 * Parse goal data from file frontmatter cache.
	 */
	public getGoalData(file: TFile): FileGoalData {
		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter as GoalFrontmatter | undefined;

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
	 * Synchronize frontmatter goals when headings in note content are updated/renamed.
	 * Compares current headings in order and updates matching goals.
	 */
	public async syncHeadings(file: TFile, currentHeadings: string[]): Promise<void> {
		const { fileGoal, defaultSectionGoal, headingLevelGoals, sectionGoals, styleId } = this.getGoalData(file);
		if (sectionGoals.length === 0) return;

		let hasChanges = false;
		const updatedGoals: HeadingGoalItem[] = [];

		// Match in order
		for (let i = 0; i < currentHeadings.length; i++) {
			const heading = currentHeadings[i];
			if (heading && i < sectionGoals.length) {
				const existingItem = sectionGoals[i];
				if (existingItem) {
					const entries = Object.entries(existingItem);
					if (entries.length > 0) {
						const [oldHeading, goal] = entries[0]!;
						if (typeof goal === 'number') {
							if (oldHeading !== heading) {
								hasChanges = true;
							}
							updatedGoals.push({ [heading]: goal });
						}
					}
				}
			}
		}

		// If heading count decreased, that's also a change
		if (sectionGoals.length > currentHeadings.length) {
			hasChanges = true;
		}

		if (hasChanges) {
			await this.saveGoalData(file, fileGoal, defaultSectionGoal, updatedGoals, headingLevelGoals, styleId);
		}
	}
}
