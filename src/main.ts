import {
	Editor,
	MarkdownFileInfo,
	MarkdownView,
	Plugin,
	TFile,
} from 'obsidian';
import { EffectiveGoalData, FrontmatterManager } from './frontmatter/frontmatter-manager';
import { t } from './lang/helpers';
import { ParsedDocumentSections, SectionParser } from './parser/section-parser';
import { DEFAULT_SETTINGS, getDefaultStyles, SectionGoalsBadgeSettingTab } from './settings';
import { GoalColorStyle, PluginSettings } from './types';
import { FloatingBadge } from './ui/floating-badge';
import { GoalManagementModal } from './ui/goal-modal';
import { debounce } from './utils/debounce';
import { TYPING_DEBOUNCE_MS } from './utils/constants';
import { ViewportTracker } from './utils/viewport';
import { computeHeadingOccurrenceOverrides, SimpleHeading } from './utils/heading-aligner';
import { resolveChainedDateGoals } from './utils/date-goal';

export default class SectionGoalsBadgePlugin extends Plugin {
	settings!: PluginSettings;
	private badge!: FloatingBadge;
	private parser!: SectionParser;
	private fmManager!: FrontmatterManager;
	private viewportTracker!: ViewportTracker;

	// Document cache and state tracking
	private currentParsedDoc: ParsedDocumentSections | null = null;
	private currentEffectiveGoalData: EffectiveGoalData | null = null;
	private currentActiveFile: TFile | null = null;
	private lastFileHeadings = new Map<string, SimpleHeading[]>();
	private currentOccurrenceOverrides?: Map<number, number>;
	private trackedHeadingLine = -1;
	private trackedHeadingInitialText = '';
	private trackedHeadingAssignedOcc?: number;
	private isComposing = false;
	private cachedDateProgress: {
		filePath: string;
		sectionIndex?: number;
		heading: string | null | undefined;
		goalDataRef: EffectiveGoalData;
		minute: number;
		result: import('./types').DateProgressInfo | null;
	} | null = null;
	private cachedResolvedDateGoalsMap: {
		filePath: string;
		goalDataRef: EffectiveGoalData;
		parsedDocRef: ParsedDocumentSections;
		occurrenceOverridesRef?: Map<number, number>;
		resolvedMap: Map<string | number, import('./utils/date-goal').ResolvedSectionDateGoal>;
	} | null = null;

	// Debounced recalculator for text typing
	private debouncedRecalculate = debounce(() => {
		this.performFullRecalculation();
	}, TYPING_DEBOUNCE_MS);

	private settingTab!: SectionGoalsBadgeSettingTab;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.fmManager = new FrontmatterManager(this.app);
		this.parser = new SectionParser(this.app, this.fmManager);

		// Initialize Floating Badge UI with drag position sync callback
		this.badge = new FloatingBadge(
			this.settings,
			(initialTab) => {
				void this.openGoalModal(initialTab);
			},
			(pos) => {
				this.settings.badgePosition = pos.badgePosition;
				this.settings.offsetX = pos.offsetX;
				this.settings.offsetY = pos.offsetY;
				void this.saveSettings();
			},
			(datePos) => {
				this.settings.dateBadgePosition = datePos.dateBadgePosition;
				this.settings.dateOffsetX = datePos.dateOffsetX;
				this.settings.dateOffsetY = datePos.dateOffsetY;
				void this.saveSettings();
			},
		);

		// Mobile viewport tracker (handles keyboard popup)
		this.viewportTracker = new ViewportTracker(() => {
			this.badge.applyPosition();
		});

		// Settings Tab
		this.settingTab = new SectionGoalsBadgeSettingTab(this.app, this);
		this.addSettingTab(this.settingTab);

		// Commands
		this.addCommand({
			id: 'open-goals-modal',
			name: t('COMMAND_OPEN_MODAL'),
			checkCallback: (checking: boolean) => {
				const view = this.getActiveMarkdownEditorView();
				if (view && view.file) {
					if (!checking) {
						void this.openGoalModal();
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: 'open-goals-modal-date',
			name: t('COMMAND_OPEN_MODAL_DATE'),
			checkCallback: (checking: boolean) => {
				const view = this.getActiveMarkdownEditorView();
				if (view && view.file) {
					if (!checking) {
						void this.openGoalModal('date');
					}
					return true;
				}
				return false;
			},
		});


		// Workspace Event Listeners
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				this.onActiveLeafChanged();
			}),
		);

		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				this.onActiveLeafChanged();
			}),
		);

		this.registerEvent(
			this.app.workspace.on('editor-change', (_editor: Editor, info: MarkdownView | MarkdownFileInfo) => {
				if (info.file && info.file === this.currentActiveFile && !this.isComposing) {
					this.debouncedRecalculate();
				}
			}),
		);

		// Metadata changes (e.g. frontmatter updated or headings parsed by Obsidian)
		this.registerEvent(
			this.app.metadataCache.on('changed', (file) => {
				if (file === this.currentActiveFile) {
					this.performFullRecalculation();
				}
			}),
		);

		// IME composition listeners to avoid cursor jumps during active Japanese conversion
		this.registerDomEvent(activeDocument, 'compositionstart', () => {
			this.isComposing = true;
		});

		this.registerDomEvent(activeDocument, 'compositionupdate', () => {
			this.isComposing = true;
		});

		this.registerDomEvent(activeDocument, 'compositionend', () => {
			window.setTimeout(() => {
				this.isComposing = false;
				this.requestCursorUpdate();
			}, 30);
		});

		// DOM Events for cursor movement and heading focus-out detection (throttled via requestAnimationFrame)
		this.registerDomEvent(activeDocument, 'selectionchange', () => {
			this.requestCursorUpdate();
		});

		this.registerDomEvent(activeDocument, 'keyup', () => {
			this.requestCursorUpdate();
		});

		this.registerDomEvent(activeDocument, 'click', () => {
			this.requestCursorUpdate();
		});

		// Notify Style Settings plugin to parse styles.css
		this.app.workspace.trigger('parse-style-settings');
		this.app.workspace.onLayoutReady(() => {
			this.app.workspace.trigger('parse-style-settings');
		});

		// Initial check
		this.onActiveLeafChanged();
	}

	onunload(): void {
		this.settingTab?.destroy();
		this.viewportTracker.destroy();
		this.badge.destroy();
		// Notify Style Settings plugin on unload
		this.app.workspace.trigger('parse-style-settings');
	}

	async loadSettings(): Promise<void> {
		const loadedData = (await this.loadData()) as Partial<PluginSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
		if (this.settings.dateLabel === undefined) {
			this.settings.dateLabel = t('BADGE_DATE_LABEL');
		}
		if (this.settings.dateUnitDays === undefined) {
			this.settings.dateUnitDays = t('BADGE_DAYS_UNIT');
		}
		if (this.settings.dateUnitHours === undefined) {
			this.settings.dateUnitHours = t('BADGE_HOURS_UNIT');
		}
		if (!Array.isArray(this.settings.styles) || this.settings.styles.length === 0) {
			this.settings.styles = getDefaultStyles();
		} else {
			// Ensure preset flags are set for preset IDs
			for (const style of this.settings.styles) {
				if (style.id === 1 || style.id === 2) {
					style.isPreset = true;
				}
			}
		}
		if (typeof this.settings.defaultStyleId !== 'number') {
			this.settings.defaultStyleId = 1;
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	public getActiveColorStyle(file: TFile, goalData?: EffectiveGoalData): GoalColorStyle {
		const effectiveGoalData =
			goalData ??
			this.currentEffectiveGoalData ??
			this.fmManager.getEffectiveGoalData(file, this.settings);
		const targetId = effectiveGoalData.styleId ?? this.settings.defaultStyleId ?? 1;
		const found = this.settings.styles.find((s) => s.id === targetId);
		if (found) return found;
		const defaultStyle = this.settings.styles.find((s) => s.id === this.settings.defaultStyleId);
		if (defaultStyle) return defaultStyle;
		return this.settings.styles[0] ?? getDefaultStyles()[0]!;
	}

	public refreshBadgeUI(): void {
		this.badge.updateSettings(this.settings);
		// Force immediate progress re-calculation and badge update even while settings modal is open
		const view = this.getActiveMarkdownEditorView();
		if (view && view.file) {
			this.updateBadgeWithCursor(view, true);
		} else {
			const leaves = this.app.workspace.getLeavesOfType('markdown');
			for (const leaf of leaves) {
				if (leaf.view instanceof MarkdownView && leaf.view.file) {
					this.updateBadgeWithCursor(leaf.view, true);
					break;
				}
			}
		}
	}

	public updateBadgePosition(): void {
		this.badge.applyPosition();
	}

	public hideBadge(): void {
		this.badge?.hide();
	}

	public showBadge(): void {
		this.badge?.show();
	}

	public recalculateCounts(): void {
		this.performFullRecalculation();
	}

	/**
	 * Returns the MarkdownView only if the active leaf belongs to the main workspace root split (not sidebar panes).
	 */
	private getActiveMarkdownEditorView(): MarkdownView | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view || !view.file) return null;

		// Ensure active leaf is within the main editing area (not in left or right sidebars)
		const isMainArea = view.leaf.getRoot() === this.app.workspace.rootSplit;
		if (!isMainArea) return null;

		return view;
	}

	private onActiveLeafChanged(): void {
		const view = this.getActiveMarkdownEditorView();
		if (view && view.file) {
			this.currentActiveFile = view.file;
			const cursor = view.editor.getCursor();
			const lineText = view.editor.getLine(cursor.line) ?? '';
			if (/^#{1,6}\s+/.test(lineText)) {
				this.trackedHeadingLine = cursor.line;
				this.trackedHeadingInitialText = lineText;
			} else {
				this.trackedHeadingLine = -1;
				this.trackedHeadingInitialText = '';
			}
			this.badge.attachToEditor(view.containerEl);
			this.badge.show();
			this.performFullRecalculation();
		} else {
			this.currentActiveFile = null;
			this.currentParsedDoc = null;
			this.cachedDateProgress = null;
			this.cachedResolvedDateGoalsMap = null;
			this.trackedHeadingLine = -1;
			this.trackedHeadingInitialText = '';
			this.trackedHeadingAssignedOcc = undefined;
			this.badge.hide();
		}
	}

	/**
	 * Recalculate sections and characters for current active document.
	 */
	private performFullRecalculation(targetView?: MarkdownView): void {
		const view = targetView ?? this.getActiveMarkdownEditorView();
		if (!view || !view.file) {
			this.badge.hide();
			return;
		}

		let content = view.editor.getValue();
		let effectiveGoalData = this.fmManager.getEffectiveGoalData(view.file, this.settings, content);

		let editingOverride: { line: number; originalHeading: string } | undefined;
		const cursorLine = view.editor?.getCursor()?.line;
		if (
			cursorLine !== undefined &&
			this.trackedHeadingLine !== -1 &&
			cursorLine === this.trackedHeadingLine &&
			this.trackedHeadingInitialText
		) {
			const m = this.trackedHeadingInitialText.match(/^#{1,6}\s+(.*)$/);
			if (m && m[1]) {
				editingOverride = {
					line: this.trackedHeadingLine,
					originalHeading: m[1].trim(),
				};
			}
		}

		let rawHeadings = this.parser.scanHeadingsFast(content);
		const oldHeadings = this.lastFileHeadings.get(view.file.path);

		// Synchronize frontmatter goals for any headings renamed outside active heading editing (e.g. Undo/Redo or batch replace)
		// Only trigger when heading count is identical and old heading no longer exists anywhere in document
		if (oldHeadings && oldHeadings.length > 0 && oldHeadings.length === rawHeadings.length && view.editor) {
			let anyRenamed = false;
			for (const prevH of oldHeadings) {
				if (cursorLine !== undefined && cursorLine === prevH.line) {
					continue;
				}
				// If old heading still exists elsewhere in the document, it was not renamed
				if (rawHeadings.some((curr) => curr.heading === prevH.heading)) {
					continue;
				}
				const matchH = rawHeadings.find(
					(curr) => curr.position.start.line === prevH.line && curr.level === prevH.level,
				);
				if (matchH && matchH.heading !== prevH.heading) {
					let targetOcc = prevH.assignedOccurrence;
					if (targetOcc === undefined) {
						let occ = 0;
						for (const h of oldHeadings) {
							if (h.heading === prevH.heading) {
								occ++;
								if (h.line === prevH.line) break;
							}
						}
						targetOcc = occ > 0 ? occ : 1;
					}
					const renamed = this.fmManager.renameSectionGoalInEditor(
						view.editor,
						prevH.heading,
						matchH.heading,
						targetOcc - 1,
						matchH.position.start.line,
					);
					if (renamed) {
						anyRenamed = true;
					}
				}
			}
			if (anyRenamed) {
				content = view.editor.getValue();
				effectiveGoalData = this.fmManager.getEffectiveGoalData(view.file, this.settings, content);
				rawHeadings = this.parser.scanHeadingsFast(content);
			}
		}

		const newHeadings: SimpleHeading[] = rawHeadings.map((h, idx) => {
			const bodyStart = h.position.end.offset;
			const bodyEnd = idx + 1 < rawHeadings.length ? rawHeadings[idx + 1]!.position.start.offset : content.length;
			const bodySlice = content.slice(bodyStart, Math.min(bodyStart + 60, bodyEnd)).trim();
			const isEditing = Boolean(editingOverride && h.position.start.line === editingOverride.line);
			return {
				heading: isEditing && editingOverride ? editingOverride.originalHeading : h.heading,
				level: h.level,
				line: h.position.start.line,
				charCount: Math.max(0, bodyEnd - bodyStart),
				preview: bodySlice.slice(0, 30),
				assignedOccurrence: isEditing ? this.trackedHeadingAssignedOcc : undefined,
			};
		});
		let occurrenceOverrides: Map<number, number> | undefined;
		if (oldHeadings && oldHeadings.length > 0) {
			occurrenceOverrides = computeHeadingOccurrenceOverrides(oldHeadings, newHeadings, cursorLine);
		} else {
			// First scan for this file: initialize assignedOccurrence for existing headings
			const occCounts = new Map<string, number>();
			for (const nh of newHeadings) {
				const key = nh.heading;
				const occ = (occCounts.get(key) ?? 0) + 1;
				occCounts.set(key, occ);
				nh.assignedOccurrence = occ;
			}
		}
		this.lastFileHeadings.set(view.file.path, newHeadings);
		this.currentOccurrenceOverrides = occurrenceOverrides;

		this.cachedDateProgress = null;
		this.cachedResolvedDateGoalsMap = null;
		this.currentEffectiveGoalData = effectiveGoalData;
		this.currentParsedDoc = this.parser.parseDocument(
			view.file,
			content,
			{
				countType: this.settings.countType,
				excludeWhitespace: this.settings.excludeWhitespace,
				excludeRuby: this.settings.excludeRuby,
				excludeCharacters: this.settings.excludeCharacters,
			},
			effectiveGoalData,
			editingOverride,
			occurrenceOverrides,
		);

		this.updateBadgeWithCursor(view, true);
	}

	private rafCursorUpdatePending = false;

	/**
	 * Throttles selection and cursor updates to animation frames, preventing redundant executions during rapid typing.
	 */
	private requestCursorUpdate(): void {
		if (this.rafCursorUpdatePending || this.isComposing) return;
		this.rafCursorUpdatePending = true;
		window.requestAnimationFrame(() => {
			this.rafCursorUpdatePending = false;
			this.onSelectionOrCursorChanged();
		});
	}

	/**
	 * Fast path: update badge using existing parsed document cache and current cursor position.
	 * Executes in < 0.001ms with zero text allocation or full-document scanning.
	 */
	private onSelectionOrCursorChanged(): void {
		const view = this.getActiveMarkdownEditorView();
		if (!view || !view.file || !this.currentParsedDoc) return;

		void this.checkHeadingFocusOut(view);
		this.updateBadgeWithCursor(view);
	}

	private lastCursorOffset = -1;

	private updateBadgeWithCursor(view: MarkdownView, force = false): void {
		if (!this.currentParsedDoc || !view.file || this.isComposing) return;

		const goalData = this.currentEffectiveGoalData ?? this.fmManager.getEffectiveGoalData(view.file, this.settings);

		// Apply active note's color style using effective goal data
		const activeStyle = this.getActiveColorStyle(view.file, goalData);
		this.badge.applyColorStyle(activeStyle);

		const cursor = view.editor.getCursor();
		const cursorOffset = view.editor.posToOffset(cursor);
		const currentLineText = view.editor.getLine(cursor.line);

		if (!force && cursorOffset === this.lastCursorOffset) {
			return;
		}
		this.lastCursorOffset = cursorOffset;

		const progress = this.parser.calculateProgress(
			this.currentParsedDoc,
			cursorOffset,
			cursor.line,
			goalData,
			this.settings.cumulativeMode,
			{
				countType: this.settings.countType,
				excludeWhitespace: this.settings.excludeWhitespace,
				excludeRuby: this.settings.excludeRuby,
				excludeCharacters: this.settings.excludeCharacters,
			},
			currentLineText,
		);

		// Resolve date progress for active section (cached to avoid redundant Date parsing during rapid cursor movement)
		const activeSection = progress.currentSection;
		const activeHeading = activeSection?.heading;
		const activeSectionIndex = activeSection?.index;
		const currentMinute = Math.floor(Date.now() / 60000);
		if (
			this.cachedDateProgress &&
			this.cachedDateProgress.filePath === view.file.path &&
			this.cachedDateProgress.sectionIndex === activeSectionIndex &&
			this.cachedDateProgress.heading === activeHeading &&
			this.cachedDateProgress.goalDataRef === goalData &&
			this.cachedDateProgress.minute === currentMinute
		) {
			progress.date = this.cachedDateProgress.result;
		} else {
			let editingOverride: { line: number; originalHeading: string } | undefined;
			if (
				this.trackedHeadingLine !== -1 &&
				cursor.line === this.trackedHeadingLine &&
				this.trackedHeadingInitialText
			) {
				const m = this.trackedHeadingInitialText.match(/^#{1,6}\s+(.*)$/);
				if (m && m[1]) {
					editingOverride = {
						line: this.trackedHeadingLine,
						originalHeading: m[1].trim(),
					};
				}
			}

			const matchingSections = editingOverride && this.currentParsedDoc
				? this.currentParsedDoc.flatSections.map((s) => {
						if (s.line === editingOverride.line) {
							return { heading: editingOverride.originalHeading, level: s.level };
						}
						return s;
				  })
				: this.currentParsedDoc?.flatSections;

			// Reuse precomputed document-level date goals map to avoid O(N) chain recalculation on cursor movement
			let resolvedMap: Map<string | number, import('./utils/date-goal').ResolvedSectionDateGoal> | undefined;
			if (
				this.cachedResolvedDateGoalsMap &&
				this.cachedResolvedDateGoalsMap.filePath === view.file.path &&
				this.cachedResolvedDateGoalsMap.goalDataRef === goalData &&
				this.cachedResolvedDateGoalsMap.parsedDocRef === this.currentParsedDoc &&
				this.cachedResolvedDateGoalsMap.occurrenceOverridesRef === this.currentOccurrenceOverrides
			) {
				resolvedMap = this.cachedResolvedDateGoalsMap.resolvedMap;
			} else if (matchingSections && matchingSections.length > 0) {
				resolvedMap = resolveChainedDateGoals(
					matchingSections,
					goalData.fileStartDate,
					goalData.fileTargetDate,
					goalData.fileCycle,
					goalData.sectionDateGoals,
					goalData.effectiveStartTime || this.settings.defaultStartTime,
					goalData.effectiveTargetTime || this.settings.defaultTargetTime,
					goalData.fileDateReference ?? 'parent',
					this.currentOccurrenceOverrides,
				);
				this.cachedResolvedDateGoalsMap = {
					filePath: view.file.path,
					goalDataRef: goalData,
					parsedDocRef: this.currentParsedDoc,
					occurrenceOverridesRef: this.currentOccurrenceOverrides,
					resolvedMap,
				};
			}

			const dateResult = this.fmManager.resolveDateProgress(
				activeHeading,
				goalData,
				new Date(),
				goalData.effectiveStartTime || this.settings.defaultStartTime,
				goalData.effectiveTargetTime || this.settings.defaultTargetTime,
				matchingSections,
				activeSectionIndex,
				this.currentOccurrenceOverrides,
				resolvedMap,
			);
			this.cachedDateProgress = {
				filePath: view.file.path,
				sectionIndex: activeSectionIndex,
				heading: activeHeading,
				goalDataRef: goalData,
				minute: currentMinute,
				result: dateResult,
			};
			progress.date = dateResult;
		}

		this.badge.updateProgress(progress);
	}

	/**
	 * Detect when cursor moves away from a heading line that was edited,
	 * and rename Frontmatter goals safely without corrupting Undo history.
	 */
	private async checkHeadingFocusOut(view: MarkdownView, forceFlush = false): Promise<void> {
		if (!view.file) return;

		const cursor = view.editor.getCursor();
		const currentLineNum = cursor.line;

		if (this.trackedHeadingLine !== -1 && (this.trackedHeadingLine !== currentLineNum || forceFlush)) {
			const targetLine = this.trackedHeadingLine;
			const targetLineText = view.editor.getLine(targetLine);
			const oldMatch = this.trackedHeadingInitialText.match(/^(#{1,6})\s+(.*)$/);

			if (oldMatch && targetLineText !== undefined) {
				const newMatch = targetLineText.match(/^(#{1,6})\s+(.*)$/);
				if (newMatch) {
					const oldHeading = oldMatch[2]?.trim() ?? '';
					const newHeading = newMatch[2]?.trim() ?? '';

					if (oldHeading && newHeading && oldHeading !== newHeading) {
						let targetOcc = this.trackedHeadingAssignedOcc;
						const lastHeadings = this.lastFileHeadings.get(view.file.path);
						if (lastHeadings) {
							const prevItem = lastHeadings.find((h) => h.line === targetLine && h.heading === oldHeading);
							if (prevItem && prevItem.assignedOccurrence !== undefined) {
								targetOcc = prevItem.assignedOccurrence;
							}
						}
						if (targetOcc === undefined && view.editor) {
							// Robust fallback: determine occurrence index by counting headings named oldHeading up to targetLine
							let count = 0;
							for (let i = 0; i <= targetLine; i++) {
								const line = view.editor.getLine(i);
								if (i === targetLine) {
									count++;
									break;
								}
								const m = line?.match(/^#{1,6}\s+(.*)$/);
								if (m && m[1]?.trim() === oldHeading) {
									count++;
								}
							}
							targetOcc = count > 0 ? count : 1;
						}

						if (targetOcc !== undefined && view.editor) {
							const renamed = this.fmManager.renameSectionGoalInEditor(
								view.editor,
								oldHeading,
								newHeading,
								targetOcc - 1,
								targetLine,
							);
							if (renamed) {
								this.trackedHeadingLine = -1;
								this.trackedHeadingInitialText = '';
								this.trackedHeadingAssignedOcc = undefined;
								this.currentOccurrenceOverrides = undefined;
								this.lastFileHeadings.delete(view.file.path);
								this.performFullRecalculation(view);
							} else {
								this.trackedHeadingInitialText = targetLineText;
							}
						} else {
							this.trackedHeadingInitialText = targetLineText;
						}
					}
				}
			}

			if (this.trackedHeadingLine !== currentLineNum) {
				this.trackedHeadingLine = -1;
				this.trackedHeadingInitialText = '';
				this.trackedHeadingAssignedOcc = undefined;
			}
		}

		// When force-flushing (e.g. before opening the goal modal), perform a comprehensive scan
		// against lastFileHeadings to catch any heading rename that occurred without prior cursor focus
		if (forceFlush && view.editor) {
			const lastHeadings = this.lastFileHeadings.get(view.file.path);
			if (lastHeadings && lastHeadings.length > 0) {
				const currentContent = view.editor.getValue();
				const currentRawHeadings = this.parser.scanHeadingsFast(currentContent);
				let anyRenamed = false;
				for (const prevH of lastHeadings) {
					const matchH = currentRawHeadings.find(
						(curr) => curr.position.start.line === prevH.line,
					);
					if (matchH && matchH.heading !== prevH.heading) {
						let targetOcc = prevH.assignedOccurrence;
						if (targetOcc === undefined) {
							let occ = 0;
							for (const h of lastHeadings) {
								if (h.heading === prevH.heading) {
									occ++;
									if (h.line === prevH.line) break;
								}
							}
							targetOcc = occ > 0 ? occ : 1;
						}
						const renamed = this.fmManager.renameSectionGoalInEditor(
							view.editor,
							prevH.heading,
							matchH.heading,
							targetOcc - 1,
							matchH.position.start.line,
						);
						if (renamed) {
							anyRenamed = true;
						}
					}
				}
				if (anyRenamed) {
					this.trackedHeadingLine = -1;
					this.trackedHeadingInitialText = '';
					this.trackedHeadingAssignedOcc = undefined;
					this.currentOccurrenceOverrides = undefined;
					this.lastFileHeadings.delete(view.file.path);
					this.performFullRecalculation(view);
				}
			}
		}

		if (this.trackedHeadingLine === -1 || this.trackedHeadingLine !== currentLineNum) {
			const lineText = view.editor.getLine(currentLineNum) ?? '';
			if (/^#{1,6}\s+/.test(lineText)) {
				this.trackedHeadingLine = currentLineNum;
				const lastHeadings = this.lastFileHeadings.get(view.file.path);
				const prevItem = lastHeadings?.find((h) => h.line === currentLineNum);
				if (prevItem) {
					this.trackedHeadingInitialText = `${'#'.repeat(prevItem.level)} ${prevItem.heading}`;
					this.trackedHeadingAssignedOcc = prevItem.assignedOccurrence;
				} else {
					this.trackedHeadingInitialText = lineText;
					this.trackedHeadingAssignedOcc = undefined;
				}
			} else {
				this.trackedHeadingLine = -1;
				this.trackedHeadingInitialText = '';
				this.trackedHeadingAssignedOcc = undefined;
			}
		}
	}

	private activeModal: GoalManagementModal | null = null;

	public async openGoalModal(initialTab: 'count' | 'date' = 'count'): Promise<void> {
		const view = this.getActiveMarkdownEditorView();
		if (!view || !view.file) return;

		// Switch tab if modal is already open
		if (this.activeModal) {
			this.activeModal.switchToTab(initialTab);
			return;
		}

		// Flush any pending heading edit before opening the modal
		await this.checkHeadingFocusOut(view, true);
		this.performFullRecalculation();

		this.activeModal = new GoalManagementModal(
			this.app,
			view.file,
			view,
			this.parser,
			this.fmManager,
			this.settings,
			() => {
				if (view.file) {
					const lastHeadings = this.lastFileHeadings.get(view.file.path);
					if (lastHeadings) {
						const counter = new Map<string, number>();
						for (const h of lastHeadings) {
							const key = h.heading;
							const c = (counter.get(key) ?? 0) + 1;
							counter.set(key, c);
							h.assignedOccurrence = c;
						}
					}
				}
				this.performFullRecalculation(view);
			},
			initialTab,
			this.currentOccurrenceOverrides,
		);
		const originalOnClose = this.activeModal.onClose.bind(this.activeModal);
		this.activeModal.onClose = () => {
			originalOnClose();
			this.activeModal = null;
		};
		this.activeModal.open();
	}
}
