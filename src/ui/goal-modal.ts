import { App, DropdownComponent, MarkdownView, Modal, setIcon, setTooltip, TFile } from 'obsidian';
import { EffectiveGoalData, FrontmatterManager } from '../frontmatter/frontmatter-manager';
import { t } from '../lang/helpers';
import { ParsedDocumentSections, SectionParser } from '../parser/section-parser';
import { GoalColorStyle, PluginSettings, SectionGoalItem, SectionNode } from '../types';
import { FRONTMATTER_SAVE_DEBOUNCE_MS, PRESET_STYLE_LIMIT_ID } from '../utils/constants';
import { debounce } from '../utils/debounce';
import { setCssProps } from '../utils/dom';
import { calculateOverflowSegments } from '../utils/progress';
import { getProgressColor } from '../utils/color';
import { DateGoalsTabRenderer } from './goal-modal-date-tab';
import { ConfirmModal } from './confirm-modal';
import { matchSectionGoals } from '../utils/date-goal';

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
	private activeTab: 'count' | 'date';
	private dateTabRenderer!: DateGoalsTabRenderer;
	private occurrenceOverrides?: Map<number, number>;

	private fileGoalInput: number | undefined;
	private defaultSectionGoalInput: number | undefined;
	private styleIdInput!: number;
	private headingLevelGoalsInput: Record<number, number> = {};
	private isHeadingLevelGoalsOpen = false;
	private sectionGoalsByIndex: Map<number, number> = new Map();
	private activeSectionIndex: number | null = null;
	private inputElements: Map<number, HTMLInputElement> = new Map();
	private levelInputElements: Map<number, HTMLInputElement> = new Map();
	private totalGoalInputElement: HTMLInputElement | null = null;
	private defaultSectionGoalInputElement: HTMLInputElement | null = null;
	private colorPreviewDots: HTMLElement[] = [];
	private countTabBtn: HTMLElement | null = null;
	private dateTabBtn: HTMLElement | null = null;

	// Viewport resize listener for mobile keyboard handling
	private viewportResizeHandler: (() => void) | null = null;
	private contentScrollHandler: (() => void) | null = null;
	private isDirty = false;

	// Debounced saver to avoid aggressive disk/frontmatter writes during typing
	private debouncedSaveGoals = debounce(() => {
		this.isDirty = true;
		void this.saveGoals();
	}, FRONTMATTER_SAVE_DEBOUNCE_MS);

	constructor(
		app: App,
		file: TFile,
		view: MarkdownView,
		parser: SectionParser,
		fmManager: FrontmatterManager,
		settings: PluginSettings,
		onGoalsUpdated: () => void,
		initialTab: 'count' | 'date' = 'count',
		occurrenceOverrides?: Map<number, number>,
	) {
		super(app);
		this.file = file;
		this.view = view;
		this.parser = parser;
		this.fmManager = fmManager;
		this.settings = settings;
		this.onGoalsUpdated = onGoalsUpdated;
		this.activeTab = initialTab;
		this.occurrenceOverrides = occurrenceOverrides;

		// Calculate initial cursor offset
		const cursor = view.editor.getCursor();
		this.currentCursorOffset = view.editor.posToOffset(cursor);
	}

	async onOpen(): Promise<void> {
		const { contentEl, modalEl } = this;
		modalEl.addClass('sgb-goal-modal');
		contentEl.empty();
		contentEl.addClass('section-goals-badge-modal');

		// Container for header action buttons placed beside the native close button
		const headerActions = modalEl.createDiv({
			cls: 'sgb-modal-header-actions',
		});

		// Add "Word count goals" mode toggle button
		const countTabBtn = headerActions.createDiv({
			cls: 'sgb-modal-action-button sgb-modal-count-tab-button',
			attr: {
				'aria-label': t('MODAL_TAB_COUNT'),
				role: 'button',
			},
		});
		setIcon(countTabBtn, 'whole-word');
		setTooltip(countTabBtn, t('MODAL_TAB_COUNT'));
		countTabBtn.addEventListener('click', () => {
			if (this.activeTab !== 'count') {
				this.activeTab = 'count';
				this.renderModal();
				this.updateHeaderActionButtons();
			}
		});
		this.countTabBtn = countTabBtn;

		// Add "Date goals" mode toggle button
		const dateTabBtn = headerActions.createDiv({
			cls: 'sgb-modal-action-button sgb-modal-date-tab-button',
			attr: {
				'aria-label': t('MODAL_TAB_DATE'),
				role: 'button',
			},
		});
		setIcon(dateTabBtn, 'calendar');
		setTooltip(dateTabBtn, t('MODAL_TAB_DATE'));
		dateTabBtn.addEventListener('click', () => {
			if (this.activeTab !== 'date') {
				this.activeTab = 'date';
				this.renderModal();
				this.updateHeaderActionButtons();
			}
		});
		this.dateTabBtn = dateTabBtn;

		// Add "Scroll to top" button matching standard modal close button
		const scrollTopBtn = headerActions.createDiv({
			cls: 'sgb-modal-action-button sgb-modal-scroll-top-button',
			attr: {
				'aria-label': t('MODAL_SCROLL_TO_TOP'),
				role: 'button',
			},
		});
		setIcon(scrollTopBtn, 'chevrons-up');
		setTooltip(scrollTopBtn, t('MODAL_SCROLL_TO_TOP'));
		scrollTopBtn.addEventListener('click', () => {
			if (contentEl.scrollTop <= 10) return;
			scrollTopBtn.blur();
			contentEl.scrollTo({
				top: 0,
				behavior: 'smooth',
			});
		});

		this.updateHeaderActionButtons();

		// Update scroll-top button state based on content scrollability and scroll position
		const updateScrollButtonState = () => {
			const canScroll = contentEl.scrollHeight > contentEl.clientHeight + 5;
			if (!canScroll) {
				scrollTopBtn.addClass('sgb-hidden');
				return;
			}
			scrollTopBtn.removeClass('sgb-hidden');

			if (contentEl.scrollTop <= 10) {
				scrollTopBtn.addClass('is-disabled');
			} else {
				scrollTopBtn.removeClass('is-disabled');
			}
		};

		this.contentScrollHandler = updateScrollButtonState;
		contentEl.addEventListener('scroll', updateScrollButtonState, { passive: true });
		updateScrollButtonState();

		// Align header actions precisely with native modal-close-button on desktop
		const alignHeaderActions = () => {
			const isMobile = document.body.classList.contains('is-mobile') || document.body.classList.contains('is-phone');
			if (isMobile) return;

			const closeBtn = modalEl.querySelector('.modal-close-button');
			if (closeBtn instanceof HTMLElement) {
				const closeComputed = window.getComputedStyle(closeBtn);
				const topVal = closeComputed.top;
				const heightVal = closeComputed.height;
				const rightVal = parseFloat(closeComputed.right) || 8;
				const widthVal = parseFloat(closeComputed.width) || 28;

				if (topVal && topVal !== 'auto') {
					headerActions.style.top = topVal;
				}
				if (heightVal && heightVal !== 'auto') {
					headerActions.style.height = heightVal;
				}
				// Shift right so visual gap between scroll button and close button matches button gap (6px)
				headerActions.style.right = `${rightVal + widthVal - 2}px`;

				if (closeComputed.borderRadius) {
					const actionButtons = headerActions.querySelectorAll<HTMLElement>('.sgb-modal-action-button');
					actionButtons.forEach((btn) => {
						if (heightVal && heightVal !== 'auto') {
							btn.style.height = heightVal;
							btn.style.width = heightVal;
						}
						btn.style.borderRadius = closeComputed.borderRadius;
					});
				}
			}
		};

		alignHeaderActions();
		window.requestAnimationFrame(alignHeaderActions);
		window.setTimeout(alignHeaderActions, 50);
		window.setTimeout(alignHeaderActions, 200);

		// Handle mobile visual viewport resizing (when virtual keyboard pops up)
		this.setupViewportListener();

		// Re-read file content and frontmatter to ensure freshness
		const docContent = this.view.editor.getValue();
		this.effectiveData = this.fmManager.getEffectiveGoalData(this.file, this.settings, docContent);
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
			undefined,
			this.occurrenceOverrides,
		);

		const { fileGoal, defaultSectionGoal, headingLevelGoals, sectionGoals, styleId } = this.fmManager.getGoalData(this.file, docContent);
		this.fileGoalInput = fileGoal;
		this.defaultSectionGoalInput = defaultSectionGoal;
		this.styleIdInput = styleId ?? this.effectiveData.styleId ?? this.settings.defaultStyleId ?? PRESET_STYLE_LIMIT_ID;
		this.headingLevelGoalsInput = headingLevelGoals ? { ...headingLevelGoals } : {};

		// Apply initial color style to modal
		const currentStyle = this.getEffectiveStyle();
		this.applyModalColorStyle(currentStyle);

		// Build map of explicitly set goals by section index
		this.sectionGoalsByIndex.clear();
		const matchedGoals = matchSectionGoals(this.parsedData.flatSections, sectionGoals, this.occurrenceOverrides);
		for (const [idx, item] of matchedGoals.entries()) {
			if (typeof item.goal === 'number') {
				this.sectionGoalsByIndex.set(idx, item.goal);
			}
		}


		// Find active section based on cursor
		this.activeSectionIndex = null;
		for (let i = 0; i < this.parsedData.flatSections.length; i++) {
			const sec = this.parsedData.flatSections[i]!;
			if (this.currentCursorOffset >= sec.startOffset && this.currentCursorOffset <= sec.endOffset) {
				this.activeSectionIndex = i;
			}
		}

		this.dateTabRenderer = new DateGoalsTabRenderer(
			this.app,
			this.settings,
			this.fmManager,
			this.parsedData,
			this.effectiveData,
			this.activeSectionIndex,
			{
				saveGoals: () => {
					this.isDirty = true;
					return this.saveGoals();
				},
				debouncedSaveGoals: () => this.debouncedSaveGoals(),
				jumpToSection: (section) => this.jumpToSection(section),
				scrollToItem: (itemEl, smooth) => this.scrollToItem(itemEl, smooth),
			},
			this.occurrenceOverrides,
		);

		this.renderModal();
	}

	private setupViewportListener(): void {
		const updateLayout = () => {
			this.contentScrollHandler?.();
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
	private scrollToItem(itemEl: HTMLElement, smooth = false): void {
		const containerRect = this.contentEl.getBoundingClientRect();
		const itemRect = itemEl.getBoundingClientRect();
		const relativeTop = itemRect.top - containerRect.top + this.contentEl.scrollTop;
		const targetScroll = relativeTop - containerRect.height / 2 + itemRect.height / 2;
		this.contentEl.scrollTo({
			top: Math.max(0, targetScroll),
			behavior: smooth ? 'smooth' : 'auto',
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

	private getEffectiveSectionGoal(index: number, level: number): number | undefined {
		// 1. Explicit section goal in note
		const explicitGoal = this.sectionGoalsByIndex.get(index);
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

	public switchToTab(tab: 'count' | 'date'): void {
		if (this.activeTab !== tab) {
			this.activeTab = tab;
			this.renderModal();
			this.updateHeaderActionButtons();
		}
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

		// Title Bar
		const headerBarEl = contentEl.createDiv({ cls: 'sgb-modal-title-bar' });
		const titleText =
			this.activeTab === 'date'
				? t('MODAL_TAB_DATE')
				: this.settings.countType === 'word'
					? t('MODAL_TITLE_WORDS')
					: t('MODAL_TITLE');
		headerBarEl.createEl('h2', { cls: 'sgb-modal-header-title', text: titleText });

		this.updateHeaderActionButtons();

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

		if (this.activeTab === 'date') {
			const bodyContainerEl = contentEl.createDiv({ cls: 'sgb-modal-body-container sgb-date-body-container' });
			this.dateTabRenderer.renderDateTab(bodyContainerEl);
			this.updateScrollbarOffset();
			this.contentScrollHandler?.();
			return;
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
		const totalOverflowEl = totalProgressWrapper.createDiv({ cls: 'sgb-mini-overflow-progress sgb-hidden' });
		this.updateMiniProgress(totalProgressFill, totalPercentEl, totalChars, this.fileGoalInput, totalOverflowEl);

		totalInput.addEventListener('input', () => {
			const num = parseInt(totalInput.value, 10);
			this.fileGoalInput = !isNaN(num) && num > 0 ? num : undefined;
			this.updateMiniProgress(totalProgressFill, totalPercentEl, totalChars, this.fileGoalInput, totalOverflowEl);
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
			this.contentScrollHandler?.();
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
				const totalFill = this.contentEl.querySelector<HTMLElement>('.sgb-modal-card .sgb-mini-progress-fill');
				const totalPercent = this.contentEl.querySelector<HTMLElement>('.sgb-modal-card .sgb-mini-percent');
				const totalOverflow = this.contentEl.querySelector<HTMLElement>('.sgb-modal-card .sgb-mini-overflow-progress');
				if (totalFill && totalPercent) {
					this.updateMiniProgress(totalFill, totalPercent, this.parsedData.totalCharCount, this.fileGoalInput, totalOverflow ?? undefined);
				}
				this.refreshSectionMiniProgress();
				// Immediately save style changes to update editor frontmatter and badge without delay
				void (async () => {
					this.isDirty = true;
					await this.saveGoals();
				})();
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
				new ConfirmModal(this.app, {
					message: t('MODAL_SET_CONFIRM_MSG'),
					confirmText: t('MODAL_CONFIRM_OK'),
					isWarning: false,
					onConfirm: () => {
						this.setAllGoalsFromCurrent();
					},
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

		for (let i = 0; i < this.parsedData.flatSections.length; i++) {
			const section = this.parsedData.flatSections[i]!;
			const itemEl = listContainer.createDiv({
				cls: `sgb-section-tree-item sgb-level-${section.level}`,
			});

			if (i === this.activeSectionIndex) {
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

			const explicitGoal = this.sectionGoalsByIndex.get(i);
			const effectiveGoal = this.getEffectiveSectionGoal(i, section.level);
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
			this.inputElements.set(i, inputEl);

			// Stacked mini progress: percentage text on TOP, progress bar on BOTTOM
			const miniProgressWrapper = controlsEl.createDiv({ cls: 'sgb-mini-progress-wrapper' });
			const miniPercentEl = miniProgressWrapper.createSpan({ cls: 'sgb-mini-percent' });
			const miniProgressEl = miniProgressWrapper.createDiv({ cls: 'sgb-mini-progress' });
			const miniFillEl = miniProgressEl.createDiv({ cls: 'sgb-mini-progress-fill' });
			const miniOverflowEl = miniProgressWrapper.createDiv({ cls: 'sgb-mini-overflow-progress sgb-hidden' });
			this.updateMiniProgress(miniFillEl, miniPercentEl, section.charCount, effectiveGoal, miniOverflowEl);

			const onGoalChange = () => {
				const num = parseInt(inputEl.value, 10);
				if (!isNaN(num) && num > 0) {
					this.sectionGoalsByIndex.set(i, num);
				} else {
					this.sectionGoalsByIndex.delete(i);
				}
				const currentEffective = this.getEffectiveSectionGoal(i, section.level);
				this.updateMiniProgress(miniFillEl, miniPercentEl, section.charCount, currentEffective, miniOverflowEl);
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

		// Scroll to active section immediately
		if (activeItemEl) {
			window.setTimeout(() => {
				if (activeItemEl) {
					this.scrollToItem(activeItemEl, false);
					this.contentScrollHandler?.();
				}
			}, 0);
		}

		// Calculate scrollbar width and sync layout
		this.updateScrollbarOffset();
		this.contentScrollHandler?.();
	}

	private refreshSectionMiniProgress(): void {
		// Update placeholders and mini progress without destroying current input focus
		for (let i = 0; i < this.parsedData.flatSections.length; i++) {
			const sec = this.parsedData.flatSections[i]!;
			const inputEl = this.inputElements.get(i);
			if (inputEl) {
				inputEl.placeholder = this.getSectionPlaceholder(sec.level);
			}
			const effective = this.getEffectiveSectionGoal(i, sec.level);
			const rowControlsEl = inputEl?.parentElement?.parentElement;
			const miniFillEl = rowControlsEl?.querySelector('.sgb-mini-progress-fill') as HTMLElement | null;
			const miniPercentEl = rowControlsEl?.querySelector('.sgb-mini-percent') as HTMLElement | null;
			const miniOverflowEl = rowControlsEl?.querySelector('.sgb-mini-overflow-progress') as HTMLElement | null;
			if (miniFillEl && miniPercentEl) {
				this.updateMiniProgress(miniFillEl, miniPercentEl, sec.charCount, effective, miniOverflowEl ?? undefined);
			}
		}

		this.updateScrollbarOffset();
		this.contentScrollHandler?.();
	}

	private setAllGoalsFromCurrent(): void {
		for (let i = 0; i < this.parsedData.flatSections.length; i++) {
			const sec = this.parsedData.flatSections[i]!;
			this.sectionGoalsByIndex.set(i, sec.charCount);
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
		overflowEl?: HTMLElement,
	): void {
		if (goal && goal > 0) {
			const percent = Math.round((current / goal) * 100);
			setCssProps(fillEl, {
				'--sgb-mini-fill-width': `${Math.min(100, Math.max(0, percent))}%`,
			});
			percentEl.setText(`${percent}%`);

			fillEl.className = 'sgb-mini-progress-fill';
			percentEl.className = 'sgb-mini-percent';

			const effectiveStyle = this.getEffectiveStyle();
			if (effectiveStyle.type === 'gradient') {
				fillEl.addClass('is-progress-gradient');
				percentEl.addClass('is-progress-gradient');
				const currentColor = getProgressColor(effectiveStyle, percent, {
					warn: this.settings.colorThresholdWarn,
					good: this.settings.colorThresholdGood,
					done: this.settings.colorThresholdDone,
				});
				setCssProps(fillEl, { '--sgb-color-current': currentColor });
				setCssProps(percentEl, { '--sgb-color-current': currentColor });
			} else {
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
			}

			if (overflowEl) {
				const segments = calculateOverflowSegments(percent);
				overflowEl.empty();
				if (segments.length > 0) {
					overflowEl.removeClass('sgb-hidden');
					for (const segFill of segments) {
						const segEl = overflowEl.createDiv({ cls: 'sgb-mini-overflow-segment' });
						const fill = segEl.createDiv({ cls: 'sgb-mini-overflow-fill' });
						fill.style.width = `${segFill}%`;
					}
				} else {
					overflowEl.addClass('sgb-hidden');
				}
			}
		} else {
			setCssProps(fillEl, {
				'--sgb-mini-fill-width': '0%',
			});
			percentEl.setText('-');
			fillEl.className = 'sgb-mini-progress-fill';
			percentEl.className = 'sgb-mini-percent';
			if (overflowEl) {
				overflowEl.empty();
				overflowEl.addClass('sgb-hidden');
			}
		}
	}

	private async saveGoals(): Promise<void> {
		this.isDirty = false;
		if (this.dateTabRenderer) {
			this.dateTabRenderer.cleanupInvalidDates();
		}

		const sectionGoals: SectionGoalItem[] = [];

		const headingTotalCounts = new Map<string, number>();
		for (const s of this.parsedData.flatSections) {
			headingTotalCounts.set(s.heading, (headingTotalCounts.get(s.heading) ?? 0) + 1);
		}

		const headingOccCounter = new Map<string, number>();
		// Maintain document order of flat sections
		for (let i = 0; i < this.parsedData.flatSections.length; i++) {
			const sec = this.parsedData.flatSections[i]!;
			const occ = (headingOccCounter.get(sec.heading) ?? 0) + 1;
			headingOccCounter.set(sec.heading, occ);

			const goal = this.sectionGoalsByIndex.get(i);
			const dateData = this.dateTabRenderer?.getSectionGoal(i);
			const hasGoal = goal !== undefined && goal > 0;
			const hasDate = Boolean(dateData && (dateData.target || dateData.start || dateData.cycle));

			if (hasGoal || hasDate) {
				const isDuplicate = (headingTotalCounts.get(sec.heading) ?? 0) > 1;
				const item: SectionGoalItem = {
					heading: sec.heading,
					index: isDuplicate ? occ : undefined,
				};
				if (hasGoal) {
					item.goal = goal;
				}
				if (hasDate && dateData) {
					if (dateData.target) {
						item['target-date'] = dateData.target;
						item.target = dateData.target;
					}
					if (dateData.start) {
						item['start-date'] = dateData.start;
						item.start = dateData.start;
					}
					if (dateData.cycle) {
						item.cycle = dateData.cycle;
					}
				}
				sectionGoals.push(item);
			}
		}

		const inheritedDefaultStyleId =
			this.effectiveData.inheritedDefaults?.styleId ?? this.settings.defaultStyleId ?? 1;

		const dateGoals = this.dateTabRenderer
			? {
					fileTargetDate: this.dateTabRenderer.fileTargetDateInput,
					fileStartDate: this.dateTabRenderer.fileStartDateInput,
					fileCycle: this.dateTabRenderer.fileCycleInput,
					fileDateReference: this.dateTabRenderer.fileDateReferenceInput,
					sectionDateGoals: this.dateTabRenderer.getSectionDateGoalsList(),
				}
			: undefined;

		let saved = false;
		if (this.view && this.view.editor) {
			saved = this.fmManager.saveGoalDataToEditor(
				this.view.editor,
				this.fileGoalInput,
				this.defaultSectionGoalInput,
				sectionGoals,
				this.headingLevelGoalsInput,
				this.styleIdInput,
				inheritedDefaultStyleId,
				dateGoals,
			);
		}

		if (!saved) {
			await this.fmManager.saveGoalData(
				this.file,
				this.fileGoalInput,
				this.defaultSectionGoalInput,
				sectionGoals,
				this.headingLevelGoalsInput,
				this.styleIdInput,
				inheritedDefaultStyleId,
				dateGoals,
			);
		}

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
			if (style.type === 'gradient') {
				this.colorPreviewDots[0]!.removeClass('sgb-hidden');
				this.colorPreviewDots[0]!.style.backgroundColor = style.colorDefault;
				this.colorPreviewDots[1]!.addClass('sgb-hidden');
				this.colorPreviewDots[2]!.addClass('sgb-hidden');
				this.colorPreviewDots[3]!.removeClass('sgb-hidden');
				this.colorPreviewDots[3]!.style.backgroundColor = style.colorDone;
			} else {
				this.colorPreviewDots[0]!.removeClass('sgb-hidden');
				this.colorPreviewDots[0]!.style.backgroundColor = style.colorDefault;
				this.colorPreviewDots[1]!.removeClass('sgb-hidden');
				this.colorPreviewDots[1]!.style.backgroundColor = style.colorWarn;
				this.colorPreviewDots[2]!.removeClass('sgb-hidden');
				this.colorPreviewDots[2]!.style.backgroundColor = style.colorGood;
				this.colorPreviewDots[3]!.removeClass('sgb-hidden');
				this.colorPreviewDots[3]!.style.backgroundColor = style.colorDone;
			}
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

	private openPluginSettings(targetSectionKey?: Parameters<typeof t>[0]): void {
		const appWithSetting = this.app as unknown as {
			setting?: {
				open: () => void;
				openTabById: (id: string) => { expandAndScrollToSection?: (heading: string) => void } | undefined;
			};
		};
		if (appWithSetting.setting) {
			appWithSetting.setting.open();
			const tab = appWithSetting.setting.openTabById('section-goals-badge');
			if (targetSectionKey && tab && typeof tab.expandAndScrollToSection === 'function') {
				tab.expandAndScrollToSection(t(targetSectionKey));
			}
		}
	}

	private updateHeaderActionButtons(): void {
		if (this.countTabBtn) {
			this.countTabBtn.classList.toggle('is-active', this.activeTab === 'count');
		}
		if (this.dateTabBtn) {
			this.dateTabBtn.classList.toggle('is-active', this.activeTab === 'date');
		}
	}

	onClose(): void {
		if (this.viewportResizeHandler && window.visualViewport) {
			window.visualViewport.removeEventListener('resize', this.viewportResizeHandler);
			this.viewportResizeHandler = null;
		}

		if (this.contentScrollHandler) {
			this.contentEl.removeEventListener('scroll', this.contentScrollHandler);
			this.contentScrollHandler = null;
		}

		// Sync any pending inputs immediately
		if (this.totalGoalInputElement) {
			const num = parseInt(this.totalGoalInputElement.value, 10);
			const val = !isNaN(num) && num > 0 ? num : undefined;
			if (val !== this.fileGoalInput) {
				this.fileGoalInput = val;
				this.isDirty = true;
			}
		}

		if (this.defaultSectionGoalInputElement) {
			const num = parseInt(this.defaultSectionGoalInputElement.value, 10);
			const val = !isNaN(num) && num > 0 ? num : undefined;
			if (val !== this.defaultSectionGoalInput) {
				this.defaultSectionGoalInput = val;
				this.isDirty = true;
			}
		}

		for (const [index, inputEl] of this.inputElements.entries()) {
			const num = parseInt(inputEl.value, 10);
			const val = !isNaN(num) && num > 0 ? num : undefined;
			if (val !== this.sectionGoalsByIndex.get(index)) {
				if (val !== undefined) {
					this.sectionGoalsByIndex.set(index, val);
				} else {
					this.sectionGoalsByIndex.delete(index);
				}
				this.isDirty = true;
			}
		}

		if (this.dateTabRenderer) {
			this.dateTabRenderer.cleanupInvalidDates();
		}

		if (this.isDirty) {
			void (async () => {
				await this.saveGoals();
			})();
		}

		const { contentEl } = this;
		contentEl.empty();
	}
}

