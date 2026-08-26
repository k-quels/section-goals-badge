import { App, TFile } from 'obsidian';
import { GoalFrontmatter, HeadingGoalItem } from '../types';

export interface FileGoalData {
	fileGoal?: number;
	defaultSectionGoal?: number;
	headingLevelGoals?: Record<number, number>;
	sectionGoals: HeadingGoalItem[];
}

/**
 * Handles reading and writing goal data in note frontmatter.
 */
export class FrontmatterManager {
	constructor(private app: App) {}

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
		};
	}

	/**
	 * Save file goal, default section goal, level-specific default goals, and specific section goals to frontmatter.
	 */
	public async saveGoalData(
		file: TFile,
		fileGoal: number | undefined,
		defaultSectionGoal: number | undefined,
		sectionGoals: HeadingGoalItem[],
		headingLevelGoals?: Record<number, number>,
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
		const { fileGoal, defaultSectionGoal, headingLevelGoals, sectionGoals } = this.getGoalData(file);
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
			await this.saveGoalData(file, fileGoal, defaultSectionGoal, updatedGoals, headingLevelGoals);
		}
	}
}
