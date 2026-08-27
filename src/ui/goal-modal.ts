import { App, DropdownComponent, MarkdownView, Modal, setIcon, TFile } from 'obsidian';
import { EffectiveGoalData, FrontmatterManager } from '../frontmatter/frontmatter-manager';
import { t } from '../lang/helpers';
import { ParsedDocumentSections, SectionParser } from '../parser/section-parser';
import { GoalColorStyle, HeadingGoalItem, PluginSettings, SectionNode } from '../types';
import { debounce } from '../utils/debounce';
import { setCssProps } from '../utils/dom';

export class GoalManagementModal extends Modal {
	private file: TFile;
	private view: MarkdownView;
	private parser: SectionParser;
	private fmManager: FrontmatterManager;
	private settings: PluginSettings;
	private parsedData!: ParsedDocumentSections;
	private effectiveData!: EffectiveGoalData;
	private currentCursorOffset: number;
	private onGoalsUpdated: () => void;

	private fileGoalInput: number | undefined;
	private defaultSectionGoalInput: number | undefined;
	private styleIdInput!: number;
	private headingLevelGoalsInput: Record<number, number> = {};
	private isHeadingLevelGoalsOpen = false;
	private sectionGoalsMap: Map<string, number> = new Map();
	private activeSectionHeading: string | null = null;
	private inputElements: Map<string, HTMLInputElement> = new Map();
	private levelInputElements: Map<number, HTMLInputElement> = new Map();
	private totalGoalInputElement: HTMLInputElement | null = null;
	private defaultSectionGoalInputElement: HTMLInputElement | null = null;
	private colorPreviewDots: HTMLElement[] = [];

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
		const { contentEl, modalEl } = this;
		modalEl.addClass('sgb-goal-modal');
		contentEl.empty();
		contentEl.addClass('section-goals-badge-modal');

		// Handle mobile visual viewport resizing (when virtual keyboard pops up)
		this.setupViewportListener();

		// Re-read file content and frontmatter to ensure freshness
		const docContent = this.view.editor.getValue();
		this.effectiveData = this.fmManager.getEffectiveGoalData(this.file, this.settings);
		this.parsedData = this.parser.parseDocument(
			this.file,
			docContent,
			{
				countType: this.settings.countType,
				excludeWhitespace: this.settings.excludeWhitespace,
				excludeRuby: this.settings.excludeRuby,
				excludeCharacters: this.settings.excludeCharacters,
			},
			this.effectiveData,
		);

		const { fileGoal, defaultSectionGoal, headingLevelGoals, sectionGoals, styleId } = this.fmManager.getGoalData(this.file);
		this.fileGoalInput = fileGoal;
		this.defaultSectionGoalInput = defaultSectionGoal;
		this.styleIdInput = styleId ?? this.effectiveData.styleId ?? this.settings.defaultStyleId ?? 1;
		this.headingLevelGoalsInput = headingLevelGoals ? { ...headingLevelGoals } : {};

		// Apply initial color style to modal
		const currentStyle = this.getEffectiveStyle();
		this.applyModalColorStyle(currentStyle);

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
			// Keep currently active input row visible in center when keyboard/IME resizes viewport
			const activeEl = document.activeElement;
			if (activeEl instanceof HTMLInputElement && this.contentEl.contains(activeEl)) {
				const activeItem = activeEl.closest('.sgb-section-tree-item');
				if (activeItem instanceof HTMLElement) {
					this.scrollToItem(activeItem);
				}
			}
		};

		if (window.visualViewport) {
			this.viewportResizeHandler = updateLayout;
			window.visualViewport.addEventListener('resize', this.viewportResizeHandler);
		}
	}

	/**
	 * Safely scrolls a tree item into center view of modal content container.
	 */
	private scrollToItem(itemEl: HTMLElement): void {
		const containerRect = this.contentEl.getBoundingClientRect();
		const itemRect = itemEl.getBoundingClientRect();
		const relativeTop = itemRect.top - containerRect.top + this.contentEl.scrollTop;
		const targetScroll = relativeTop - containerRect.height / 2 + itemRect.height / 2;
		this.contentEl.scrollTo({
			top: Math.max(0, targetScroll),
			behavior: 'smooth',
		});
	}

	private updateScrollbarOffset(): void {
		// Entire modal content scrolls as a single container, no extra offsets needed
	}

	private getHeadingLevelPlaceholder(level: number): string {
		// Priority: Folder heading level goal -> Note default section goal -> Folder default section goal -> Default placeholder
		const inheritedHeadingGoal = this.effectiveData.inheritedDefaults?.headingLevelGoals?.[level];
		if (inheritedHeadingGoal !== undefined && inheritedHeadingGoal > 0) {
			return String(inheritedHeadingGoal);
		}
		if (this.defaultSectionGoalInput !== undefined && this.defaultSectionGoalInput > 0) {
			return String(this.defaultSectionGoalInput);
		}
		const inheritedDefaultSecGoal = this.effectiveData.inheritedDefaults?.defaultSectionGoal;
		if (inheritedDefaultSecGoal !== undefined && inheritedDefaultSecGoal > 0) {
			return String(inheritedDefaultSecGoal);
		}
		return t('MODAL_GOAL_PLACEHOLDER');
	}

	private updateLevelInputPlaceholders(): void {
		for (let level = 1; level <= 6; level++) {
			const inputEl = this.levelInputElements.get(level);
			if (inputEl) {
				inputEl.placeholder = this.getHeadingLevelPlaceholder(level);
			}
		}
	}

	private getEffectiveSectionGoal(heading: string, level: number): number | undefined {
		// 1. Explicit section goal in note
		const explicitGoal = this.sectionGoalsMap.get(heading);
		if (explicitGoal !== undefined && explicitGoal > 0) {
			return explicitGoal;
		}
		// 2. Note heading level goal
		const noteLevelGoal = this.headingLevelGoalsInput[level];
		if (noteLevelGoal !== undefined && noteLevelGoal > 0) {
			return noteLevelGoal;
		}
		// 3. Folder heading level goal
		const inheritedLevelGoal = this.effectiveData.inheritedDefaults?.headingLevelGoals?.[level];
		if (inheritedLevelGoal !== undefined && inheritedLevelGoal > 0) {
			return inheritedLevelGoal;
		}
		// 4. Note default section goal
		if (this.defaultSectionGoalInput !== undefined && this.defaultSectionGoalInput > 0) {
			return this.defaultSectionGoalInput;
		}
		// 5. Folder default section goal
		const inheritedDefaultSecGoal = this.effectiveData.inheritedDefaults?.defaultSectionGoal;
		if (inheritedDefaultSecGoal !== undefined && inheritedDefaultSecGoal > 0) {
			return inheritedDefaultSecGoal;
		}
		return undefined;
	}

	private getSectionPlaceholder(level: number): string {
		const noteLevelGoal = this.headingLevelGoalsInput[level];
		if (noteLevelGoal !== undefined && noteLevelGoal > 0) {
			return String(noteLevelGoal);
		}
		const inheritedLevelGoal = this.effectiveData.inheritedDefaults?.headingLevelGoals?.[level];
		if (inheritedLevelGoal !== undefined && inheritedLevelGoal > 0) {
			return String(inheritedLevelGoal);
		}
		if (this.defaultSectionGoalInput !== undefined && this.defaultSectionGoalInput > 0) {
			return String(this.defaultSectionGoalInput);
		}
		const inheritedDefaultSecGoal = this.effectiveData.inheritedDefaults?.defaultSectionGoal;
		if (inheritedDefaultSecGoal !== undefined && inheritedDefaultSecGoal > 0) {
			return String(inheritedDefaultSecGoal);
		}
		return t('MODAL_GOAL_PLACEHOLDER');
	}

	private renderModal(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.inputElements.clear();
		this.levelInputElements.clear();
		this.contentEl.scrollLeft = 0;
		if (this.contentEl.parentElement) {
			this.contentEl.parentElement.scrollLeft = 0;
		}

		const titleText = this.settings.countType === 'word' ? t('MODAL_TITLE_WORDS') : t('MODAL_TITLE');
		contentEl.createEl('h2', { cls: 'sgb-modal-header-title', text: titleText });

		// Description for folder defaults with link to plugin settings
		const descEl = contentEl.createDiv({ cls: 'sgb-modal-header-desc' });
		const hintTemplate = t('MODAL_FOLDER_DEFAULTS_HINT');
		const linkText = t('MODAL_FOLDER_DEFAULTS_HINT_LINK');
		const parts = hintTemplate.split('{link}');

		if (parts.length === 2) {
			descEl.appendText(parts[0] ?? '');
			const linkEl = descEl.createEl('a', {
				cls: 'sgb-folder-hint-link',
				text: linkText,
				href: '#',
			});
			linkEl.addEventListener('click', (e) => {
				e.preventDefault();
				void (async () => {
					await this.saveGoals();
					this.close();
					this.openPluginSettings();
				})();
			});
			descEl.appendText(parts[1] ?? '');
		} else {
			descEl.setText(hintTemplate);
		}

		// --- Master Table Column Header (Labels all rows below) ---
		const tableHeaderEl = contentEl.createDiv({ cls: 'sgb-section-table-header' });
		tableHeaderEl.createSpan({ cls: 'sgb-header-title', text: '' });
		const headerControlsEl = tableHeaderEl.createDiv({ cls: 'sgb-header-controls' });
		headerControlsEl.createSpan({ cls: 'sgb-header-chars', text: t('MODAL_COL_CURRENT') });
		headerControlsEl.createSpan({ cls: 'sgb-header-goal', text: t('MODAL_COL_GOAL') });
		headerControlsEl.createSpan({ cls: 'sgb-header-progress', text: t('MODAL_COL_PROGRESS') });

		// --- Section 1: Compact Top Configuration Card ---
		const topCardEl = contentEl.createDiv({ cls: 'sgb-modal-top-card' });
		const totalChars = this.parsedData.totalCharCount;

		// Row 1: Note Total Goal
		const totalRowEl = topCardEl.createDiv({ cls: 'sgb-modal-card-row' });
		const totalLabelGroup = totalRowEl.createDiv({ cls: 'sgb-card-label-group' });
		const totalTitleEl = totalLabelGroup.createSpan({ cls: 'sgb-card-title' });
		const totalIconEl = totalTitleEl.createSpan({ cls: 'sgb-card-title-icon' });
		setIcon(totalIconEl, 'book-text');
		totalTitleEl.createSpan({ text: t('MODAL_TOTAL_GOAL_NAME') });

		const totalControls = totalRowEl.createDiv({ cls: 'sgb-card-controls' });

		// Col 1: Total character count
		totalControls.createSpan({
			cls: 'sgb-section-chars',
			text: totalChars.toLocaleString(),
		});

		// Col 2: Total goal input
		const totalInputWrapper = totalControls.createDiv({ cls: 'sgb-goal-input-wrapper' });
		const totalPlaceholder = this.effectiveData.inheritedDefaults?.fileGoal
			? String(this.effectiveData.inheritedDefaults.fileGoal)
			: t('MODAL_GOAL_PLACEHOLDER');
		const totalInput = totalInputWrapper.createEl('input', {
			type: 'number',
			cls: 'sgb-goal-input',
			placeholder: totalPlaceholder,
		});
		if (this.fileGoalInput !== undefined && this.fileGoalInput > 0) {
			totalInput.value = String(this.fileGoalInput);
		}
		this.totalGoalInputElement = totalInput;

		// Col 3: Stacked mini progress (% on top, bar on bottom)
		const totalProgressWrapper = totalControls.createDiv({ cls: 'sgb-mini-progress-wrapper' });
		const totalPercentEl = totalProgressWrapper.createSpan({ cls: 'sgb-mini-percent' });
		const totalProgressEl = totalProgressWrapper.createDiv({ cls: 'sgb-mini-progress' });
		const totalProgressFill = totalProgressEl.createDiv({ cls: 'sgb-mini-progress-fill' });
		this.updateMiniProgress(totalProgressFill, totalPercentEl, totalChars, this.fileGoalInput);

		totalInput.addEventListener('input', () => {
			const num = parseInt(totalInput.value, 10);
			this.fileGoalInput = !isNaN(num) && num > 0 ? num : undefined;
			this.updateMiniProgress(totalProgressFill, totalPercentEl, totalChars, this.fileGoalInput);
			this.debouncedSaveGoals();
		});

		// Row 2: Default Section Goal
		const defaultRowEl = topCardEl.createDiv({ cls: 'sgb-modal-card-row' });
		const defaultLabelGroup = defaultRowEl.createDiv({ cls: 'sgb-card-label-group' });
		const defaultTitleEl = defaultLabelGroup.createSpan({ cls: 'sgb-card-title' });
		const defaultIconEl = defaultTitleEl.createSpan({ cls: 'sgb-card-title-icon' });
		setIcon(defaultIconEl, 'hash');
		defaultTitleEl.createSpan({ text: t('MODAL_DEFAULT_SECTION_GOAL_NAME') });
		defaultLabelGroup.createSpan({ cls: 'sgb-card-desc', text: t('MODAL_DEFAULT_SECTION_DESC') });

		const defaultControls = defaultRowEl.createDiv({ cls: 'sgb-card-controls' });

		// Col 1: Empty spacer to match table column
		defaultControls.createDiv({ cls: 'sgb-spacer-chars' });

		// Col 2: Default goal input
		const defaultInputWrapper = defaultControls.createDiv({ cls: 'sgb-goal-input-wrapper' });
		const defaultPlaceholder = this.effectiveData.inheritedDefaults?.defaultSectionGoal
			? String(this.effectiveData.inheritedDefaults.defaultSectionGoal)
			: t('MODAL_GOAL_PLACEHOLDER');
		const defaultInput = defaultInputWrapper.createEl('input', {
			type: 'number',
			cls: 'sgb-goal-input',
			placeholder: defaultPlaceholder,
		});
		if (this.defaultSectionGoalInput !== undefined && this.defaultSectionGoalInput > 0) {
			defaultInput.value = String(this.defaultSectionGoalInput);
		}
		this.defaultSectionGoalInputElement = defaultInput;

		// Col 3: Empty spacer to match table column
		defaultControls.createDiv({ cls: 'sgb-spacer-progress' });

		defaultInput.addEventListener('input', () => {
			const num = parseInt(defaultInput.value, 10);
			this.defaultSectionGoalInput = !isNaN(num) && num > 0 ? num : undefined;
			this.updateLevelInputPlaceholders();
			this.refreshSectionMiniProgress();
			this.debouncedSaveGoals();
		});

		// Row 3: Collapsible Level-specific default goals
		const accordionContainer = topCardEl.createDiv({ cls: 'sgb-accordion-container' });
		const accordionHeader = accordionContainer.createDiv({
			cls: `sgb-accordion-header ${this.isHeadingLevelGoalsOpen ? 'is-open' : ''}`,
		});
		const accordionChevron = accordionHeader.createSpan({ cls: 'sgb-accordion-chevron' });
		setIcon(accordionChevron, this.isHeadingLevelGoalsOpen ? 'chevron-down' : 'chevron-right');
		accordionHeader.createSpan({
			cls: 'sgb-accordion-title',
			text: t('MODAL_HEADING_LEVEL_GOALS_TOGGLE'),
		});

		const accordionBody = accordionContainer.createDiv({
			cls: `sgb-accordion-body ${this.isHeadingLevelGoalsOpen ? 'is-open' : ''}`,
		});

		accordionHeader.addEventListener('click', () => {
			this.isHeadingLevelGoalsOpen = !this.isHeadingLevelGoalsOpen;
			if (this.isHeadingLevelGoalsOpen) {
				accordionHeader.addClass('is-open');
				accordionBody.addClass('is-open');
				setIcon(accordionChevron, 'chevron-down');
			} else {
				accordionHeader.removeClass('is-open');
				accordionBody.removeClass('is-open');
				setIcon(accordionChevron, 'chevron-right');
			}
			this.contentEl.scrollLeft = 0;
			if (this.contentEl.parentElement) {
				this.contentEl.parentElement.scrollLeft = 0;
			}
			this.updateScrollbarOffset();
		});

		const levelGrid = accordionBody.createDiv({ cls: 'sgb-level-goals-grid' });
		for (let level = 1; level <= 6; level++) {
			const itemEl = levelGrid.createDiv({ cls: 'sgb-level-goal-item' });
			const labelEl = itemEl.createSpan({ cls: 'sgb-level-goal-label' });
			labelEl.title = `H${level}`;
			const iconSpan = labelEl.createSpan({ cls: 'sgb-level-goal-icon' });
			setIcon(iconSpan, `heading-${level}`);

			const levelPlaceholder = this.getHeadingLevelPlaceholder(level);

			const input = itemEl.createEl('input', {
				type: 'number',
				cls: 'sgb-goal-input sgb-level-input',
				placeholder: levelPlaceholder,
			});
			this.levelInputElements.set(level, input);

			const val = this.headingLevelGoalsInput[level];
			if (val !== undefined && val > 0) {
				input.value = String(val);
			}

			input.addEventListener('input', () => {
				const num = parseInt(input.value, 10);
				if (!isNaN(num) && num > 0) {
					this.headingLevelGoalsInput[level] = num;
				} else {
					delete this.headingLevelGoalsInput[level];
				}
				this.refreshSectionMiniProgress();
				this.debouncedSaveGoals();
			});
		}



		// Row 4: Color Style Selection
		const styleRowEl = topCardEl.createDiv({ cls: 'sgb-modal-card-row sgb-modal-style-row' });
		const styleLabelGroup = styleRowEl.createDiv({ cls: 'sgb-card-label-group' });
		const styleTitleEl = styleLabelGroup.createSpan({ cls: 'sgb-card-title' });
		const styleIconEl = styleTitleEl.createSpan({ cls: 'sgb-card-title-icon' });
		setIcon(styleIconEl, 'palette');
		styleTitleEl.createSpan({ text: t('MODAL_COLOR_STYLE_LABEL') });
		styleLabelGroup.createSpan({ cls: 'sgb-card-desc', text: t('MODAL_COLOR_STYLE_DESC') });

		const styleControls = styleRowEl.createDiv({ cls: 'sgb-modal-style-controls' });

		// 4-color preview swatches
		const swatchesContainer = styleControls.createDiv({ cls: 'sgb-modal-color-swatches' });
		this.colorPreviewDots = [
			swatchesContainer.createSpan({ cls: 'sgb-color-preview-circle sgb-color-preview-default' }),
			swatchesContainer.createSpan({ cls: 'sgb-color-preview-circle sgb-color-preview-warn' }),
			swatchesContainer.createSpan({ cls: 'sgb-color-preview-circle sgb-color-preview-good' }),
			swatchesContainer.createSpan({ cls: 'sgb-color-preview-circle sgb-color-preview-done' }),
		];

		const dropdownWrapper = styleControls.createDiv({ cls: 'sgb-modal-style-dropdown-wrapper' });
		const dropdown = new DropdownComponent(dropdownWrapper);
		for (const s of this.settings.styles) {
			dropdown.addOption(String(s.id), s.name);
		}
		dropdown.setValue(String(this.styleIdInput));
		this.updateColorPreviewDots(this.getEffectiveStyle());

		dropdown.onChange((val) => {
			const id = parseInt(val, 10);
			if (!isNaN(id)) {
				this.styleIdInput = id;
				const selectedStyle = this.getEffectiveStyle();
				this.applyModalColorStyle(selectedStyle);
				this.updateColorPreviewDots(selectedStyle);
				this.debouncedSaveGoals();
			}
		});

		// --- Section 2: Headings tree goals & Set button ---
		const sectionHeaderEl = contentEl.createDiv({ cls: 'sgb-modal-section-header' });
		sectionHeaderEl.createEl('h3', { text: t('MODAL_SECTIONS_HEADER') });

		if (this.parsedData.flatSections.length > 0) {
			const setBtn = sectionHeaderEl.createEl('button', {
				cls: 'sgb-reset-button',
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
				cls: 'sgb-empty-notice',
			});
			this.updateScrollbarOffset();
			return;
		}

		const listContainer = contentEl.createDiv({ cls: 'sgb-section-tree-container' });

		let activeItemEl: HTMLElement | null = null;

		for (const section of this.parsedData.flatSections) {
			const itemEl = listContainer.createDiv({
				cls: `sgb-section-tree-item sgb-level-${section.level}`,
			});

			if (section.heading === this.activeSectionHeading) {
				itemEl.addClass('is-active-section');
				activeItemEl = itemEl;
			}

			// Heading title clickable to jump
			const titleEl = itemEl.createDiv({ cls: 'sgb-section-title' });
			const headingIcon = '#'.repeat(section.level);
			titleEl.createSpan({ cls: 'sgb-heading-prefix', text: `${headingIcon} ` });
			titleEl.createSpan({ cls: 'sgb-heading-name', text: section.heading });

			titleEl.addEventListener('click', () => {
				this.jumpToSection(section);
			});

			// Info & Input Controls
			const controlsEl = itemEl.createDiv({ cls: 'sgb-section-controls' });
			controlsEl.createSpan({
				cls: 'sgb-section-chars',
				text: section.charCount.toLocaleString(),
			});

			const explicitGoal = this.sectionGoalsMap.get(section.heading);
			const effectiveGoal = this.getEffectiveSectionGoal(section.heading, section.level);
			const placeholderVal = this.getSectionPlaceholder(section.level);

			const inputWrapperEl = controlsEl.createDiv({ cls: 'sgb-goal-input-wrapper' });
			const inputEl = inputWrapperEl.createEl('input', {
				type: 'number',
				cls: 'sgb-goal-input',
				placeholder: placeholderVal,
			});
			if (explicitGoal !== undefined && explicitGoal > 0) {
				inputEl.value = String(explicitGoal);
			}
			this.inputElements.set(section.heading, inputEl);

			// Stacked mini progress: percentage text on TOP, progress bar on BOTTOM
			const miniProgressWrapper = controlsEl.createDiv({ cls: 'sgb-mini-progress-wrapper' });
			const miniPercentEl = miniProgressWrapper.createSpan({ cls: 'sgb-mini-percent' });
			const miniProgressEl = miniProgressWrapper.createDiv({ cls: 'sgb-mini-progress' });
			const miniFillEl = miniProgressEl.createDiv({ cls: 'sgb-mini-progress-fill' });
			this.updateMiniProgress(miniFillEl, miniPercentEl, section.charCount, effectiveGoal);

			const onGoalChange = () => {
				const num = parseInt(inputEl.value, 10);
				if (!isNaN(num) && num > 0) {
					this.sectionGoalsMap.set(section.heading, num);
				} else {
					this.sectionGoalsMap.delete(section.heading);
				}
				const currentEffective = this.getEffectiveSectionGoal(section.heading, section.level);
				this.updateMiniProgress(miniFillEl, miniPercentEl, section.charCount, currentEffective);
				this.debouncedSaveGoals();
			};

			inputEl.addEventListener('input', onGoalChange);
			inputEl.addEventListener('change', onGoalChange);

			// Ensure mobile virtual keyboard doesn't occlude active input row
			inputEl.addEventListener('focus', () => {
				window.setTimeout(() => {
					this.scrollToItem(itemEl);
				}, 250);
			});
		}

		// Scroll to active section if needed
		if (activeItemEl) {
			window.setTimeout(() => {
				if (activeItemEl) {
					this.scrollToItem(activeItemEl);
				}
			}, 50);
		}

		// Calculate scrollbar width and sync layout
		this.updateScrollbarOffset();
	}

	private refreshSectionMiniProgress(): void {
		// Update placeholders and mini progress without destroying current input focus
		for (const sec of this.parsedData.flatSections) {
			const inputEl = this.inputElements.get(sec.heading);
			if (inputEl) {
				inputEl.placeholder = this.getSectionPlaceholder(sec.level);
			}
			const effective = this.getEffectiveSectionGoal(sec.heading, sec.level);
			const rowControlsEl = inputEl?.parentElement?.parentElement;
			const miniFillEl = rowControlsEl?.querySelector('.sgb-mini-progress-fill') as HTMLElement | null;
			const miniPercentEl = rowControlsEl?.querySelector('.sgb-mini-percent') as HTMLElement | null;
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
				'--sgb-mini-fill-width': `${Math.min(100, Math.max(0, percent))}%`,
			});
			percentEl.setText(`${percent}%`);

			fillEl.className = 'sgb-mini-progress-fill';
			percentEl.className = 'sgb-mini-percent';

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
				'--sgb-mini-fill-width': '0%',
			});
			percentEl.setText('-');
			fillEl.className = 'sgb-mini-progress-fill';
			percentEl.className = 'sgb-mini-percent';
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

		const inheritedDefaultStyleId =
			this.effectiveData.inheritedDefaults?.styleId ?? this.settings.defaultStyleId ?? 1;

		await this.fmManager.saveGoalData(
			this.file,
			this.fileGoalInput,
			this.defaultSectionGoalInput,
			sectionGoals,
			this.headingLevelGoalsInput,
			this.styleIdInput,
			inheritedDefaultStyleId,
		);
		this.onGoalsUpdated();
	}


	private getEffectiveStyle(): GoalColorStyle {
		const found = this.settings.styles.find((s) => s.id === this.styleIdInput);
		if (found) return found;
		const defaultStyle = this.settings.styles.find((s) => s.id === this.settings.defaultStyleId);
		if (defaultStyle) return defaultStyle;
		return this.settings.styles[0] ?? {
			id: 1,
			name: 'Default',
			colorDefault: '#ababab',
			colorWarn: '#e2b93b',
			colorGood: '#ff7843',
			colorDone: '#ff4d4f',
		};
	}

	private applyModalColorStyle(style: GoalColorStyle): void {
		setCssProps(this.contentEl, {
			'--sgb-color-default': style.colorDefault,
			'--sgb-color-warn': style.colorWarn,
			'--sgb-color-good': style.colorGood,
			'--sgb-color-done': style.colorDone,
		});
	}

	private updateColorPreviewDots(style: GoalColorStyle): void {
		if (this.colorPreviewDots.length === 4) {
			this.colorPreviewDots[0]!.style.backgroundColor = style.colorDefault;
			this.colorPreviewDots[1]!.style.backgroundColor = style.colorWarn;
			this.colorPreviewDots[2]!.style.backgroundColor = style.colorGood;
			this.colorPreviewDots[3]!.style.backgroundColor = style.colorDone;
		}
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

	private openPluginSettings(): void {
		const appWithSetting = this.app as unknown as {
			setting?: {
				open: () => void;
				openTabById: (id: string) => void;
			};
		};
		if (appWithSetting.setting) {
			appWithSetting.setting.open();
			appWithSetting.setting.openTabById('section-goals-badge');
		}
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
		contentEl.addClass('sgb-confirm-modal');

		contentEl.createEl('p', { text: t('MODAL_SET_CONFIRM_MSG') });

		const buttonContainer = contentEl.createDiv({ cls: 'sgb-confirm-buttons' });

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
