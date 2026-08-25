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
					item.style.setProperty('display', enabled ? '' : 'none', 'important');
				}
			}
		});
	}

	private applyEnhancements(root: HTMLElement): void {
		const iconMap: Record<string, string> = {
			[t('SETTINGS_HEADING_CUMULATIVE')]: 'text-cursor',
			[t('SETTINGS_HEADING_SECTION')]: 'hash',
			[t('SETTINGS_HEADING_TOTAL')]: 'book-text',
			[t('SETTINGS_HEADING_RULES')]: 'calculator',
			[t('SETTINGS_HEADING_APPEARANCE')]: 'layout',
			[t('SETTINGS_HEADING_THRESHOLDS')]: 'gauge',
			[t('SETTINGS_HEADING_INTERACTIONS')]: 'mouse-pointer',
			[t('SETTINGS_HEADING_SUPPORT')]: 'heart',
		};

		const swatchMap: Record<string, string> = {
			[t('SETTINGS_THRESH_WARN')]: 'swg-color-preview-warn',
			[t('SETTINGS_THRESH_GOOD')]: 'swg-color-preview-good',
			[t('SETTINGS_THRESH_DONE')]: 'swg-color-preview-done',
		};

		// 1. Inject Heading Icons
		const headingEls = root.querySelectorAll<HTMLElement>(
			'.setting-group-heading, .setting-item-heading, h2, h3, h4',
		);
		headingEls.forEach((el) => {
			if (el.querySelector('.swg-heading-icon')) return;
			const text = el.textContent?.trim();
			if (text && iconMap[text]) {
				const iconName = iconMap[text];
				el.empty();
				el.addClass('swg-setting-heading');
				const iconSpan = el.createSpan({ cls: 'swg-heading-icon' });
				setIcon(iconSpan, iconName);
				el.createSpan({ text });
			}
		});

		// 2. Inject Color Swatches
		const nameEls = root.querySelectorAll<HTMLElement>('.setting-item-name');
		nameEls.forEach((el) => {
			if (el.querySelector('.swg-color-preview-circle')) return;
			const text = el.textContent?.trim();
			if (text && swatchMap[text]) {
				const swatchClass = swatchMap[text];
				const circle = createSpan({ cls: `swg-color-preview-circle ${swatchClass}` });
				el.prepend(circle);
			}
		});

		// 3. Bind direct event listeners to controls if needed for immediate reactivity
		const allItems = Array.from(root.querySelectorAll<HTMLElement>('.setting-item'));
		allItems.forEach((itemEl) => {
			const nameText = itemEl.querySelector('.setting-item-name')?.textContent?.trim();
			if (!nameText) return;

			// Toggle checkboxes
			const toggleEl = itemEl.querySelector<HTMLElement>('.checkbox-container');
			if (toggleEl && !toggleEl.dataset.swgBound) {
				toggleEl.dataset.swgBound = 'true';
				toggleEl.addEventListener('click', () => {
					window.setTimeout(() => {
						const isEnabled = toggleEl.classList.contains('is-enabled');
						this.syncSettingValue(nameText, isEnabled);
					}, 20);
				});
			}

			// Select dropdowns
			const selectEl = itemEl.querySelector<HTMLSelectElement>('select.dropdown');
			if (selectEl && !selectEl.dataset.swgBound) {
				selectEl.dataset.swgBound = 'true';
				selectEl.addEventListener('change', () => {
					this.syncSettingValue(nameText, selectEl.value);
				});
			}

			// Text / Number inputs
			const inputEl = itemEl.querySelector<HTMLInputElement>('input:not([type="checkbox"])');
			if (inputEl && !inputEl.dataset.swgBound) {
				inputEl.dataset.swgBound = 'true';
				inputEl.addEventListener('input', () => {
					const val = inputEl.type === 'number' ? parseFloat(inputEl.value) : inputEl.value;
					this.syncSettingValue(nameText, val);
				});
			}

			// Sliders
			const sliderEl = itemEl.querySelector<HTMLInputElement>('input.slider');
			if (sliderEl && !sliderEl.dataset.swgBound) {
				sliderEl.dataset.swgBound = 'true';
				sliderEl.addEventListener('input', () => {
					this.syncSettingValue(nameText, parseFloat(sliderEl.value));
				});
			}
		});

		// 4. Update Child Visibility
		this.updateGroupVisibility(root);
	}

	private syncSettingValue(labelText: string, value: string | number | boolean): void {
		let isPositionUpdate = false;
		let isRecalculate = false;

		switch (labelText) {
			// Cumulative
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

			// Section
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

			// Total
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

			// Counting rules
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

			// Appearance
			case t('SETTINGS_BADGE_POS'):
				this.plugin.settings.badgePosition = value as BadgePositionPreset;
				isPositionUpdate = true;
				break;
			case t('SETTINGS_FONT_SIZE'):
				if (typeof value === 'number' && !isNaN(value)) {
					this.plugin.settings.fontSize = value;
					isPositionUpdate = true;
				}
				break;
			case t('SETTINGS_OFFSET_X'):
				if (typeof value === 'number' && !isNaN(value)) {
					this.plugin.settings.offsetX = value;
					isPositionUpdate = true;
				}
				break;
			case t('SETTINGS_OFFSET_Y'):
				if (typeof value === 'number' && !isNaN(value)) {
					this.plugin.settings.offsetY = value;
					isPositionUpdate = true;
				}
				break;
			case t('SETTINGS_OPACITY'):
				if (typeof value === 'number' && !isNaN(value)) {
					this.plugin.settings.badgeOpacity = value;
					isPositionUpdate = true;
				}
				break;

			// Thresholds
			case t('SETTINGS_THRESH_WARN'):
				if (typeof value === 'number' && !isNaN(value)) {
					this.plugin.settings.colorThresholdWarn = value;
				}
				break;
			case t('SETTINGS_THRESH_GOOD'):
				if (typeof value === 'number' && !isNaN(value)) {
					this.plugin.settings.colorThresholdGood = value;
				}
				break;
			case t('SETTINGS_THRESH_DONE'):
				if (typeof value === 'number' && !isNaN(value)) {
					this.plugin.settings.colorThresholdDone = value;
				}
				break;

			// Interactions
			case t('SETTINGS_LONG_PRESS'):
				this.plugin.settings.longPressToOpenModal = value as boolean;
				break;
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
							onChange: async (val: number) => {
								if (!isNaN(val)) {
									this.plugin.settings.offsetX = val;
									await this.plugin.saveSettings();
									this.plugin.updateBadgePosition();
								}
							},
						},
					},
					{
						name: t('SETTINGS_OFFSET_Y'),
						desc: t('SETTINGS_OFFSET_Y_DESC'),
						control: {
							type: 'number',
							key: 'offsetY',
							onChange: async (val: number) => {
								if (!isNaN(val)) {
									this.plugin.settings.offsetY = val;
									await this.plugin.saveSettings();
									this.plugin.updateBadgePosition();
								}
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
							onChange: async (val: number) => {
								if (!isNaN(val)) {
									this.plugin.settings.colorThresholdWarn = val;
									await this.plugin.saveSettings();
									this.plugin.refreshBadgeUI();
								}
							},
						},
					},
					{
						name: t('SETTINGS_THRESH_GOOD'),
						desc: t('SETTINGS_THRESH_GOOD_DESC'),
						control: {
							type: 'number',
							key: 'colorThresholdGood',
							onChange: async (val: number) => {
								if (!isNaN(val)) {
									this.plugin.settings.colorThresholdGood = val;
									await this.plugin.saveSettings();
									this.plugin.refreshBadgeUI();
								}
							},
						},
					},
					{
						name: t('SETTINGS_THRESH_DONE'),
						desc: t('SETTINGS_THRESH_DONE_DESC'),
						control: {
							type: 'number',
							key: 'colorThresholdDone',
							onChange: async (val: number) => {
								if (!isNaN(val)) {
									this.plugin.settings.colorThresholdDone = val;
									await this.plugin.saveSettings();
									this.plugin.refreshBadgeUI();
								}
							},
						},
					},
				],
			},

			// Group 7: Interactions
			{
				type: 'group',
				heading: t('SETTINGS_HEADING_INTERACTIONS'),
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

			// Group 8: Support
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
