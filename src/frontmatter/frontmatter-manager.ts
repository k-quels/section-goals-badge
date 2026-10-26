import { App, Editor, parseYaml, TFile, TFolder } from 'obsidian';
import { FolderGoalConfig, GoalFrontmatter, HeadingGoalItem, PluginSettings, SectionDateGoalItem, SectionGoalItem, DateReferenceMode } from '../types';
import { calculateDateProgress, resolveChainedDateGoals } from '../utils/date-goal';

export interface FileGoalData {
	fileGoal?: number;
	defaultSectionGoal?: number;
	headingLevelGoals?: Record<number, number>;
	sectionGoals: Array<HeadingGoalItem | SectionGoalItem>;
	styleId?: number;
	fileTargetDate?: string;
	fileStartDate?: string;
	fileCycle?: string;
	fileDateReference?: DateReferenceMode;
	sectionDateGoals?: SectionDateGoalItem[];
}

export interface EffectiveGoalData extends FileGoalData {
	effectiveStartTime?: string;
	effectiveTargetTime?: string;
	rawGoalData?: FileGoalData;
	inheritedDefaults?: {
		fileGoal?: number;
		defaultSectionGoal?: number;
		headingLevelGoals?: Record<number, number>;
		styleId?: number;
		defaultDateReference?: DateReferenceMode;
		defaultCycle?: string;
		defaultStartTime?: string;
		defaultTargetTime?: string;
	};
}

function extractDateString(val: unknown): string | undefined {
	if (typeof val === 'string') {
		const trimmed = val.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	}
	if (typeof val === 'number') {
		return String(val);
	}
	if (val instanceof Date || (typeof val === 'object' && val !== null && Object.prototype.toString.call(val) === '[object Date]')) {
		const d = val as Date;
		if (isNaN(d.getTime())) return undefined;
		return d.toISOString().slice(0, 10);
	}
	return undefined;
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
		let inheritedDateReference: DateReferenceMode | undefined;
		let inheritedCycle: string | undefined;
		let inheritedStartTime: string | undefined;
		let inheritedTargetTime: string | undefined;

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
				if (inheritedDateReference === undefined && folderGoal.defaultDateReference !== undefined) {
					inheritedDateReference = folderGoal.defaultDateReference;
				}
				if (inheritedCycle === undefined && folderGoal.defaultCycle !== undefined) {
					inheritedCycle = folderGoal.defaultCycle;
				}
				if (inheritedStartTime === undefined && folderGoal.defaultStartTime !== undefined) {
					inheritedStartTime = folderGoal.defaultStartTime;
				}
				if (inheritedTargetTime === undefined && folderGoal.defaultTargetTime !== undefined) {
					inheritedTargetTime = folderGoal.defaultTargetTime;
				}
			}
			currentFolder = currentFolder.parent;
		}

		// Fallback style and date cycle to global default
		if (inheritedStyleId === undefined) {
			inheritedStyleId = settings.defaultStyleId ?? 1;
		}
		if (inheritedCycle === undefined && settings.defaultDateCycle && settings.defaultDateCycle !== 'none') {
			inheritedCycle = settings.defaultDateCycle;
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

		const fileDateReference =
			fmData.fileDateReference ?? inheritedDateReference ?? settings.defaultDateReference ?? 'parent';
		const fileCycle = fmData.fileCycle !== undefined ? fmData.fileCycle : inheritedCycle;
		const effectiveStartTime = inheritedStartTime || settings.defaultStartTime;
		const effectiveTargetTime = inheritedTargetTime || settings.defaultTargetTime;

		return {
			fileGoal,
			defaultSectionGoal,
			headingLevelGoals: Object.keys(headingLevelGoals).length > 0 ? headingLevelGoals : undefined,
			sectionGoals: fmData.sectionGoals,
			styleId,
			fileTargetDate: fmData.fileTargetDate,
			fileStartDate: fmData.fileStartDate,
			fileCycle,
			fileDateReference,
			sectionDateGoals: fmData.sectionDateGoals,
			effectiveStartTime,
			effectiveTargetTime,
			rawGoalData: fmData,
			inheritedDefaults: {
				fileGoal: inheritedFileGoal,
				defaultSectionGoal: inheritedDefaultSectionGoal,
				headingLevelGoals:
					Object.keys(inheritedHeadingLevelGoals).length > 0 ? inheritedHeadingLevelGoals : undefined,
				styleId: inheritedStyleId,
				defaultDateReference: inheritedDateReference,
				defaultCycle: inheritedCycle,
				defaultStartTime: inheritedStartTime,
				defaultTargetTime: inheritedTargetTime,
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

		const sectionGoals: Array<HeadingGoalItem | SectionGoalItem> = [];
		const sectionDateGoals: SectionDateGoalItem[] = [];

		if (Array.isArray(frontmatter.goals)) {
			for (const item of frontmatter.goals) {
				if (typeof item === 'object' && item !== null) {
					if ('heading' in item && typeof item.heading === 'string') {
						const typed = item as Record<string, unknown>;
						const heading = String(typed.heading);
						const index = typeof typed.index === 'number' && typed.index > 0
							? typed.index
							: typeof typed.occurrence === 'number' && typed.occurrence > 0
								? typed.occurrence
								: undefined;
						const goal = typeof typed.goal === 'number' && typed.goal > 0 ? typed.goal : undefined;
						const target = extractDateString(typed['target-date']) ?? extractDateString(typed.target);
						const start = extractDateString(typed['start-date']) ?? extractDateString(typed.start);
						const cycle = typeof typed.cycle === 'string' ? typed.cycle.trim() : undefined;

						if (goal !== undefined) {
							if (index !== undefined || target || start || cycle) {
								sectionGoals.push({
									heading,
									goal,
									index,
									occurrence: index,
									'target-date': target,
									'start-date': start,
									target,
									start,
									cycle,
								});
							} else {
								sectionGoals.push({ [heading]: goal });
							}
						} else if (target || start || cycle) {
							// Item has only date properties without goal count
							sectionGoals.push({
								heading,
								index,
								occurrence: index,
								'target-date': target,
								'start-date': start,
								target,
								start,
								cycle,
							});
						}

						if (target || start || cycle) {
							sectionDateGoals.push({
								heading,
								index,
								occurrence: index,
								'target-date': target,
								'start-date': start,
								target,
								start,
								cycle,
							});
						}
					} else {
						// Legacy key-value format `{ "Heading": 1500 }`
						for (const [heading, goal] of Object.entries(item)) {
							if (typeof goal === 'number') {
								sectionGoals.push({ [heading]: goal });
							}
						}
					}
				}
			}
		}

		// Legacy fallback: parse frontmatter['goal-dates'] if present and merge
		if (Array.isArray(frontmatter['goal-dates'])) {
			for (const item of frontmatter['goal-dates']) {
				if (typeof item === 'object' && item !== null && 'heading' in item && typeof item.heading === 'string') {
					const typed = item as unknown as Record<string, unknown>;
					const heading = String(typed.heading);
					const index = typeof typed.index === 'number' && typed.index > 0
						? typed.index
						: typeof typed.occurrence === 'number' && typed.occurrence > 0
							? typed.occurrence
							: undefined;
					const target = extractDateString(typed['target-date']) ?? extractDateString(typed.target);
					const start = extractDateString(typed['start-date']) ?? extractDateString(typed.start);
					const cycle = typeof typed.cycle === 'string' ? typed.cycle.trim() : undefined;

					const exists = sectionDateGoals.some(
						(g) => g.heading === heading && (g.index === index || (g.index === undefined && index === undefined)),
					);
					if (!exists && (target || start || cycle)) {
						sectionDateGoals.push({
							heading,
							index,
							occurrence: index,
							'target-date': target,
							'start-date': start,
							target,
							start,
							cycle,
						});
					}
				}
			}
		}

		// Parse date goal properties
		const fileTargetDate = extractDateString(frontmatter['goal-target-date']);
		const fileStartDate = extractDateString(frontmatter['goal-start-date']);
		const fileCycle =
			typeof frontmatter['goal-cycle'] === 'string'
				? frontmatter['goal-cycle'].trim()
				: undefined;

		const rawRef = frontmatter['goal-date-reference'];
		const fileDateReference: DateReferenceMode | undefined =
			rawRef === 'parent' || rawRef === 'note' || rawRef === 'none'
				? rawRef
				: undefined;

		return {
			fileGoal,
			defaultSectionGoal,
			headingLevelGoals: Object.keys(headingLevelGoals).length > 0 ? headingLevelGoals : undefined,
			sectionGoals,
			styleId,
			fileTargetDate,
			fileStartDate,
			fileCycle,
			fileDateReference,
			sectionDateGoals: sectionDateGoals.length > 0 ? sectionDateGoals : undefined,
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
					if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
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
		sectionGoals: Array<HeadingGoalItem | SectionGoalItem>,
		headingLevelGoals?: Record<number, number>,
		styleId?: number,
		defaultStyleId = 1,
		dateGoals?: {
			fileTargetDate?: string;
			fileStartDate?: string;
			fileCycle?: string;
			fileDateReference?: DateReferenceMode;
			sectionDateGoals?: SectionDateGoalItem[];
		},
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

			// Merge dateGoals.sectionDateGoals into unifiedSectionGoals
			const unifiedSectionGoals: SectionGoalItem[] = [];
			for (const item of sectionGoals) {
				if ('heading' in item && typeof item.heading === 'string') {
					unifiedSectionGoals.push({ ...item } as SectionGoalItem);
				} else {
					const entries = Object.entries(item as Record<string, unknown>);
					if (entries.length > 0 && typeof entries[0]![1] === 'number') {
						unifiedSectionGoals.push({ heading: entries[0]![0], goal: entries[0]![1] });
					}
				}
			}

			if (dateGoals?.sectionDateGoals) {
				for (const dItem of dateGoals.sectionDateGoals) {
					const idx = dItem.index ?? dItem.occurrence;
					const existing = unifiedSectionGoals.find(
						(g) => g.heading === dItem.heading && ((g.index ?? g.occurrence) === idx || (!g.index && !g.occurrence && !idx)),
					);
					if (existing) {
						if (dItem['target-date'] || dItem.target) existing['target-date'] = dItem['target-date'] ?? dItem.target;
						if (dItem['start-date'] || dItem.start) existing['start-date'] = dItem['start-date'] ?? dItem.start;
						if (dItem.cycle) existing.cycle = dItem.cycle;
					} else {
						unifiedSectionGoals.push({
							heading: dItem.heading,
							index: idx,
							occurrence: idx,
							'target-date': dItem['target-date'] ?? dItem.target,
							'start-date': dItem['start-date'] ?? dItem.start,
							cycle: dItem.cycle,
						});
					}
				}
			}

			if (unifiedSectionGoals.length > 0) {
				fm.goals = unifiedSectionGoals.map((item) => {
					const idx = item.index ?? item.occurrence;
					const target = item['target-date'] ?? item.target;
					const start = item['start-date'] ?? item.start;
					const cycle = item.cycle;

					if (idx !== undefined || target || start || cycle) {
						const res: Record<string, unknown> = { heading: item.heading };
						if (typeof idx === 'number' && idx > 0) {
							res.index = idx;
						}
						if (typeof item.goal === 'number' && item.goal > 0) {
							res.goal = item.goal;
						}
						if (target && target.trim()) {
							res['target-date'] = target.trim();
						}
						if (start && start.trim()) {
							res['start-date'] = start.trim();
						}
						if (cycle && cycle.trim()) {
							res.cycle = cycle.trim();
						}
						return res;
					}

					if (typeof item.goal === 'number' && item.goal > 0) {
						return { [item.heading]: item.goal };
					}
					return { ...item };
				});
			} else {
				delete fm.goals;
			}

			if (dateGoals !== undefined) {
				if (dateGoals.fileTargetDate && dateGoals.fileTargetDate.trim()) {
					fm['goal-target-date'] = dateGoals.fileTargetDate.trim();
				} else {
					delete fm['goal-target-date'];
				}

				if (dateGoals.fileStartDate && dateGoals.fileStartDate.trim()) {
					fm['goal-start-date'] = dateGoals.fileStartDate.trim();
				} else {
					delete fm['goal-start-date'];
				}

				if (dateGoals.fileCycle && dateGoals.fileCycle.trim()) {
					fm['goal-cycle'] = dateGoals.fileCycle.trim();
				} else {
					delete fm['goal-cycle'];
				}

				if (dateGoals.fileDateReference) {
					fm['goal-date-reference'] = dateGoals.fileDateReference;
				} else {
					delete fm['goal-date-reference'];
				}
			}

			// Clean up legacy goal-dates field from frontmatter
			delete fm['goal-dates'];
		});
	}

	/**
	 * Resolves date progress for a given section heading, falling back to file-level dates if unspecified.
	 */
	public resolveDateProgress(
		heading: string | null | undefined,
		fmData: FileGoalData,
		today: Date = new Date(),
		defaultStartTime = '00:00',
		defaultTargetTime = '23:59',
		headings?: Array<string | { heading: string; level?: number }>,
		sectionIndex?: number,
		occurrenceOverrides?: Map<number, number>,
		resolvedMapCache?: Map<string | number, import('../utils/date-goal').ResolvedSectionDateGoal>,
	): import('../types').DateProgressInfo | null {
		if ((heading || sectionIndex !== undefined) && headings && headings.length > 0) {
			const resolvedMap =
				resolvedMapCache ??
				resolveChainedDateGoals(
					headings,
					fmData.fileStartDate,
					fmData.fileTargetDate,
					fmData.fileCycle,
					fmData.sectionDateGoals,
					defaultStartTime,
					defaultTargetTime,
					fmData.fileDateReference ?? 'parent',
					occurrenceOverrides,
				);
			const resolved =
				sectionIndex !== undefined && sectionIndex >= 0
					? resolvedMap.get(sectionIndex)
					: (heading ? resolvedMap.get(heading) : undefined);
			if (resolved && (resolved.target || resolved.start)) {
				return calculateDateProgress(
					resolved.start,
					resolved.target,
					undefined,
					today,
					resolved.isFallback,
					defaultStartTime,
					defaultTargetTime,
				);
			}
			return null;
		}

		let sectionGoal: SectionDateGoalItem | undefined;
		if (heading && fmData.sectionDateGoals) {
			sectionGoal = fmData.sectionDateGoals.find((item) => item.heading === heading);
		}

		if (heading) {
			const dateRef = fmData.fileDateReference ?? 'parent';
			if (dateRef === 'none' && !sectionGoal?.target && !sectionGoal?.start) {
				return null;
			}
		}

		const hasSectionTarget = Boolean(sectionGoal?.target?.trim());
		const hasSectionStart = Boolean(sectionGoal?.start?.trim());
		const hasSectionCycle = Boolean(sectionGoal?.cycle?.trim());
		const hasAnySectionSetting = hasSectionTarget || hasSectionStart || hasSectionCycle;

		const targetDate = hasSectionTarget ? sectionGoal!.target : fmData.fileTargetDate;
		const startDate = hasSectionStart ? sectionGoal!.start : fmData.fileStartDate;
		// Do not inherit file-level cycle if section has its own target/start configured
		const cycle = hasAnySectionSetting ? sectionGoal?.cycle : fmData.fileCycle;

		if (!targetDate && !startDate) {
			return null;
		}

		const isFallback = !hasAnySectionSetting;
		return calculateDateProgress(
			startDate,
			targetDate,
			cycle,
			today,
			isFallback,
			defaultStartTime,
			defaultTargetTime,
		);
	}

	/**
	 * Save goal data directly into the active editor buffer's frontmatter.
	 * Avoids triggering Obsidian external file modification warnings.
	 */
	public saveGoalDataToEditor(
		editor: Editor,
		fileGoal?: number,
		defaultSectionGoal?: number,
		sectionGoals: Array<HeadingGoalItem | SectionGoalItem> = [],
		headingLevelGoals: Record<number, number> = {},
		styleId?: number,
		inheritedDefaultStyleId?: number,
		dateGoals?: {
			fileTargetDate?: string;
			fileStartDate?: string;
			fileCycle?: string;
			fileDateReference?: DateReferenceMode;
			sectionDateGoals?: SectionDateGoalItem[];
		},
	): boolean {
		const fullText = editor.getValue();
		const fmMatch = fullText.match(/^---\r?\n([\s\S]*?)\r?\n---/);
		let parsed: GoalFrontmatter = {};

		if (fmMatch) {
			try {
				const raw: unknown = parseYaml(fmMatch[1] ?? '');
				if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
					parsed = raw;
				}
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

		// Merge dateGoals.sectionDateGoals into unifiedSectionGoals
		const unifiedSectionGoals: SectionGoalItem[] = [];
		for (const item of sectionGoals) {
			if ('heading' in item && typeof item.heading === 'string') {
				unifiedSectionGoals.push({ ...item } as SectionGoalItem);
			} else {
				const entries = Object.entries(item as Record<string, unknown>);
				if (entries.length > 0 && typeof entries[0]![1] === 'number') {
					unifiedSectionGoals.push({ heading: entries[0]![0], goal: entries[0]![1] });
				}
			}
		}

		if (dateGoals?.sectionDateGoals) {
			for (const dItem of dateGoals.sectionDateGoals) {
				const idx = dItem.index ?? dItem.occurrence;
				const existing = unifiedSectionGoals.find(
					(g) => g.heading === dItem.heading && ((g.index ?? g.occurrence) === idx || (!g.index && !g.occurrence && !idx)),
				);
				if (existing) {
					if (dItem['target-date'] || dItem.target) existing['target-date'] = dItem['target-date'] ?? dItem.target;
					if (dItem['start-date'] || dItem.start) existing['start-date'] = dItem['start-date'] ?? dItem.start;
					if (dItem.cycle) existing.cycle = dItem.cycle;
				} else {
					unifiedSectionGoals.push({
						heading: dItem.heading,
						index: idx,
						occurrence: idx,
						'target-date': dItem['target-date'] ?? dItem.target,
						'start-date': dItem['start-date'] ?? dItem.start,
						cycle: dItem.cycle,
					});
				}
			}
		}

		if (unifiedSectionGoals.length > 0) {
			parsed.goals = unifiedSectionGoals;
		} else {
			delete parsed.goals;
		}

		if (dateGoals !== undefined) {
			if (dateGoals.fileTargetDate && dateGoals.fileTargetDate.trim()) {
				parsed['goal-target-date'] = dateGoals.fileTargetDate.trim();
			} else {
				delete parsed['goal-target-date'];
			}

			if (dateGoals.fileStartDate && dateGoals.fileStartDate.trim()) {
				parsed['goal-start-date'] = dateGoals.fileStartDate.trim();
			} else {
				delete parsed['goal-start-date'];
			}

			if (dateGoals.fileCycle && dateGoals.fileCycle.trim()) {
				parsed['goal-cycle'] = dateGoals.fileCycle.trim();
			} else {
				delete parsed['goal-cycle'];
			}

			if (dateGoals.fileDateReference) {
				parsed['goal-date-reference'] = dateGoals.fileDateReference;
			} else {
				delete parsed['goal-date-reference'];
			}
		}

		delete parsed['goal-dates'];

		const yamlLines: string[] = ['---'];
		if (parsed['goal-file'] !== undefined) yamlLines.push(`goal-file: ${parsed['goal-file']}`);
		if (parsed['goal-section'] !== undefined) yamlLines.push(`goal-section: ${parsed['goal-section']}`);
		for (let level = 1; level <= 6; level++) {
			const key = `goal-section-h${level}` as 'goal-section-h1' | 'goal-section-h2' | 'goal-section-h3' | 'goal-section-h4' | 'goal-section-h5' | 'goal-section-h6';
			const val = parsed[key];
			if (typeof val === 'number') yamlLines.push(`${key}: ${val}`);
		}
		if (parsed['goal-style'] !== undefined) yamlLines.push(`goal-style: ${parsed['goal-style']}`);
		if (parsed['goal-target-date'] !== undefined) yamlLines.push(`goal-target-date: "${parsed['goal-target-date']}"`);
		if (parsed['goal-start-date'] !== undefined) yamlLines.push(`goal-start-date: "${parsed['goal-start-date']}"`);
		if (parsed['goal-cycle'] !== undefined) yamlLines.push(`goal-cycle: "${parsed['goal-cycle']}"`);
		if (parsed['goal-date-reference'] !== undefined) yamlLines.push(`goal-date-reference: ${parsed['goal-date-reference']}`);
		if (parsed.goals && parsed.goals.length > 0) {
			yamlLines.push('goals:');
			for (const item of parsed.goals) {
				if ('heading' in item && typeof item.heading === 'string') {
					const typed = item as SectionGoalItem;
					const idx = typed.index ?? typed.occurrence;
					const target = typed['target-date'] ?? typed.target;
					const start = typed['start-date'] ?? typed.start;
					const cycle = typed.cycle;

					if (idx !== undefined || target || start || cycle) {
						const needsQuotes = /[:#\-[\]{}>|%&*!?'",@]/.test(typed.heading);
						const formattedHeading = needsQuotes ? JSON.stringify(typed.heading) : typed.heading;
						yamlLines.push(`  - heading: ${formattedHeading}`);
						if (typeof idx === 'number' && idx > 0) {
							yamlLines.push(`    index: ${idx}`);
						}
						if (typeof typed.goal === 'number' && typed.goal > 0) {
							yamlLines.push(`    goal: ${typed.goal}`);
						}
						if (target && target.trim()) {
							yamlLines.push(`    target-date: "${target.trim()}"`);
						}
						if (start && start.trim()) {
							yamlLines.push(`    start-date: "${start.trim()}"`);
						}
						if (cycle && cycle.trim()) {
							yamlLines.push(`    cycle: "${cycle.trim()}"`);
						}
					} else if (typeof typed.goal === 'number' && typed.goal > 0) {
						const needsQuotes = /[:#\-[\]{}>|%&*!?'",@]/.test(typed.heading);
						const formattedKey = needsQuotes ? JSON.stringify(typed.heading) : typed.heading;
						yamlLines.push(`  - ${formattedKey}: ${typed.goal}`);
					}
				} else {
					const [hName, val] = Object.entries(item)[0] ?? [];
					if (hName && typeof val === 'number') {
						const needsQuotes = /[:#\-[\]{}>|%&*!?'",@]/.test(hName);
						const formattedKey = needsQuotes ? JSON.stringify(hName) : hName;
						yamlLines.push(`  - ${formattedKey}: ${val}`);
					}
				}
			}
		}
		yamlLines.push('---');

		const newFmBlock = yamlLines.join('\n');

		if (fmMatch) {
			if (fmMatch[0].trim() === newFmBlock.trim()) {
				return true;
			}
			const lineCount = editor.lineCount();
			let endLine = 0;
			let foundEnd = false;
			const maxScan = Math.min(lineCount, 500);
			for (let i = 1; i < maxScan; i++) {
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
	public async renameSectionGoal(
		file: TFile,
		oldHeading: string,
		newHeading: string,
		occurrenceIndex = 0,
	): Promise<boolean> {
		const trimmedOld = oldHeading.trim();
		const trimmedNew = newHeading.trim();
		if (!trimmedOld || !trimmedNew || trimmedOld === trimmedNew) {
			return false;
		}

		const targetOccurrence = occurrenceIndex + 1; // 1-indexed

		// Fast check: avoid frontmatter I/O if neither section goals nor section date goals contain old heading
		const { sectionGoals, sectionDateGoals } = this.getGoalData(file);
		const hasOldHeadingInGoals = sectionGoals.some((item) => {
			if ('heading' in item) return item.heading === trimmedOld;
			const entries = Object.entries(item);
			return entries.length > 0 && entries[0]![0] === trimmedOld;
		});
		const hasOldHeadingInDateGoals = sectionDateGoals?.some((item) => item.heading === trimmedOld) ?? false;

		if (!hasOldHeadingInGoals && !hasOldHeadingInDateGoals) {
			return false;
		}

		let matched = false;

		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			// Check if target occurrence actually exists in fm.goals
			const hasTargetInGoals = Array.isArray(fm.goals) && (() => {
				let c = 0;
				for (const item of fm.goals as unknown[]) {
					if (typeof item === 'object' && item !== null) {
						const record = item as Record<string, unknown>;
						if ('heading' in record && typeof record.heading === 'string' && record.heading === trimmedOld) {
							c++;
							const explicitIdx = typeof record.index === 'number' ? record.index : (typeof record.occurrence === 'number' ? record.occurrence : undefined);
							const idx = typeof explicitIdx === 'number' ? explicitIdx : c;
							if (idx === targetOccurrence) return true;
						} else {
							const entries = Object.entries(item as Record<string, unknown>);
							if (entries.length > 0 && entries[0]![0] === trimmedOld && typeof entries[0]![1] === 'number') {
								c++;
								if (c === targetOccurrence) return true;
							}
						}
					}
				}
				return false;
			})();

			// 1. Rename in fm.goals
			if (hasTargetInGoals && Array.isArray(fm.goals)) {
				let goalsOccCount = 0;
				const updatedGoals: Array<HeadingGoalItem | SectionGoalItem> = [];
				for (const item of fm.goals as unknown[]) {
					if (typeof item === 'object' && item !== null) {
						const record = item as Record<string, unknown>;
						if ('heading' in record && typeof record.heading === 'string') {
							const typedItem = item as SectionGoalItem;
							if (typedItem.heading === trimmedOld) {
								goalsOccCount++;
								const explicitIdx = typedItem.index ?? typedItem.occurrence;
								const idx = typeof explicitIdx === 'number' ? explicitIdx : goalsOccCount;
								if (idx === targetOccurrence) {
									matched = true;
									const cleanItem: SectionGoalItem = {
										...typedItem,
										heading: trimmedNew,
									};
									delete cleanItem.index;
									delete cleanItem.occurrence;
									updatedGoals.push(cleanItem);
								} else if (idx > targetOccurrence) {
									// Subsequent duplicate occurrences shift down by 1 because targetOccurrence was renamed/removed
									matched = true;
									const newIdx = idx - 1;
									updatedGoals.push({
										...typedItem,
										index: newIdx,
										occurrence: newIdx,
									});
								} else {
									updatedGoals.push({ ...typedItem });
								}
							} else {
								updatedGoals.push({ ...typedItem });
							}
						} else {
							const entries = Object.entries(item as Record<string, unknown>);
							if (entries.length > 0) {
								const [hName, goalVal] = entries[0]!;
								if (hName === trimmedOld && typeof goalVal === 'number') {
									goalsOccCount++;
									if (goalsOccCount === targetOccurrence) {
										matched = true;
										updatedGoals.push({ [trimmedNew]: goalVal });
									} else {
										updatedGoals.push({ [hName]: goalVal });
									}
								} else if (typeof goalVal === 'number') {
									updatedGoals.push({ [hName]: goalVal });
								}
							}
						}
					}
				}

				if (updatedGoals.length > 0) {
					fm.goals = updatedGoals.map((g) => ({ ...g }));
				}
			}

			// Check if target occurrence actually exists in fm['goal-dates']
			const hasTargetInDateGoals = Array.isArray(fm['goal-dates']) && (() => {
				let c = 0;
				for (const item of fm['goal-dates']) {
					if (typeof item === 'object' && item !== null) {
						const record = item as Record<string, unknown>;
						if (record.heading === trimmedOld) {
							c++;
							const explicitIdx = typeof record.index === 'number' ? record.index : (typeof record.occurrence === 'number' ? record.occurrence : undefined);
							const idx = typeof explicitIdx === 'number' ? explicitIdx : c;
							if (idx === targetOccurrence) return true;
						}
					}
				}
				return false;
			})();

			// 2. Rename in fm['goal-dates']
			if (hasTargetInDateGoals && Array.isArray(fm['goal-dates'])) {
				let dateOccCount = 0;
				let dateMatched = false;
				const updatedDateGoals: Record<string, unknown>[] = [];
				for (const item of fm['goal-dates']) {
					if (typeof item === 'object' && item !== null) {
						const record = { ...(item as Record<string, unknown>) };
						if (record.heading === trimmedOld) {
							dateOccCount++;
							const explicitIdx = typeof record.occurrence === 'number' ? record.occurrence : (typeof record.index === 'number' ? record.index : undefined);
							const idx = typeof explicitIdx === 'number' ? explicitIdx : dateOccCount;
							if (idx === targetOccurrence) {
								record.heading = trimmedNew;
								delete record.index;
								delete record.occurrence;
								dateMatched = true;
								matched = true;
							} else if (idx > targetOccurrence) {
								const newIdx = idx - 1;
								record.index = newIdx;
								record.occurrence = newIdx;
								dateMatched = true;
								matched = true;
							}
						}
						updatedDateGoals.push(record);
					}
				}
				if (dateMatched) {
					fm['goal-dates'] = updatedDateGoals;
				}
			}
		});

		return matched;
	}

	/**
	 * Rename a specific heading in the active editor buffer's frontmatter.
	 * Directly updates the editor line without causing external file change notifications or offset corruption.
	 * Returns true if a rename occurred, false otherwise.
	 */
	public renameSectionGoalInEditor(
		editor: Editor,
		oldHeading: string,
		newHeading: string,
		occurrenceIndex = 0,
		targetLine?: number,
	): boolean {
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

		const targetOccurrence = occurrenceIndex + 1; // 1-indexed

		const lineCount = editor.lineCount();
		let inFrontmatter = false;
		let inGoals = false;
		let inGoalDates = false;
		let goalsOccCount = 0;
		let goalDatesOccCount = 0;
		let targetFound = false;
		const targetReplacements: Array<{ lineIndex: number; newText: string; deleteLine?: boolean }> = [];
		const shiftReplacements: Array<{ lineIndex: number; newText: string; deleteLine?: boolean }> = [];
		const maxScan = Math.min(lineCount, 500);

		// Count occurrences of new heading in the document up to targetLine, and in total
		let newHeadingDocOccCount = 0;
		let newHeadingTargetOcc = 1;
		for (let i = 0; i < lineCount; i++) {
			const line = editor.getLine(i);
			if (line === undefined) break;
			const m = line.match(/^#{1,6}\s+(.*)$/);
			if (m && m[1]?.trim() === trimmedNew) {
				newHeadingDocOccCount++;
				if (targetLine !== undefined && i <= targetLine) {
					newHeadingTargetOcc = newHeadingDocOccCount;
				}
			}
		}

		interface ParsedYamlItem {
			headingLineIndex?: number;
			headingValue?: string;
			headingPrefix?: string;
			indexLineIndex?: number;
			indexPrefix?: string;
			indexValue?: number;
			singleLineHeading?: string;
			singleLineIndex?: number;
			singleLinePrefix?: string;
			singleLineVal?: number;
			sectionType?: 'goals' | 'goal-dates';
		}

		let currentItem: ParsedYamlItem | null = null;

		const flushItem = () => {
			if (!currentItem) return;
			if (currentItem.singleLineHeading !== undefined && currentItem.singleLineIndex !== undefined) {
				if (currentItem.singleLineHeading === trimmedOld) {
					goalsOccCount++;
					if (goalsOccCount === targetOccurrence) {
						targetFound = true;
						const needsQuotes = /[:#\-[\]{}>|%&*!?'",@]/.test(trimmedNew);
						const formattedNew = needsQuotes ? JSON.stringify(trimmedNew) : trimmedNew;
						targetReplacements.push({
							lineIndex: currentItem.singleLineIndex,
							newText: `${currentItem.singleLinePrefix ?? '  - '}${formattedNew}: ${currentItem.singleLineVal}`,
						});
					}
				}
			} else if (currentItem.headingValue !== undefined && currentItem.headingLineIndex !== undefined) {
				if (currentItem.headingValue === trimmedOld) {
					if (currentItem.sectionType === 'goal-dates') {
						goalDatesOccCount++;
					} else {
						goalsOccCount++;
					}
					const currentCount = currentItem.sectionType === 'goal-dates' ? goalDatesOccCount : goalsOccCount;
					const itemOcc = typeof currentItem.indexValue === 'number' ? currentItem.indexValue : currentCount;

					if (itemOcc === targetOccurrence) {
						targetFound = true;
						const needsQuotes = /[:#\-[\]{}>|%&*!?'",@]/.test(trimmedNew);
						const formattedNew = needsQuotes ? JSON.stringify(trimmedNew) : trimmedNew;

						if (newHeadingDocOccCount > 1) {
							// Renamed into a duplicate heading: assign its new occurrence index
							if (currentItem.indexLineIndex !== undefined) {
								targetReplacements.push({
									lineIndex: currentItem.headingLineIndex,
									newText: `${currentItem.headingPrefix ?? '    heading: '}${formattedNew}`,
								});
								targetReplacements.push({
									lineIndex: currentItem.indexLineIndex,
									newText: `${currentItem.indexPrefix ?? '    index: '}${newHeadingTargetOcc}`,
								});
							} else {
								const dashIdx = currentItem.headingPrefix?.indexOf('-') ?? -1;
								const indent = dashIdx !== -1 ? ' '.repeat(dashIdx + 2) : '    ';
								targetReplacements.push({
									lineIndex: currentItem.headingLineIndex,
									newText: `${currentItem.headingPrefix ?? '    heading: '}${formattedNew}\n${indent}index: ${newHeadingTargetOcc}`,
								});
							}
						} else {
							// Unique in document: replace heading and remove any index field
							targetReplacements.push({
								lineIndex: currentItem.headingLineIndex,
								newText: `${currentItem.headingPrefix ?? '    heading: '}${formattedNew}`,
							});
							if (currentItem.indexLineIndex !== undefined) {
								targetReplacements.push({
									lineIndex: currentItem.indexLineIndex,
									newText: '',
									deleteLine: true,
								});
							}
						}
					} else if (itemOcc > targetOccurrence) {
						// Subsequent duplicate occurrences of old heading shift down by 1
						if (currentItem.indexLineIndex !== undefined && typeof currentItem.indexValue === 'number') {
							const newIdx = currentItem.indexValue - 1;
							shiftReplacements.push({
								lineIndex: currentItem.indexLineIndex,
								newText: `${currentItem.indexPrefix ?? '    index: '}${newIdx}`,
							});
						}
					}
				} else if (currentItem.headingValue === trimmedNew && newHeadingDocOccCount > 1) {
					const itemOcc = typeof currentItem.indexValue === 'number' ? currentItem.indexValue : 1;
					const newIdx = itemOcc >= newHeadingTargetOcc ? itemOcc + 1 : itemOcc;
					if (currentItem.indexLineIndex !== undefined) {
						if (newIdx !== currentItem.indexValue) {
							shiftReplacements.push({
								lineIndex: currentItem.indexLineIndex,
								newText: `${currentItem.indexPrefix ?? '    index: '}${newIdx}`,
							});
						}
					} else if (currentItem.headingLineIndex !== undefined) {
						// Existing unindexed heading in frontmatter now needs an explicit index field
						const dashIdx = currentItem.headingPrefix?.indexOf('-') ?? -1;
						const indent = dashIdx !== -1 ? ' '.repeat(dashIdx + 2) : '    ';
						const originalHeadingLine = editor.getLine(currentItem.headingLineIndex) ?? '';
						shiftReplacements.push({
							lineIndex: currentItem.headingLineIndex,
							newText: `${originalHeadingLine}\n${indent}index: ${newIdx}`,
						});
					}
				}
			}
			currentItem = null;
		};

		for (let i = 0; i < maxScan; i++) {
			const line = editor.getLine(i);
			if (line === undefined) break;

			if (i === 0 && line.trim() === '---') {
				inFrontmatter = true;
				continue;
			}
			if (inFrontmatter && i > 0 && line.trim() === '---') {
				flushItem();
				break;
			}

			if (inFrontmatter) {
				if (/^[a-zA-Z0-9_-]+:/.test(line)) {
					flushItem();
					inGoals = /^goals\s*:/.test(line);
					inGoalDates = /^goal-dates\s*:/.test(line);
					continue;
				}

				if (inGoals || inGoalDates) {
					// Check for new list item start: "- "
					const isNewItem = /^\s*-\s+/.test(line);
					if (isNewItem) {
						flushItem();
						currentItem = { sectionType: inGoalDates ? 'goal-dates' : 'goals' };

						const headingMatch = line.match(/^(\s*-\s+heading:\s*)(.*)$/);
						if (headingMatch) {
							currentItem.headingPrefix = headingMatch[1]!;
							let valPart = headingMatch[2]!.trim();
							if (
								(valPart.startsWith('"') && valPart.endsWith('"')) ||
								(valPart.startsWith("'") && valPart.endsWith("'"))
							) {
								valPart = valPart.slice(1, -1);
							}
							currentItem.headingValue = valPart;
							currentItem.headingLineIndex = i;
						} else {
							// Check if single-line goal format: "- 'My Heading': 500"
							const listMatch = line.match(/^(\s*-\s+)(.*)$/);
							if (listMatch) {
								const itemContent = listMatch[2]!.trim();
								const colonIdx = itemContent.lastIndexOf(':');
								if (colonIdx !== -1) {
									let keyPart = itemContent.slice(0, colonIdx).trim();
									const valPart = itemContent.slice(colonIdx + 1).trim();
									const valNum = parseInt(valPart, 10);
									if (
										(keyPart.startsWith('"') && keyPart.endsWith('"')) ||
										(keyPart.startsWith("'") && keyPart.endsWith("'"))
									) {
										keyPart = keyPart.slice(1, -1);
									}
									if (!isNaN(valNum)) {
										currentItem.singleLineHeading = keyPart;
										currentItem.singleLineIndex = i;
										currentItem.singleLinePrefix = listMatch[1]!;
										currentItem.singleLineVal = valNum;
									}
								}
							}
						}
					} else if (currentItem) {
						// Continuation lines within the current item
						const headingMatch = line.match(/^(\s*heading:\s*)(.*)$/);
						if (headingMatch) {
							currentItem.headingPrefix = headingMatch[1]!;
							let valPart = headingMatch[2]!.trim();
							if (
								(valPart.startsWith('"') && valPart.endsWith('"')) ||
								(valPart.startsWith("'") && valPart.endsWith("'"))
							) {
								valPart = valPart.slice(1, -1);
							}
							currentItem.headingValue = valPart;
							currentItem.headingLineIndex = i;
						}

						const indexMatch = line.match(/^(\s*(?:index|occurrence):\s*)(\d+)/);
						if (indexMatch && indexMatch[1] && indexMatch[2]) {
							currentItem.indexPrefix = indexMatch[1];
							currentItem.indexValue = parseInt(indexMatch[2], 10);
							currentItem.indexLineIndex = i;
						}
					}
				}
			}
		}
		flushItem();

		if (!targetFound) {
			return false;
		}

		const replacements = [...targetReplacements, ...shiftReplacements];
		if (replacements.length === 0) {
			return false;
		}

		// Apply replacements in reverse line order
		replacements.sort((a, b) => b.lineIndex - a.lineIndex);
		for (const r of replacements) {
			if (r.deleteLine) {
				if (typeof editor.replaceRange === 'function') {
					const startPos = { line: r.lineIndex, ch: 0 };
					const endPos = { line: r.lineIndex + 1, ch: 0 };
					editor.replaceRange('', startPos, endPos);
				}
			} else if (typeof editor.setLine === 'function') {
				editor.setLine(r.lineIndex, r.newText);
			} else if (typeof editor.replaceRange === 'function') {
				const lineContent = editor.getLine(r.lineIndex) ?? '';
				const startPos = { line: r.lineIndex, ch: 0 };
				const endPos = { line: r.lineIndex, ch: lineContent.length };
				editor.replaceRange(r.newText, startPos, endPos);
			}
		}

		return true;
	}
}




