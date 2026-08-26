import { App, PluginSettingTab, setIcon, Setting } from 'obsidian';
import { t } from './lang/helpers';
import type SectionGoalsBadgePlugin from './main';
import { BadgePositionPreset, CountType, CumulativeCountMode, PluginSettings } from './types';

export const DEFAULT_SETTINGS: PluginSettings = {
	// Section options
	showSectionProgress: true,
	showSectionCurrent: true,
	showSectionPercentage: true,
	showSectionGoal: true,
	showSectionIcon: true,
	sectionLabel: '',
	showHeadingLevel1: false,
	showHeadingLevel2: false,
	showHeadingLevel3: false,
	showHeadingLevel4: false,
	showHeadingLevel5: false,
	showHeadingLevel6: false,

	// Cumulative options
	showCumulativeProgress: true,
	showCumulativeCurrent: true,
	showCumulativePercentage: false,
	showCumulativeGoal: false,
	showCumulativeIcon: true,
	cumulativeLabel: '',
	cumulativeMode: 'from-section',

	// Total options
	showTotalProgress: true,
	showTotalCurrent: true,
	showTotalPercentage: true,
	showTotalGoal: true,
	showTotalIcon: true,
	totalLabel: '',

	// Badge Appearance
	badgePosition: 'bottom-right',
	offsetX: 24,
	offsetY: 24,
	badgeOpacity: 0.9,
	fontSize: 12,

	// Color Thresholds
	colorThresholdWarn: 50,
	colorThresholdGood: 80,
	colorThresholdDone: 100,

	// Counting rules
	countType: 'character',
	excludeWhitespace: true,
	excludeRuby: false,
	excludeCharacters: '',

	// Interactions
	longPressToOpenModal: false,
};

export class SectionGoalsBadgeSettingTab extends PluginSettingTab {
	plugin: SectionGoalsBadgePlugin;
	private observer: MutationObserver | null = null;
	private isHeadingLevelsAccordionOpen = false;

	constructor(app: App, plugin: SectionGoalsBadgePlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.initObserver();
	}

	display(): void {
		this.initObserver();
		this.scheduleEnhancements();
	}

	hide(): void {
		// When settings tab is closed on mobile/desktop, immediately refresh badge with saved settings
		this.plugin.refreshBadgeUI();
		this.plugin.recalculateCounts();
	}

	public destroy(): void {
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}
	}

	private initObserver(): void {
		if (this.observer) return;
		this.observer = new MutationObserver(() => {
			this.runEnhancements();
		});

		// Observe containerEl
		this.observer.observe(this.containerEl, { childList: true, subtree: true });

		// Also observe parent/modal if available
		const targetRoot = this.getTargetRoot();
		if (targetRoot && targetRoot !== this.containerEl) {
			this.observer.observe(targetRoot, { childList: true, subtree: true });
		}
	}

	private getTargetRoot(): HTMLElement {
		return (
			(this.containerEl.closest(
				'.modal, .modal-content, .vertical-tab-content-container, .vertical-tab-content, .mobile-settings-tab, .app-container',
			) as HTMLElement) || this.containerEl
		);
	}

	private scheduleEnhancements(): void {
		[0, 30, 80, 150, 300, 600].forEach((delay) => {
			window.setTimeout(() => {
				this.runEnhancements();
			}, delay);
		});
	}

	private runEnhancements(): void {
		this.applyEnhancements(this.containerEl);
		const targetRoot = this.getTargetRoot();
		if (targetRoot && targetRoot !== this.containerEl) {
			this.applyEnhancements(targetRoot);
		}
	}

	public updateGroupVisibility(targetRoot?: HTMLElement): void {
		const target = targetRoot || this.getTargetRoot();

		const groups = [
			{
				label: t('SETTINGS_CUMULATIVE_SHOW'),
				enabled: this.plugin.settings.showCumulativeProgress,
			},
			{
				label: t('SETTINGS_SECTION_SHOW'),
				enabled: this.plugin.settings.showSectionProgress,
			},
			{
				label: t('SETTINGS_TOTAL_SHOW'),
				enabled: this.plugin.settings.showTotalProgress,
			},
		];

		const headingLevelNames = [
			t('SETTINGS_HEADING_LEVEL_1'),
			t('SETTINGS_HEADING_LEVEL_2'),
			t('SETTINGS_HEADING_LEVEL_3'),
			t('SETTINGS_HEADING_LEVEL_4'),
			t('SETTINGS_HEADING_LEVEL_5'),
			t('SETTINGS_HEADING_LEVEL_6'),
		];

		const allItems = Array.from(target.querySelectorAll<HTMLElement>('.setting-item'));
		groups.forEach(({ label, enabled }) => {
			const parentIdx = allItems.findIndex((item) => {
				return item.querySelector('.setting-item-name')?.textContent?.trim() === label;
			});

			if (parentIdx !== -1) {
				for (let i = parentIdx + 1; i < allItems.length; i++) {
					const item = allItems[i];
					if (!item) continue;
					const name = item.querySelector('.setting-item-name')?.textContent?.trim();
					if (name && groups.some((g) => g.label === name)) {
						break;
					}
					if (item.classList.contains('setting-item-heading')) {
						break;
					}

					// Special handling for heading level items: folded under accordion
					if (name && headingLevelNames.includes(name)) {
						const showLevelItem = enabled && this.isHeadingLevelsAccordionOpen;
						item.style.setProperty('display', showLevelItem ? '' : 'none', 'important');
						item.addClass('sgb-setting-sub-item');
					} else {
						item.style.setProperty('display', enabled ? '' : 'none', 'important');
					}
				}
			}
		});

		// Accordion header row visibility
		const accordionRow = target.querySelector<HTMLElement>('.sgb-settings-accordion-item');
		if (accordionRow) {
			accordionRow.style.setProperty(
				'display',
				this.plugin.settings.showSectionProgress ? '' : 'none',
				'important',
			);
		}
	}

	private applyEnhancements(root: HTMLElement): void {
		const iconMap: Record<string, string> = {
			[t('SETTINGS_HEADING_CUMULATIVE')]: 'text-cursor',
			[t('SETTINGS_HEADING_SECTION')]: 'hash',
			[t('SETTINGS_HEADING_TOTAL')]: 'book-text',
			[t('SETTINGS_HEADING_RULES')]: 'calculator',
			[t('SETTINGS_HEADING_APPEARANCE')]: 'layout',
			[t('SETTINGS_HEADING_THRESHOLDS')]: 'gauge',
			[t('SETTINGS_HEADING_SUPPORT')]: 'heart',
		};

		const swatchMap: Record<string, string> = {
			[t('SETTINGS_THRESH_WARN')]: 'sgb-color-preview-warn',
			[t('SETTINGS_THRESH_GOOD')]: 'sgb-color-preview-good',
			[t('SETTINGS_THRESH_DONE')]: 'sgb-color-preview-done',
		};

		const placeholderMap: Record<string, string> = {
			[t('SETTINGS_OFFSET_X')]: String(DEFAULT_SETTINGS.offsetX),
			[t('SETTINGS_OFFSET_Y')]: String(DEFAULT_SETTINGS.offsetY),
			[t('SETTINGS_THRESH_WARN')]: String(DEFAULT_SETTINGS.colorThresholdWarn),
			[t('SETTINGS_THRESH_GOOD')]: String(DEFAULT_SETTINGS.colorThresholdGood),
			[t('SETTINGS_THRESH_DONE')]: String(DEFAULT_SETTINGS.colorThresholdDone),
		};

		const resetMap: Record<string, { key: 'fontSize' | 'badgeOpacity'; defaultVal: number }> = {
			[t('SETTINGS_FONT_SIZE')]: { key: 'fontSize', defaultVal: DEFAULT_SETTINGS.fontSize },
			[t('SETTINGS_OPACITY')]: { key: 'badgeOpacity', defaultVal: DEFAULT_SETTINGS.badgeOpacity },
		};

		// 1. Inject Heading Icons
		const headingEls = root.querySelectorAll<HTMLElement>(
			'.setting-group-heading, .setting-item-heading, h2, h3, h4',
		);
		headingEls.forEach((el) => {
			if (el.querySelector('.sgb-heading-icon')) return;
			const text = el.textContent?.trim();
			if (text && iconMap[text]) {
				const iconName = iconMap[text];
				el.empty();
				el.addClass('sgb-setting-heading');
				const iconSpan = el.createSpan({ cls: 'sgb-heading-icon' });
				setIcon(iconSpan, iconName);
				el.createSpan({ text });
			}
		});

		// 2. Inject Accordion Header before H1 item if not already present
		const h1Name = t('SETTINGS_HEADING_LEVEL_1');
		const allItemEls = Array.from(root.querySelectorAll<HTMLElement>('.setting-item'));
		const h1Item = allItemEls.find(
			(item) => item.querySelector('.setting-item-name')?.textContent?.trim() === h1Name,
		);

		if (h1Item && h1Item.parentElement && !root.querySelector('.sgb-settings-accordion-item')) {
			const accordionEl = createDiv({ cls: 'setting-item sgb-settings-accordion-item' });
			const infoEl = accordionEl.createDiv({ cls: 'setting-item-info' });
			infoEl.createDiv({
				cls: 'setting-item-name',
				text: t('SETTINGS_HEADING_LEVELS_ACCORDION'),
			});
			infoEl.createDiv({
				cls: 'setting-item-description',
				text: t('SETTINGS_HEADING_LEVELS_ACCORDION_DESC'),
			});

			const controlEl = accordionEl.createDiv({ cls: 'setting-item-control' });
			const chevron = controlEl.createSpan({ cls: 'sgb-settings-accordion-chevron' });
			setIcon(chevron, this.isHeadingLevelsAccordionOpen ? 'chevron-down' : 'chevron-right');

			accordionEl.addEventListener('click', () => {
				this.isHeadingLevelsAccordionOpen = !this.isHeadingLevelsAccordionOpen;
				setIcon(chevron, this.isHeadingLevelsAccordionOpen ? 'chevron-down' : 'chevron-right');
				this.updateGroupVisibility(root);
			});

			h1Item.parentElement.insertBefore(accordionEl, h1Item);
		}

		// 3. Inject Color Swatches
		const nameEls = root.querySelectorAll<HTMLElement>('.setting-item-name');
		nameEls.forEach((el) => {
			if (el.querySelector('.sgb-color-preview-circle')) return;
			const text = el.textContent?.trim();
			if (text && swatchMap[text]) {
				const swatchClass = swatchMap[text];
				const circle = createSpan({ cls: `sgb-color-preview-circle ${swatchClass}` });
				el.prepend(circle);
			}
		});

		// 4. Bind direct event listeners to controls and inject enhancements
		const allElements = Array.from(
			root.querySelectorAll<HTMLElement>(
				'.setting-group-heading, .setting-item-heading, .setting-item, h2, h3, h4',
			),
		);
		let currentHeading = '';

		allElements.forEach((el) => {
			const isHeading =
				el.classList.contains('setting-item-heading') ||
				el.classList.contains('setting-group-heading') ||
				['H2', 'H3', 'H4'].includes(el.tagName);

			if (isHeading) {
				const headingText = el.textContent?.trim() || '';
				for (const knownHeading of Object.keys(iconMap)) {
					if (headingText.includes(knownHeading)) {
						currentHeading = knownHeading;
						break;
					}
				}
				return;
			}

			const nameText = el.querySelector('.setting-item-name')?.textContent?.trim();
			if (!nameText) return;

			const headingForThisItem = currentHeading;

			// Toggle checkboxes
			const toggleEl = el.querySelector<HTMLElement>('.checkbox-container');
			if (toggleEl && !toggleEl.dataset.sgbBound) {
				toggleEl.dataset.sgbBound = 'true';
				toggleEl.addEventListener('click', () => {
					window.setTimeout(() => {
						const isEnabled = toggleEl.classList.contains('is-enabled');
						this.syncSettingValue(headingForThisItem, nameText, isEnabled);
					}, 20);
				});
			}

			// Select dropdowns
			const selectEl = el.querySelector<HTMLSelectElement>('select.dropdown');
			if (selectEl && !selectEl.dataset.sgbBound) {
				selectEl.dataset.sgbBound = 'true';
				selectEl.addEventListener('change', () => {
					this.syncSettingValue(headingForThisItem, nameText, selectEl.value);
				});
			}

			// Text / Number inputs (exclude checkboxes and sliders)
			const inputEl = el.querySelector<HTMLInputElement>(
				'input:not([type="checkbox"]):not([type="range"]):not(.slider)',
			);
			if (inputEl) {
				if (placeholderMap[nameText] && !inputEl.placeholder) {
					inputEl.placeholder = placeholderMap[nameText];
				}
				if (!inputEl.dataset.sgbBound) {
					inputEl.dataset.sgbBound = 'true';
					inputEl.addEventListener('input', () => {
						const val = inputEl.type === 'number' ? parseFloat(inputEl.value) : inputEl.value;
						this.syncSettingValue(headingForThisItem, nameText, val);
					});
				}
			}

			// Sliders (real-time live update on dragging)
			const sliderEl = el.querySelector<HTMLInputElement>('input.slider, input[type="range"]');
			if (sliderEl && !sliderEl.dataset.sgbBound) {
				sliderEl.dataset.sgbBound = 'true';
				const handleSliderInput = () => {
					const val = parseFloat(sliderEl.value);
					if (!isNaN(val)) {
						this.syncSettingValue(headingForThisItem, nameText, val);
					}
				};
				sliderEl.addEventListener('input', handleSliderInput);
				sliderEl.addEventListener('change', handleSliderInput);
			}

			// Inject Reset to Default button for specific slider settings
			const resetConfig = resetMap[nameText];
			if (resetConfig) {
				const controlEl = el.querySelector<HTMLElement>('.setting-item-control');
				if (controlEl && !controlEl.querySelector('.sgb-reset-btn')) {
					const resetBtn = controlEl.createDiv({
						cls: 'clickable-icon extra-setting-button sgb-reset-btn',
					});
					resetBtn.setAttribute('aria-label', t('SETTINGS_RESET_DEFAULT'));
					setIcon(resetBtn, 'rotate-ccw');
					resetBtn.addEventListener('click', (e) => {
						e.preventDefault();
						e.stopPropagation();
						void (async () => {
							const { key, defaultVal } = resetConfig;
							if (key === 'fontSize') {
								this.plugin.settings.fontSize = defaultVal;
							} else if (key === 'badgeOpacity') {
								this.plugin.settings.badgeOpacity = defaultVal;
							}
							await this.plugin.saveSettings();
							this.plugin.updateBadgePosition();
							this.plugin.refreshBadgeUI();

							const sEl = controlEl.querySelector<HTMLInputElement>('input.slider, input[type="range"]');
							if (sEl) {
								sEl.value = String(defaultVal);
								sEl.dispatchEvent(new Event('input', { bubbles: true }));
								sEl.dispatchEvent(new Event('change', { bubbles: true }));
							}
						})();
					});
				}
			}
		});

		// 4. Update Child Visibility
		this.updateGroupVisibility(root);
	}

	private syncSettingValue(headingText: string, labelText: string, value: string | number | boolean): void {
		let isPositionUpdate = false;
		let isRecalculate = false;

		if (headingText === t('SETTINGS_HEADING_CUMULATIVE')) {
			switch (labelText) {
				case t('SETTINGS_CUMULATIVE_SHOW'):
					this.plugin.settings.showCumulativeProgress = value as boolean;
					this.updateGroupVisibility();
					break;
				case t('SETTINGS_CUMULATIVE_MODE'):
					this.plugin.settings.cumulativeMode = value as CumulativeCountMode;
					isRecalculate = true;
					break;
				case t('SETTINGS_CUMULATIVE_CURRENT'):
					this.plugin.settings.showCumulativeCurrent = value as boolean;
					break;
				case t('SETTINGS_CUMULATIVE_GOAL'):
					this.plugin.settings.showCumulativeGoal = value as boolean;
					break;
				case t('SETTINGS_CUMULATIVE_PERCENT'):
					this.plugin.settings.showCumulativePercentage = value as boolean;
					break;
				case t('SETTINGS_CUMULATIVE_ICON'):
					this.plugin.settings.showCumulativeIcon = value as boolean;
					break;
				case t('SETTINGS_CUMULATIVE_LABEL'):
					this.plugin.settings.cumulativeLabel = String(value);
					break;
			}
		} else if (headingText === t('SETTINGS_HEADING_SECTION')) {
			switch (labelText) {
				case t('SETTINGS_SECTION_SHOW'):
					this.plugin.settings.showSectionProgress = value as boolean;
					this.updateGroupVisibility();
					break;
				case t('SETTINGS_SECTION_CURRENT'):
					this.plugin.settings.showSectionCurrent = value as boolean;
					break;
				case t('SETTINGS_SECTION_GOAL'):
					this.plugin.settings.showSectionGoal = value as boolean;
					break;
				case t('SETTINGS_SECTION_PERCENT'):
					this.plugin.settings.showSectionPercentage = value as boolean;
					break;
				case t('SETTINGS_SECTION_ICON'):
					this.plugin.settings.showSectionIcon = value as boolean;
					break;
				case t('SETTINGS_SECTION_LABEL'):
					this.plugin.settings.sectionLabel = String(value);
					break;
				case t('SETTINGS_HEADING_LEVEL_1'):
					this.plugin.settings.showHeadingLevel1 = value as boolean;
					break;
				case t('SETTINGS_HEADING_LEVEL_2'):
					this.plugin.settings.showHeadingLevel2 = value as boolean;
					break;
				case t('SETTINGS_HEADING_LEVEL_3'):
					this.plugin.settings.showHeadingLevel3 = value as boolean;
					break;
				case t('SETTINGS_HEADING_LEVEL_4'):
					this.plugin.settings.showHeadingLevel4 = value as boolean;
					break;
				case t('SETTINGS_HEADING_LEVEL_5'):
					this.plugin.settings.showHeadingLevel5 = value as boolean;
					break;
				case t('SETTINGS_HEADING_LEVEL_6'):
					this.plugin.settings.showHeadingLevel6 = value as boolean;
					break;
			}
		} else if (headingText === t('SETTINGS_HEADING_TOTAL')) {
			switch (labelText) {
				case t('SETTINGS_TOTAL_SHOW'):
					this.plugin.settings.showTotalProgress = value as boolean;
					this.updateGroupVisibility();
					break;
				case t('SETTINGS_TOTAL_CURRENT'):
					this.plugin.settings.showTotalCurrent = value as boolean;
					break;
				case t('SETTINGS_TOTAL_GOAL'):
					this.plugin.settings.showTotalGoal = value as boolean;
					break;
				case t('SETTINGS_TOTAL_PERCENT'):
					this.plugin.settings.showTotalPercentage = value as boolean;
					break;
				case t('SETTINGS_TOTAL_ICON'):
					this.plugin.settings.showTotalIcon = value as boolean;
					break;
				case t('SETTINGS_TOTAL_LABEL'):
					this.plugin.settings.totalLabel = String(value);
					break;
			}
		} else if (headingText === t('SETTINGS_HEADING_RULES')) {
			switch (labelText) {
				case t('SETTINGS_COUNT_TYPE'):
					this.plugin.settings.countType = value as CountType;
					isRecalculate = true;
					break;
				case t('SETTINGS_EXCLUDE_WHITESPACE'):
					this.plugin.settings.excludeWhitespace = value as boolean;
					isRecalculate = true;
					break;
				case t('SETTINGS_EXCLUDE_RUBY'):
					this.plugin.settings.excludeRuby = value as boolean;
					isRecalculate = true;
					break;
				case t('SETTINGS_EXCLUDE_CHARACTERS'):
					this.plugin.settings.excludeCharacters = String(value);
					isRecalculate = true;
					break;
			}
		} else if (headingText === t('SETTINGS_HEADING_APPEARANCE')) {
			switch (labelText) {
				case t('SETTINGS_BADGE_POS'):
					this.plugin.settings.badgePosition = value as BadgePositionPreset;
					isPositionUpdate = true;
					break;
				case t('SETTINGS_FONT_SIZE'): {
					const val = typeof value === 'number' ? value : parseFloat(String(value));
					if (!isNaN(val)) {
						this.plugin.settings.fontSize = val;
						isPositionUpdate = true;
					}
					break;
				}
				case t('SETTINGS_OFFSET_X'): {
					const val = typeof value === 'number' && !isNaN(value) ? value : DEFAULT_SETTINGS.offsetX;
					this.plugin.settings.offsetX = val;
					isPositionUpdate = true;
					break;
				}
				case t('SETTINGS_OFFSET_Y'): {
					const val = typeof value === 'number' && !isNaN(value) ? value : DEFAULT_SETTINGS.offsetY;
					this.plugin.settings.offsetY = val;
					isPositionUpdate = true;
					break;
				}
				case t('SETTINGS_OPACITY'): {
					const val = typeof value === 'number' ? value : parseFloat(String(value));
					if (!isNaN(val)) {
						this.plugin.settings.badgeOpacity = val;
						isPositionUpdate = true;
					}
					break;
				}
			}
		} else if (headingText === t('SETTINGS_HEADING_THRESHOLDS')) {
			switch (labelText) {
				case t('SETTINGS_THRESH_WARN'): {
					const val = typeof value === 'number' && !isNaN(value) ? value : DEFAULT_SETTINGS.colorThresholdWarn;
					this.plugin.settings.colorThresholdWarn = val;
					break;
				}
				case t('SETTINGS_THRESH_GOOD'): {
					const val = typeof value === 'number' && !isNaN(value) ? value : DEFAULT_SETTINGS.colorThresholdGood;
					this.plugin.settings.colorThresholdGood = val;
					break;
				}
				case t('SETTINGS_THRESH_DONE'): {
					const val = typeof value === 'number' && !isNaN(value) ? value : DEFAULT_SETTINGS.colorThresholdDone;
					this.plugin.settings.colorThresholdDone = val;
					break;
				}
			}
		} else {
			// Fallback: match by unique label if heading is undetermined
			switch (labelText) {
				case t('SETTINGS_CUMULATIVE_SHOW'):
					this.plugin.settings.showCumulativeProgress = value as boolean;
					this.updateGroupVisibility();
					break;
				case t('SETTINGS_CUMULATIVE_MODE'):
					this.plugin.settings.cumulativeMode = value as CumulativeCountMode;
					isRecalculate = true;
					break;
				case t('SETTINGS_SECTION_SHOW'):
					this.plugin.settings.showSectionProgress = value as boolean;
					this.updateGroupVisibility();
					break;
				case t('SETTINGS_TOTAL_SHOW'):
					this.plugin.settings.showTotalProgress = value as boolean;
					this.updateGroupVisibility();
					break;
				case t('SETTINGS_COUNT_TYPE'):
					this.plugin.settings.countType = value as CountType;
					isRecalculate = true;
					break;
				case t('SETTINGS_EXCLUDE_WHITESPACE'):
					this.plugin.settings.excludeWhitespace = value as boolean;
					isRecalculate = true;
					break;
				case t('SETTINGS_EXCLUDE_RUBY'):
					this.plugin.settings.excludeRuby = value as boolean;
					isRecalculate = true;
					break;
				case t('SETTINGS_EXCLUDE_CHARACTERS'):
					this.plugin.settings.excludeCharacters = String(value);
					isRecalculate = true;
					break;
				case t('SETTINGS_BADGE_POS'):
					this.plugin.settings.badgePosition = value as BadgePositionPreset;
					isPositionUpdate = true;
					break;
				case t('SETTINGS_FONT_SIZE'): {
					const val = typeof value === 'number' ? value : parseFloat(String(value));
					if (!isNaN(val)) {
						this.plugin.settings.fontSize = val;
						isPositionUpdate = true;
					}
					break;
				}
				case t('SETTINGS_OFFSET_X'): {
					const val = typeof value === 'number' && !isNaN(value) ? value : DEFAULT_SETTINGS.offsetX;
					this.plugin.settings.offsetX = val;
					isPositionUpdate = true;
					break;
				}
				case t('SETTINGS_OFFSET_Y'): {
					const val = typeof value === 'number' && !isNaN(value) ? value : DEFAULT_SETTINGS.offsetY;
					this.plugin.settings.offsetY = val;
					isPositionUpdate = true;
					break;
				}
				case t('SETTINGS_OPACITY'): {
					const val = typeof value === 'number' ? value : parseFloat(String(value));
					if (!isNaN(val)) {
						this.plugin.settings.badgeOpacity = val;
						isPositionUpdate = true;
					}
					break;
				}
				case t('SETTINGS_THRESH_WARN'): {
					const val = typeof value === 'number' && !isNaN(value) ? value : DEFAULT_SETTINGS.colorThresholdWarn;
					this.plugin.settings.colorThresholdWarn = val;
					break;
				}
				case t('SETTINGS_THRESH_GOOD'): {
					const val = typeof value === 'number' && !isNaN(value) ? value : DEFAULT_SETTINGS.colorThresholdGood;
					this.plugin.settings.colorThresholdGood = val;
					break;
				}
				case t('SETTINGS_THRESH_DONE'): {
					const val = typeof value === 'number' && !isNaN(value) ? value : DEFAULT_SETTINGS.colorThresholdDone;
					this.plugin.settings.colorThresholdDone = val;
					break;
				}
				case t('SETTINGS_LONG_PRESS'):
					this.plugin.settings.longPressToOpenModal = value as boolean;
					break;
			}
		}

		void this.plugin.saveSettings();

		if (isRecalculate) {
			this.plugin.recalculateCounts();
		} else if (isPositionUpdate) {
			this.plugin.updateBadgePosition();
			this.plugin.refreshBadgeUI();
		} else {
			this.plugin.refreshBadgeUI();
		}
	}

	getSettingDefinitions(): Record<string, unknown>[] {
		this.scheduleEnhancements();

		return [
			// General (No heading at top per Obsidian guidelines)
			{
				type: 'group',
				items: [
					{
						name: t('SETTINGS_LONG_PRESS'),
						desc: t('SETTINGS_LONG_PRESS_DESC'),
						control: {
							type: 'toggle',
							key: 'longPressToOpenModal',
							onChange: async (val: boolean) => {
								this.plugin.settings.longPressToOpenModal = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
				],
			},

			// Group 1: Cumulative Progress (Cur)
			{
				type: 'group',
				heading: t('SETTINGS_HEADING_CUMULATIVE'),
				items: [
					{
						name: t('SETTINGS_CUMULATIVE_SHOW'),
						desc: t('SETTINGS_CUMULATIVE_SHOW_DESC'),
						control: {
							type: 'toggle',
							key: 'showCumulativeProgress',
							onChange: async (val: boolean) => {
								this.plugin.settings.showCumulativeProgress = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
								this.updateGroupVisibility();
							},
						},
					},
					{
						name: t('SETTINGS_CUMULATIVE_MODE'),
						desc: t('SETTINGS_CUMULATIVE_MODE_DESC'),
						control: {
							type: 'dropdown',
							key: 'cumulativeMode',
							options: {
								'from-top': t('CUMULATIVE_MODE_TOP'),
								'from-section': t('CUMULATIVE_MODE_SECTION'),
							},
							onChange: async (val: string) => {
								this.plugin.settings.cumulativeMode = val as CumulativeCountMode;
								await this.plugin.saveSettings();
								this.plugin.recalculateCounts();
							},
						},
					},
					{
						name: t('SETTINGS_CUMULATIVE_CURRENT'),
						desc: t('SETTINGS_CUMULATIVE_CURRENT_DESC'),
						control: {
							type: 'toggle',
							key: 'showCumulativeCurrent',
							onChange: async (val: boolean) => {
								this.plugin.settings.showCumulativeCurrent = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
					{
						name: t('SETTINGS_CUMULATIVE_GOAL'),
						desc: t('SETTINGS_CUMULATIVE_GOAL_DESC'),
						control: {
							type: 'toggle',
							key: 'showCumulativeGoal',
							onChange: async (val: boolean) => {
								this.plugin.settings.showCumulativeGoal = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
					{
						name: t('SETTINGS_CUMULATIVE_PERCENT'),
						desc: t('SETTINGS_CUMULATIVE_PERCENT_DESC'),
						control: {
							type: 'toggle',
							key: 'showCumulativePercentage',
							onChange: async (val: boolean) => {
								this.plugin.settings.showCumulativePercentage = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
					{
						name: t('SETTINGS_CUMULATIVE_ICON'),
						desc: t('SETTINGS_CUMULATIVE_ICON_DESC'),
						control: {
							type: 'toggle',
							key: 'showCumulativeIcon',
							onChange: async (val: boolean) => {
								this.plugin.settings.showCumulativeIcon = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
					{
						name: t('SETTINGS_CUMULATIVE_LABEL'),
						desc: t('SETTINGS_CUMULATIVE_LABEL_DESC'),
						control: {
							type: 'text',
							key: 'cumulativeLabel',
							onChange: async (val: string) => {
								this.plugin.settings.cumulativeLabel = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
				],
			},

			// Group 2: Section Progress (Sec)
			{
				type: 'group',
				heading: t('SETTINGS_HEADING_SECTION'),
				items: [
					{
						name: t('SETTINGS_SECTION_SHOW'),
						desc: t('SETTINGS_SECTION_SHOW_DESC'),
						control: {
							type: 'toggle',
							key: 'showSectionProgress',
							onChange: async (val: boolean) => {
								this.plugin.settings.showSectionProgress = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
								this.updateGroupVisibility();
							},
						},
					},
					{
						name: t('SETTINGS_SECTION_CURRENT'),
						desc: t('SETTINGS_SECTION_CURRENT_DESC'),
						control: {
							type: 'toggle',
							key: 'showSectionCurrent',
							onChange: async (val: boolean) => {
								this.plugin.settings.showSectionCurrent = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
					{
						name: t('SETTINGS_SECTION_GOAL'),
						desc: t('SETTINGS_SECTION_GOAL_DESC'),
						control: {
							type: 'toggle',
							key: 'showSectionGoal',
							onChange: async (val: boolean) => {
								this.plugin.settings.showSectionGoal = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
					{
						name: t('SETTINGS_SECTION_PERCENT'),
						desc: t('SETTINGS_SECTION_PERCENT_DESC'),
						control: {
							type: 'toggle',
							key: 'showSectionPercentage',
							onChange: async (val: boolean) => {
								this.plugin.settings.showSectionPercentage = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
					{
						name: t('SETTINGS_SECTION_ICON'),
						desc: t('SETTINGS_SECTION_ICON_DESC'),
						control: {
							type: 'toggle',
							key: 'showSectionIcon',
							onChange: async (val: boolean) => {
								this.plugin.settings.showSectionIcon = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
					{
						name: t('SETTINGS_SECTION_LABEL'),
						desc: t('SETTINGS_SECTION_LABEL_DESC'),
						control: {
							type: 'text',
							key: 'sectionLabel',
							onChange: async (val: string) => {
								this.plugin.settings.sectionLabel = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
					{
						name: t('SETTINGS_HEADING_LEVEL_1'),
						desc: t('SETTINGS_HEADING_LEVEL_1_DESC'),
						control: {
							type: 'toggle',
							key: 'showHeadingLevel1',
							onChange: async (val: boolean) => {
								this.plugin.settings.showHeadingLevel1 = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
					{
						name: t('SETTINGS_HEADING_LEVEL_2'),
						desc: t('SETTINGS_HEADING_LEVEL_2_DESC'),
						control: {
							type: 'toggle',
							key: 'showHeadingLevel2',
							onChange: async (val: boolean) => {
								this.plugin.settings.showHeadingLevel2 = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
					{
						name: t('SETTINGS_HEADING_LEVEL_3'),
						desc: t('SETTINGS_HEADING_LEVEL_3_DESC'),
						control: {
							type: 'toggle',
							key: 'showHeadingLevel3',
							onChange: async (val: boolean) => {
								this.plugin.settings.showHeadingLevel3 = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
					{
						name: t('SETTINGS_HEADING_LEVEL_4'),
						desc: t('SETTINGS_HEADING_LEVEL_4_DESC'),
						control: {
							type: 'toggle',
							key: 'showHeadingLevel4',
							onChange: async (val: boolean) => {
								this.plugin.settings.showHeadingLevel4 = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
					{
						name: t('SETTINGS_HEADING_LEVEL_5'),
						desc: t('SETTINGS_HEADING_LEVEL_5_DESC'),
						control: {
							type: 'toggle',
							key: 'showHeadingLevel5',
							onChange: async (val: boolean) => {
								this.plugin.settings.showHeadingLevel5 = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
					{
						name: t('SETTINGS_HEADING_LEVEL_6'),
						desc: t('SETTINGS_HEADING_LEVEL_6_DESC'),
						control: {
							type: 'toggle',
							key: 'showHeadingLevel6',
							onChange: async (val: boolean) => {
								this.plugin.settings.showHeadingLevel6 = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
				],
			},

			// Group 3: Total Progress (All)
			{
				type: 'group',
				heading: t('SETTINGS_HEADING_TOTAL'),
				items: [
					{
						name: t('SETTINGS_TOTAL_SHOW'),
						desc: t('SETTINGS_TOTAL_SHOW_DESC'),
						control: {
							type: 'toggle',
							key: 'showTotalProgress',
							onChange: async (val: boolean) => {
								this.plugin.settings.showTotalProgress = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
								this.updateGroupVisibility();
							},
						},
					},
					{
						name: t('SETTINGS_TOTAL_CURRENT'),
						desc: t('SETTINGS_TOTAL_CURRENT_DESC'),
						control: {
							type: 'toggle',
							key: 'showTotalCurrent',
							onChange: async (val: boolean) => {
								this.plugin.settings.showTotalCurrent = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
					{
						name: t('SETTINGS_TOTAL_GOAL'),
						desc: t('SETTINGS_TOTAL_GOAL_DESC'),
						control: {
							type: 'toggle',
							key: 'showTotalGoal',
							onChange: async (val: boolean) => {
								this.plugin.settings.showTotalGoal = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
					{
						name: t('SETTINGS_TOTAL_PERCENT'),
						desc: t('SETTINGS_TOTAL_PERCENT_DESC'),
						control: {
							type: 'toggle',
							key: 'showTotalPercentage',
							onChange: async (val: boolean) => {
								this.plugin.settings.showTotalPercentage = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
					{
						name: t('SETTINGS_TOTAL_ICON'),
						desc: t('SETTINGS_TOTAL_ICON_DESC'),
						control: {
							type: 'toggle',
							key: 'showTotalIcon',
							onChange: async (val: boolean) => {
								this.plugin.settings.showTotalIcon = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
					{
						name: t('SETTINGS_TOTAL_LABEL'),
						desc: t('SETTINGS_TOTAL_LABEL_DESC'),
						control: {
							type: 'text',
							key: 'totalLabel',
							onChange: async (val: string) => {
								this.plugin.settings.totalLabel = val;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
				],
			},

			// Group 4: Counting Rules
			{
				type: 'group',
				heading: t('SETTINGS_HEADING_RULES'),
				items: [
					{
						name: t('SETTINGS_COUNT_TYPE'),
						desc: t('SETTINGS_COUNT_TYPE_DESC'),
						control: {
							type: 'dropdown',
							key: 'countType',
							options: {
								character: t('COUNT_TYPE_CHARACTER'),
								word: t('COUNT_TYPE_WORD'),
							},
							onChange: async (val: string) => {
								this.plugin.settings.countType = val as CountType;
								await this.plugin.saveSettings();
								this.plugin.recalculateCounts();
							},
						},
					},
					{
						name: t('SETTINGS_EXCLUDE_WHITESPACE'),
						desc: t('SETTINGS_EXCLUDE_WHITESPACE_DESC'),
						control: {
							type: 'toggle',
							key: 'excludeWhitespace',
							onChange: async (val: boolean) => {
								this.plugin.settings.excludeWhitespace = val;
								await this.plugin.saveSettings();
								this.plugin.recalculateCounts();
							},
						},
					},
					{
						name: t('SETTINGS_EXCLUDE_RUBY'),
						desc: t('SETTINGS_EXCLUDE_RUBY_DESC'),
						control: {
							type: 'toggle',
							key: 'excludeRuby',
							onChange: async (val: boolean) => {
								this.plugin.settings.excludeRuby = val;
								await this.plugin.saveSettings();
								this.plugin.recalculateCounts();
							},
						},
					},
					{
						name: t('SETTINGS_EXCLUDE_CHARACTERS'),
						desc: t('SETTINGS_EXCLUDE_CHARACTERS_DESC'),
						control: {
							type: 'text',
							key: 'excludeCharacters',
							onChange: async (val: string) => {
								this.plugin.settings.excludeCharacters = val;
								await this.plugin.saveSettings();
								this.plugin.recalculateCounts();
							},
						},
					},
				],
			},

			// Group 5: Appearance & Position
			{
				type: 'group',
				heading: t('SETTINGS_HEADING_APPEARANCE'),
				items: [
					{
						name: t('SETTINGS_BADGE_POS'),
						desc: t('SETTINGS_BADGE_POS_DESC'),
						control: {
							type: 'dropdown',
							key: 'badgePosition',
							options: {
								'bottom-right': t('POS_BOTTOM_RIGHT'),
								'bottom-left': t('POS_BOTTOM_LEFT'),
								'top-right': t('POS_TOP_RIGHT'),
								'top-left': t('POS_TOP_LEFT'),
							},
							onChange: async (val: string) => {
								this.plugin.settings.badgePosition = val as BadgePositionPreset;
								await this.plugin.saveSettings();
								this.plugin.updateBadgePosition();
							},
						},
					},
					{
						name: t('SETTINGS_FONT_SIZE'),
						desc: t('SETTINGS_FONT_SIZE_DESC'),
						control: {
							type: 'slider',
							key: 'fontSize',
							min: 9,
							max: 20,
							step: 1,
							onChange: async (val: number) => {
								this.plugin.settings.fontSize = val;
								await this.plugin.saveSettings();
								this.plugin.updateBadgePosition();
							},
						},
					},
					{
						name: t('SETTINGS_OFFSET_X'),
						desc: t('SETTINGS_OFFSET_X_DESC'),
						control: {
							type: 'number',
							key: 'offsetX',
							placeholder: String(DEFAULT_SETTINGS.offsetX),
							onChange: async (val: number) => {
								this.plugin.settings.offsetX = !isNaN(val) ? val : DEFAULT_SETTINGS.offsetX;
								await this.plugin.saveSettings();
								this.plugin.updateBadgePosition();
							},
						},
					},
					{
						name: t('SETTINGS_OFFSET_Y'),
						desc: t('SETTINGS_OFFSET_Y_DESC'),
						control: {
							type: 'number',
							key: 'offsetY',
							placeholder: String(DEFAULT_SETTINGS.offsetY),
							onChange: async (val: number) => {
								this.plugin.settings.offsetY = !isNaN(val) ? val : DEFAULT_SETTINGS.offsetY;
								await this.plugin.saveSettings();
								this.plugin.updateBadgePosition();
							},
						},
					},
					{
						name: t('SETTINGS_OPACITY'),
						desc: t('SETTINGS_OPACITY_DESC'),
						control: {
							type: 'slider',
							key: 'badgeOpacity',
							min: 0.1,
							max: 1.0,
							step: 0.05,
							onChange: async (val: number) => {
								this.plugin.settings.badgeOpacity = val;
								await this.plugin.saveSettings();
								this.plugin.updateBadgePosition();
							},
						},
					},
				],
			},

			// Group 6: Progress Thresholds
			{
				type: 'group',
				heading: t('SETTINGS_HEADING_THRESHOLDS'),
				items: [
					{
						name: t('SETTINGS_THRESH_WARN'),
						desc: t('SETTINGS_THRESH_WARN_DESC'),
						control: {
							type: 'number',
							key: 'colorThresholdWarn',
							placeholder: String(DEFAULT_SETTINGS.colorThresholdWarn),
							onChange: async (val: number) => {
								this.plugin.settings.colorThresholdWarn =
									!isNaN(val) ? val : DEFAULT_SETTINGS.colorThresholdWarn;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
					{
						name: t('SETTINGS_THRESH_GOOD'),
						desc: t('SETTINGS_THRESH_GOOD_DESC'),
						control: {
							type: 'number',
							key: 'colorThresholdGood',
							placeholder: String(DEFAULT_SETTINGS.colorThresholdGood),
							onChange: async (val: number) => {
								this.plugin.settings.colorThresholdGood =
									!isNaN(val) ? val : DEFAULT_SETTINGS.colorThresholdGood;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
					{
						name: t('SETTINGS_THRESH_DONE'),
						desc: t('SETTINGS_THRESH_DONE_DESC'),
						control: {
							type: 'number',
							key: 'colorThresholdDone',
							placeholder: String(DEFAULT_SETTINGS.colorThresholdDone),
							onChange: async (val: number) => {
								this.plugin.settings.colorThresholdDone =
									!isNaN(val) ? val : DEFAULT_SETTINGS.colorThresholdDone;
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
							},
						},
					},
				],
			},

			// Group 7: Support
			{
				type: 'group',
				heading: t('SETTINGS_HEADING_SUPPORT'),
				items: [
					{
						name: t('SETTINGS_DONATE'),
						desc: t('SETTINGS_DONATE_DESC'),
						render: (setting: Setting) =>
							setting.addButton((button) =>
								button
									.setButtonText(t('SETTINGS_DONATE_BUTTON'))
									.setCta()
									.onClick(() => {
										const fundingUrl =
											(this.plugin.manifest as { fundingUrl?: string }).fundingUrl ||
											'https://buymeacoffee.com/quels';
										window.open(fundingUrl, '_blank');
									}),
							),
					},
				],
			},
		];
	}
}
