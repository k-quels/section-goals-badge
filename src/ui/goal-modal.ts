import { App, MarkdownView, Modal, setIcon, TFile } from 'obsidian';
import { FrontmatterManager } from '../frontmatter/frontmatter-manager';
import { t } from '../lang/helpers';
import { ParsedDocumentSections, SectionParser } from '../parser/section-parser';
import { HeadingGoalItem, PluginSettings, SectionNode } from '../types';
import { debounce } from '../utils/debounce';
import { setCssProps } from '../utils/dom';

export class GoalManagementModal extends Modal {
	private file: TFile;
	private view: MarkdownView;
	private parser: SectionParser;
	private fmManager: FrontmatterManager;
	private settings: PluginSettings;
	private parsedData!: ParsedDocumentSections;
	private currentCursorOffset: number;
	private onGoalsUpdated: () => void;

	private fileGoalInput: number | undefined;
	private defaultSectionGoalInput: number | undefined;
	private sectionGoalsMap: Map<string, number> = new Map();
	private activeSectionHeading: string | null = null;
	private inputElements: Map<string, HTMLInputElement> = new Map();
	private totalGoalInputElement: HTMLInputElement | null = null;
	private defaultSectionGoalInputElement: HTMLInputElement | null = null;

	// Viewport resize listener for mobile keyboard handling
	private viewportResizeHandler: (() => void) | null = null;

	// Debounced saver to avoid aggressive disk/frontmatter writes during typing
	private debouncedSaveGoals = debounce(() => {
		void this.saveGoals();
	}, 600);

	constructor(
		app: App,
		file: TFile,
		view: MarkdownView,
		parser: SectionParser,
		fmManager: FrontmatterManager,
		settings: PluginSettings,
		onGoalsUpdated: () => void,
	) {
		super(app);
		this.file = file;
		this.view = view;
		this.parser = parser;
		this.fmManager = fmManager;
		this.settings = settings;
		this.onGoalsUpdated = onGoalsUpdated;

		// Calculate initial cursor offset
		const cursor = view.editor.getCursor();
		this.currentCursorOffset = view.editor.posToOffset(cursor);
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('section-goals-badge-modal');

		// Handle mobile visual viewport resizing (when virtual keyboard pops up)
		this.setupViewportListener();

		// Re-read file content and frontmatter to ensure freshness
		const docContent = this.view.editor.getValue();
		this.parsedData = this.parser.parseDocument(this.file, docContent, {
			excludeWhitespace: this.settings.excludeWhitespace,
			excludeRuby: this.settings.excludeRuby,
			excludeCharacters: this.settings.excludeCharacters,
		});

		const { fileGoal, defaultSectionGoal, sectionGoals } = this.fmManager.getGoalData(this.file);
		this.fileGoalInput = fileGoal;
		this.defaultSectionGoalInput = defaultSectionGoal;

		// Build map of explicitly set goals
		this.sectionGoalsMap.clear();
		for (const item of sectionGoals) {
			const [heading, goal] = Object.entries(item)[0] ?? [];
			if (heading && typeof goal === 'number') {
				this.sectionGoalsMap.set(heading, goal);
			}
		}

		// Find active section based on cursor
		for (const sec of this.parsedData.flatSections) {
			if (this.currentCursorOffset >= sec.startOffset && this.currentCursorOffset <= sec.endOffset) {
				this.activeSectionHeading = sec.heading;
			}
		}

		this.renderModal();
	}

	private setupViewportListener(): void {
		const updateLayout = () => {
			if (window.visualViewport) {
				const vh = window.visualViewport.height;
				const treeMaxHeight = Math.max(140, Math.min(380, vh - 220));
				setCssProps(this.contentEl, {
					'--swg-tree-max-height': `${treeMaxHeight}px`,
				});
			}
			this.updateScrollbarOffset();
		};

		if (window.visualViewport) {
			this.viewportResizeHandler = updateLayout;
			window.visualViewport.addEventListener('resize', this.viewportResizeHandler);
			updateLayout();
		}
	}

	/**
	 * Dynamically measure section list scrollbar width and apply offset to header and top card,
	 * ensuring pixel-perfect column alignment regardless of scrollbar presence.
	 */
	private updateScrollbarOffset(): void {
		window.requestAnimationFrame(() => {
			const treeEl = this.contentEl.querySelector<HTMLElement>('.swg-section-tree-container');
			if (treeEl) {
				const scrollbarWidth = Math.max(0, treeEl.offsetWidth - treeEl.clientWidth);
				setCssProps(this.contentEl, {
					'--swg-scrollbar-width': `${scrollbarWidth}px`,
				});
			}
		});
	}

	private renderModal(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.inputElements.clear();

		contentEl.createEl('h2', { cls: 'swg-modal-header-title', text: t('MODAL_TITLE') });

		// --- Master Table Column Header (Labels all rows below) ---
		const tableHeaderEl = contentEl.createDiv({ cls: 'swg-section-table-header' });
		tableHeaderEl.createSpan({ cls: 'swg-header-title', text: '' });
		const headerControlsEl = tableHeaderEl.createDiv({ cls: 'swg-header-controls' });
		headerControlsEl.createSpan({ cls: 'swg-header-chars', text: t('MODAL_COL_CURRENT') });
		headerControlsEl.createSpan({ cls: 'swg-header-goal', text: t('MODAL_COL_GOAL') });
		headerControlsEl.createSpan({ cls: 'swg-header-progress', text: t('MODAL_COL_PROGRESS') });

		// --- Section 1: Compact Top Configuration Card ---
		const topCardEl = contentEl.createDiv({ cls: 'swg-modal-top-card' });
		const totalChars = this.parsedData.totalCharCount;

		// Row 1: Note Total Goal
		const totalRowEl = topCardEl.createDiv({ cls: 'swg-modal-card-row' });
		const totalLabelGroup = totalRowEl.createDiv({ cls: 'swg-card-label-group' });
		const totalTitleEl = totalLabelGroup.createSpan({ cls: 'swg-card-title' });
		const totalIconEl = totalTitleEl.createSpan({ cls: 'swg-card-title-icon' });
		setIcon(totalIconEl, 'book-text');
		totalTitleEl.createSpan({ text: t('MODAL_TOTAL_GOAL_NAME') });

		const totalControls = totalRowEl.createDiv({ cls: 'swg-card-controls' });

		// Col 1: Total character count
		totalControls.createSpan({
			cls: 'swg-section-chars',
			text: totalChars.toLocaleString(),
		});

		// Col 2: Total goal input
		const totalInputWrapper = totalControls.createDiv({ cls: 'swg-goal-input-wrapper' });
		const totalInput = totalInputWrapper.createEl('input', {
			type: 'number',
			cls: 'swg-goal-input',
			placeholder: t('MODAL_GOAL_PLACEHOLDER'),
		});
		if (this.fileGoalInput !== undefined && this.fileGoalInput > 0) {
			totalInput.value = String(this.fileGoalInput);
		}
		this.totalGoalInputElement = totalInput;

		// Col 3: Stacked mini progress (% on top, bar on bottom)
		const totalProgressWrapper = totalControls.createDiv({ cls: 'swg-mini-progress-wrapper' });
		const totalPercentEl = totalProgressWrapper.createSpan({ cls: 'swg-mini-percent' });
		const totalProgressEl = totalProgressWrapper.createDiv({ cls: 'swg-mini-progress' });
		const totalProgressFill = totalProgressEl.createDiv({ cls: 'swg-mini-progress-fill' });
		this.updateMiniProgress(totalProgressFill, totalPercentEl, totalChars, this.fileGoalInput);

		totalInput.addEventListener('input', () => {
			const num = parseInt(totalInput.value, 10);
			this.fileGoalInput = !isNaN(num) && num > 0 ? num : undefined;
			this.updateMiniProgress(totalProgressFill, totalPercentEl, totalChars, this.fileGoalInput);
			this.debouncedSaveGoals();
		});

		// Row 2: Default Section Goal
		const defaultRowEl = topCardEl.createDiv({ cls: 'swg-modal-card-row' });
		const defaultLabelGroup = defaultRowEl.createDiv({ cls: 'swg-card-label-group' });
		const defaultTitleEl = defaultLabelGroup.createSpan({ cls: 'swg-card-title' });
		const defaultIconEl = defaultTitleEl.createSpan({ cls: 'swg-card-title-icon' });
		setIcon(defaultIconEl, 'hash');
		defaultTitleEl.createSpan({ text: t('MODAL_DEFAULT_SECTION_GOAL_NAME') });
		defaultLabelGroup.createSpan({ cls: 'swg-card-desc', text: t('MODAL_DEFAULT_SECTION_DESC') });

		const defaultControls = defaultRowEl.createDiv({ cls: 'swg-card-controls' });

		// Col 1: Empty spacer to match table column
		defaultControls.createDiv({ cls: 'swg-spacer-chars' });

		// Col 2: Default goal input
		const defaultInputWrapper = defaultControls.createDiv({ cls: 'swg-goal-input-wrapper' });
		const defaultInput = defaultInputWrapper.createEl('input', {
			type: 'number',
			cls: 'swg-goal-input',
			placeholder: t('MODAL_GOAL_PLACEHOLDER'),
		});
		if (this.defaultSectionGoalInput !== undefined && this.defaultSectionGoalInput > 0) {
			defaultInput.value = String(this.defaultSectionGoalInput);
		}
		this.defaultSectionGoalInputElement = defaultInput;

		// Col 3: Empty spacer to match table column
		defaultControls.createDiv({ cls: 'swg-spacer-progress' });

		defaultInput.addEventListener('input', () => {
			const num = parseInt(defaultInput.value, 10);
			this.defaultSectionGoalInput = !isNaN(num) && num > 0 ? num : undefined;
			this.refreshSectionMiniProgress();
			this.debouncedSaveGoals();
		});

		// --- Section 2: Headings tree goals & Set button ---
		const sectionHeaderEl = contentEl.createDiv({ cls: 'swg-modal-section-header' });
		sectionHeaderEl.createEl('h3', { text: t('MODAL_SECTIONS_HEADER') });

		if (this.parsedData.flatSections.length > 0) {
			const setBtn = sectionHeaderEl.createEl('button', {
				cls: 'swg-reset-button',
				text: t('MODAL_SET_BUTTON'),
			});
			setBtn.addEventListener('click', () => {
				new ConfirmSetModal(this.app, () => {
					this.setAllGoalsFromCurrent();
				}).open();
			});
		}

		if (this.parsedData.sections.length === 0) {
			contentEl.createEl('p', {
				text: t('MODAL_NO_HEADINGS'),
				cls: 'swg-empty-notice',
			});
			this.updateScrollbarOffset();
			return;
		}

		const listContainer = contentEl.createDiv({ cls: 'swg-section-tree-container' });

		let activeItemEl: HTMLElement | null = null;

		for (const section of this.parsedData.flatSections) {
			const itemEl = listContainer.createDiv({
				cls: `swg-section-tree-item swg-level-${section.level}`,
			});

			if (section.heading === this.activeSectionHeading) {
				itemEl.addClass('is-active-section');
				activeItemEl = itemEl;
			}

			// Heading title clickable to jump
			const titleEl = itemEl.createDiv({ cls: 'swg-section-title' });
			const headingIcon = '#'.repeat(section.level);
			titleEl.createSpan({ cls: 'swg-heading-prefix', text: `${headingIcon} ` });
			titleEl.createSpan({ cls: 'swg-heading-name', text: section.heading });

			titleEl.addEventListener('click', () => {
				this.jumpToSection(section);
			});

			// Info & Input Controls
			const controlsEl = itemEl.createDiv({ cls: 'swg-section-controls' });
			controlsEl.createSpan({
				cls: 'swg-section-chars',
				text: section.charCount.toLocaleString(),
			});

			const explicitGoal = this.sectionGoalsMap.get(section.heading);
			const effectiveGoal = explicitGoal ?? this.defaultSectionGoalInput;

			const inputWrapperEl = controlsEl.createDiv({ cls: 'swg-goal-input-wrapper' });
			const inputEl = inputWrapperEl.createEl('input', {
				type: 'number',
				cls: 'swg-goal-input',
				placeholder: this.defaultSectionGoalInput ? String(this.defaultSectionGoalInput) : t('MODAL_GOAL_PLACEHOLDER'),
			});
			if (explicitGoal !== undefined && explicitGoal > 0) {
				inputEl.value = String(explicitGoal);
			}
			this.inputElements.set(section.heading, inputEl);

			// Stacked mini progress: percentage text on TOP, progress bar on BOTTOM
			const miniProgressWrapper = controlsEl.createDiv({ cls: 'swg-mini-progress-wrapper' });
			const miniPercentEl = miniProgressWrapper.createSpan({ cls: 'swg-mini-percent' });
			const miniProgressEl = miniProgressWrapper.createDiv({ cls: 'swg-mini-progress' });
			const miniFillEl = miniProgressEl.createDiv({ cls: 'swg-mini-progress-fill' });
			this.updateMiniProgress(miniFillEl, miniPercentEl, section.charCount, effectiveGoal);

			const onGoalChange = () => {
				const num = parseInt(inputEl.value, 10);
				if (!isNaN(num) && num > 0) {
					this.sectionGoalsMap.set(section.heading, num);
				} else {
					this.sectionGoalsMap.delete(section.heading);
				}
				const currentEffective = this.sectionGoalsMap.get(section.heading) ?? this.defaultSectionGoalInput;
				this.updateMiniProgress(miniFillEl, miniPercentEl, section.charCount, currentEffective);
				this.debouncedSaveGoals();
			};

			inputEl.addEventListener('input', onGoalChange);
			inputEl.addEventListener('change', onGoalChange);

			// Ensure mobile virtual keyboard doesn't occlude active input row
			inputEl.addEventListener('focus', () => {
				window.setTimeout(() => {
					itemEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
				}, 250);
			});
		}

		// Scroll to active section if needed
		if (activeItemEl) {
			window.setTimeout(() => {
				activeItemEl?.scrollIntoView({ block: 'center', behavior: 'smooth' });
			}, 50);
		}

		// Calculate scrollbar width and sync layout
		this.updateScrollbarOffset();
	}

	private refreshSectionMiniProgress(): void {
		// Update placeholders and mini progress without destroying current input focus
		for (const inputEl of this.inputElements.values()) {
			inputEl.placeholder = this.defaultSectionGoalInput ? String(this.defaultSectionGoalInput) : t('MODAL_GOAL_PLACEHOLDER');
		}

		// Update mini progress bars and percent labels
		for (const sec of this.parsedData.flatSections) {
			const effective = this.sectionGoalsMap.get(sec.heading) ?? this.defaultSectionGoalInput;
			const inputEl = this.inputElements.get(sec.heading);
			const rowControlsEl = inputEl?.parentElement?.parentElement;
			const miniFillEl = rowControlsEl?.querySelector('.swg-mini-progress-fill') as HTMLElement | null;
			const miniPercentEl = rowControlsEl?.querySelector('.swg-mini-percent') as HTMLElement | null;
			if (miniFillEl && miniPercentEl) {
				this.updateMiniProgress(miniFillEl, miniPercentEl, sec.charCount, effective);
			}
		}

		this.updateScrollbarOffset();
	}

	private setAllGoalsFromCurrent(): void {
		for (const sec of this.parsedData.flatSections) {
			this.sectionGoalsMap.set(sec.heading, sec.charCount);
		}
		void (async () => {
			await this.saveGoals();
			this.renderModal();
		})();
	}

	private updateMiniProgress(
		fillEl: HTMLElement,
		percentEl: HTMLElement,
		current: number,
		goal?: number,
	): void {
		if (goal && goal > 0) {
			const percent = Math.round((current / goal) * 100);
			setCssProps(fillEl, {
				'--swg-mini-fill-width': `${Math.min(100, Math.max(0, percent))}%`,
			});
			percentEl.setText(`${percent}%`);

			fillEl.className = 'swg-mini-progress-fill';
			percentEl.className = 'swg-mini-percent';

			if (percent >= this.settings.colorThresholdDone) {
				fillEl.addClass('is-progress-done');
				percentEl.addClass('is-progress-done');
			} else if (percent >= this.settings.colorThresholdGood) {
				fillEl.addClass('is-progress-good');
				percentEl.addClass('is-progress-good');
			} else if (percent >= this.settings.colorThresholdWarn) {
				fillEl.addClass('is-progress-warn');
				percentEl.addClass('is-progress-warn');
			}
		} else {
			setCssProps(fillEl, {
				'--swg-mini-fill-width': '0%',
			});
			percentEl.setText('-');
			fillEl.className = 'swg-mini-progress-fill';
			percentEl.className = 'swg-mini-percent';
		}
	}

	private async saveGoals(): Promise<void> {
		const sectionGoals: HeadingGoalItem[] = [];

		// Maintain document order of flat sections
		for (const sec of this.parsedData.flatSections) {
			const goal = this.sectionGoalsMap.get(sec.heading);
			if (goal !== undefined && goal > 0) {
				sectionGoals.push({ [sec.heading]: goal });
			}
		}

		await this.fmManager.saveGoalData(
			this.file,
			this.fileGoalInput,
			this.defaultSectionGoalInput,
			sectionGoals,
		);
		this.onGoalsUpdated();
	}

	private jumpToSection(section: SectionNode): void {
		this.close();
		this.view.editor.setCursor({ line: section.line, ch: 0 });
		this.view.editor.scrollIntoView(
			{
				from: { line: section.line, ch: 0 },
				to: { line: section.line, ch: 0 },
			},
			true,
		);
	}

	onClose(): void {
		if (this.viewportResizeHandler && window.visualViewport) {
			window.visualViewport.removeEventListener('resize', this.viewportResizeHandler);
			this.viewportResizeHandler = null;
		}

		// Sync any pending inputs immediately
		if (this.totalGoalInputElement) {
			const num = parseInt(this.totalGoalInputElement.value, 10);
			this.fileGoalInput = !isNaN(num) && num > 0 ? num : undefined;
		}

		if (this.defaultSectionGoalInputElement) {
			const num = parseInt(this.defaultSectionGoalInputElement.value, 10);
			this.defaultSectionGoalInput = !isNaN(num) && num > 0 ? num : undefined;
		}

		for (const [heading, inputEl] of this.inputElements.entries()) {
			const num = parseInt(inputEl.value, 10);
			if (!isNaN(num) && num > 0) {
				this.sectionGoalsMap.set(heading, num);
			} else {
				this.sectionGoalsMap.delete(heading);
			}
		}

		void (async () => {
			await this.saveGoals();
		})();

		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Confirmation dialog modal for setting goals from current character counts.
 */
class ConfirmSetModal extends Modal {
	constructor(
		app: App,
		private onConfirm: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('swg-confirm-modal');

		contentEl.createEl('p', { text: t('MODAL_SET_CONFIRM_MSG') });

		const buttonContainer = contentEl.createDiv({ cls: 'swg-confirm-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: t('MODAL_CONFIRM_CANCEL'),
		});
		cancelBtn.addEventListener('click', () => {
			this.close();
		});

		const confirmBtn = buttonContainer.createEl('button', {
			cls: 'mod-cta',
			text: t('MODAL_CONFIRM_OK'),
		});
		confirmBtn.addEventListener('click', () => {
			this.close();
			this.onConfirm();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
