import {
	Editor,
	MarkdownFileInfo,
	MarkdownView,
	Plugin,
	TFile,
} from 'obsidian';
import { FrontmatterManager } from './frontmatter/frontmatter-manager';
import { t } from './lang/helpers';
import { ParsedDocumentSections, SectionParser } from './parser/section-parser';
import { DEFAULT_SETTINGS, SectionGoalsBadgeSettingTab } from './settings';
import { PluginSettings } from './types';
import { FloatingBadge } from './ui/floating-badge';
import { GoalManagementModal } from './ui/goal-modal';
import { debounce } from './utils/debounce';
import { ViewportTracker } from './utils/viewport';

export default class SectionGoalsBadgePlugin extends Plugin {
	settings!: PluginSettings;
	private badge!: FloatingBadge;
	private parser!: SectionParser;
	private fmManager!: FrontmatterManager;
	private viewportTracker!: ViewportTracker;

	// Document cache and state tracking
	private currentParsedDoc: ParsedDocumentSections | null = null;
	private currentActiveFile: TFile | null = null;
	private lastCursorLine = -1;
	private lastHeadingLineText = '';
	private isComposing = false;

	// Debounced recalculator for text typing
	private debouncedRecalculate = debounce(() => {
		this.performFullRecalculation();
	}, 300);

	private settingTab!: SectionGoalsBadgeSettingTab;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.fmManager = new FrontmatterManager(this.app);
		this.parser = new SectionParser(this.app, this.fmManager);

		// Initialize Floating Badge UI with drag position sync callback
		this.badge = new FloatingBadge(
			this.settings,
			() => {
				this.openGoalModal();
			},
			(pos) => {
				this.settings.badgePosition = pos.badgePosition;
				this.settings.offsetX = pos.offsetX;
				this.settings.offsetY = pos.offsetY;
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
						this.openGoalModal();
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
		this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<PluginSettings>);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	public refreshBadgeUI(): void {
		this.badge.updateSettings(this.settings);
		// Force immediate progress re-calculation and badge update even while settings modal is open
		const view = this.getActiveMarkdownEditorView();
		if (view && view.file) {
			this.updateBadgeWithCursor(view);
		} else {
			const leaves = this.app.workspace.getLeavesOfType('markdown');
			for (const leaf of leaves) {
				if (leaf.view instanceof MarkdownView && leaf.view.file) {
					this.updateBadgeWithCursor(leaf.view);
					break;
				}
			}
		}
	}

	public updateBadgePosition(): void {
		this.badge.applyPosition();
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
			this.badge.attachToEditor(view.containerEl);
			this.badge.show();
			this.performFullRecalculation();
		} else {
			this.currentActiveFile = null;
			this.currentParsedDoc = null;
			this.badge.hide();
		}
	}

	/**
	 * Recalculate sections and characters for current active document.
	 */
	private performFullRecalculation(): void {
		const view = this.getActiveMarkdownEditorView();
		if (!view || !view.file) {
			this.badge.hide();
			return;
		}

		const content = view.editor.getValue();
		this.currentParsedDoc = this.parser.parseDocument(view.file, content, {
			countType: this.settings.countType,
			excludeWhitespace: this.settings.excludeWhitespace,
			excludeRuby: this.settings.excludeRuby,
			excludeCharacters: this.settings.excludeCharacters,
		});

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

		const cursor = view.editor.getCursor();
		const cursorOffset = view.editor.posToOffset(cursor);

		if (!force && cursorOffset === this.lastCursorOffset) {
			return;
		}
		this.lastCursorOffset = cursorOffset;

		const goalData = this.fmManager.getGoalData(view.file);

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
		);

		this.badge.updateProgress(progress);
	}

	/**
	 * Detect when cursor moves away from a heading line that was edited,
	 * and sync Frontmatter goals if necessary.
	 */
	private async checkHeadingFocusOut(view: MarkdownView): Promise<void> {
		if (!view.file) return;

		const cursor = view.editor.getCursor();
		const currentLineNum = cursor.line;

		if (this.lastCursorLine !== -1 && this.lastCursorLine !== currentLineNum) {
			// Cursor just left `this.lastCursorLine`
			const prevLineText = view.editor.getLine(this.lastCursorLine);
			const wasHeading = /^#{1,6}\s+/.test(this.lastHeadingLineText);

			if (wasHeading && prevLineText !== this.lastHeadingLineText) {
				// The heading was modified and user moved away from that line
				const cache = this.app.metadataCache.getFileCache(view.file);
				const headings = (cache?.headings || []).map((h) => h.heading);
				await this.fmManager.syncHeadings(view.file, headings);
			}
		}

		this.lastCursorLine = currentLineNum;
		this.lastHeadingLineText = view.editor.getLine(currentLineNum) ?? '';
	}

	public openGoalModal(): void {
		const view = this.getActiveMarkdownEditorView();
		if (!view || !view.file) return;

		new GoalManagementModal(
			this.app,
			view.file,
			view,
			this.parser,
			this.fmManager,
			this.settings,
			() => {
				this.performFullRecalculation();
			},
		).open();
	}
}
