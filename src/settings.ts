import { App, DropdownComponent, Notice, PluginSettingTab, setIcon, setTooltip, Setting, TextComponent } from 'obsidian';

import { ConfirmModal } from './ui/confirm-modal';
import { t } from './lang/helpers';
import type SectionGoalsBadgePlugin from './main';
import {
	BadgePositionPreset,
	CountType,
	CumulativeCountMode,
	DateCycle,
	DateReferenceMode,
	GoalColorStyle,
	PluginSettings,
} from './types';

import { interpolateGoalColors } from './utils/color';
import {
	DEFAULT_FONT_SIZE_PX,
	DEFAULT_THRESHOLD_DONE,
	DEFAULT_THRESHOLD_GOOD,
	DEFAULT_THRESHOLD_WARN,
	MAX_COLOR_STYLES,
	PRESET_STYLE_LIMIT_ID,
	PRESET_STYLE_TARGET_ID,
} from './utils/constants';
import { setCssProps } from './utils/dom';
import { FolderSuggest } from './utils/folder-suggest';
import { formatCycle, normalizeTimeInput, parseCycle } from './utils/date-goal';

export interface SettingItemDefinition {
	name?: string;
	desc?: string;
	render: (setting: Setting) => void;
}

export interface SettingGroupDefinition {
	type: 'group';
	heading?: string;
	items: SettingItemDefinition[];
}

export function getDefaultStyles(): GoalColorStyle[] {
	return [
		{
			id: PRESET_STYLE_LIMIT_ID,
			name: t('PRESET_STYLE_LIMIT'),
			type: 'discrete',
			colorDefault: '#ababab',
			colorWarn: '#fafa48',
			colorGood: '#ffa600',
			colorDone: '#ff4d4f',
			isPreset: true,
		},
		{
			id: PRESET_STYLE_TARGET_ID,
			name: t('PRESET_STYLE_TARGET'),
			type: 'discrete',
			colorDefault: '#ababab',
			colorWarn: '#f09533',
			colorGood: '#24b750',
			colorDone: '#207dff',
			isPreset: true,
		},
	];
}

export const DEFAULT_SETTINGS: PluginSettings = {
	// Date options
	showDateProgress: true,
	showDateWhenUnset: false,
	showDateProgressBar: true,
	showDateIcon: true,
	dateLabel: t('BADGE_DATE_LABEL'),
	dateOverdueLabel: '+',
	dateUnitDays: t('BADGE_DAYS_UNIT'),
	dateUnitHours: t('BADGE_HOURS_UNIT'),
	dateThresholdWarn: 50,
	dateThresholdUrgent: 75,
	dateThresholdOverdue: 100,
	dateColorNormal: '#ababab',
	dateColorWarn: '#fafa48',
	dateColorUrgent: '#ffa600',
	dateColorOverdue: '#ff4d4f',
	showDateHoursAlways: false,
	defaultStartTime: '00:00',
	defaultTargetTime: '23:59',
	defaultDateReference: 'parent',
	defaultDateCycle: '',
	datePositionMode: 'left',
	dateBadgePosition: 'top-left',
	dateOffsetX: 20,
	dateOffsetY: 40,
	dateFontSize: DEFAULT_FONT_SIZE_PX,
	dateBadgeOpacity: 0.9,

	// Section options
	showSectionProgress: true,
	showSectionCurrent: true,
	showSectionPercentage: true,
	showSectionGoal: true,
	showSectionProgressBar: false,
	showSectionOverflowBar: false,
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
	showCumulativeProgressBar: false,
	showCumulativeOverflowBar: false,
	showCumulativeIcon: true,
	cumulativeLabel: '',
	cumulativeMode: 'from-section',

	// Total options
	showTotalProgress: true,
	showTotalCurrent: true,
	showTotalPercentage: true,
	showTotalGoal: true,
	showTotalProgressBar: false,
	showTotalOverflowBar: false,
	showTotalIcon: true,
	totalLabel: '',

	// Badge Appearance
	badgePosition: 'top-right',
	offsetX: 20,
	offsetY: 40,
	badgeOpacity: 0.9,
	fontSize: DEFAULT_FONT_SIZE_PX,

	// Color Thresholds & Styles
	colorThresholdWarn: DEFAULT_THRESHOLD_WARN,
	colorThresholdGood: DEFAULT_THRESHOLD_GOOD,
	colorThresholdDone: DEFAULT_THRESHOLD_DONE,
	styles: getDefaultStyles(),
	defaultStyleId: PRESET_STYLE_LIMIT_ID,

	// Folder Goals
	folderGoals: [],

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
	private isHeadingLevelsAccordionOpen = false;
	private expandedFolderCardIds: Set<string> = new Set();
	private expandedFolderHeadingIds: Set<string> = new Set();
	private expandedSectionIds: Set<string> = new Set();

	constructor(app: App, plugin: SectionGoalsBadgePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		this.expandedSectionIds.clear();
		this.plugin.hideBadge?.();
		const tabRoot = this.containerEl.closest('.vertical-tab-content');
		if (tabRoot) {
			tabRoot.addClass('sgb-settings-root');
		}
		this.renderSettings(this.containerEl);
	}

	hide(): void {
		const tabRoot = this.containerEl.closest('.vertical-tab-content');
		if (tabRoot) {
			tabRoot.removeClass('sgb-settings-root');
		}
		// When settings tab is closed on mobile/desktop, immediately refresh badge with saved settings
		this.plugin.showBadge?.();
		this.plugin.refreshBadgeUI();
		this.plugin.recalculateCounts();
	}

	public expandAndScrollToSection(headingText: string): void {
		this.expandedSectionIds.add(headingText);
		this.renderSettings(this.containerEl);

		window.requestAnimationFrame(() => {
			const sectionEl = this.containerEl.querySelector<HTMLElement>(
				`[data-section-key="${headingText}"]`,
			);
			if (sectionEl) {
				sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		});
	}

	public destroy(): void {
		// Cleanup if needed
	}

	private getTabRoot(targetEl?: HTMLElement): HTMLElement {
		const selector =
			'.modal, .modal-content, .modal-container, .vertical-tab-content, .vertical-tab-content-container, .mobile-settings-tab, .mobile-settings-pane, .mobile-options';
		if (targetEl) {
			const root = targetEl.closest(selector);
			if (root) return root as HTMLElement;
			if (targetEl.parentElement) return targetEl.parentElement;
		}
		const containerRoot = this.containerEl.closest(selector);
		if (containerRoot) return containerRoot as HTMLElement;
		return this.containerEl;
	}

	public applyHeadingIcons(targetEl?: HTMLElement): void {
		const root = this.getTabRoot(targetEl);
		const iconMap: Record<string, string> = {
			[t('SETTINGS_HEADING_DATE')]: 'calendar',
			[t('SETTINGS_HEADING_CUMULATIVE')]: 'text-cursor',
			[t('SETTINGS_HEADING_SECTION')]: 'hash',
			[t('SETTINGS_HEADING_TOTAL')]: 'book-text',
			[t('SETTINGS_HEADING_RULES')]: 'calculator',
			[t('SETTINGS_HEADING_APPEARANCE')]: 'layout',
			[t('SETTINGS_HEADING_THRESHOLDS')]: 'gauge',
			[t('SETTINGS_HEADING_STYLES')]: 'palette',
			[t('SETTINGS_HEADING_FOLDER_GOALS')]: 'folder',
			[t('SETTINGS_HEADING_SUPPORT')]: 'heart',
		};

		const headingEls = Array.from(
			root.querySelectorAll<HTMLElement>(
				'.setting-group-heading, .setting-item-heading, .setting-item.setting-item-heading, h2, h3, h4',
			),
		);

		headingEls.forEach((el) => {
			if (el.querySelector('.sgb-heading-icon')) return;
			const text = (el.querySelector('.setting-item-name')?.textContent || el.textContent || '').trim();
			for (const [headingTitle, iconName] of Object.entries(iconMap)) {
				if (text === headingTitle || text.startsWith(headingTitle) || text.includes(headingTitle)) {
					const nameEl = el.querySelector<HTMLElement>('.setting-item-name') || el;
					if (!nameEl.querySelector('.sgb-heading-icon')) {
						nameEl.addClass('sgb-setting-heading');
						const iconSpan = createSpan({ cls: 'sgb-heading-icon' });
						setIcon(iconSpan, iconName);
						nameEl.prepend(iconSpan);
					}
					break;
				}
			}
		});
	}

	private attachHeadingIcon(setting: Setting, _iconName: string): void {
		window.requestAnimationFrame(() => {
			this.applyHeadingIcons(setting.settingEl);
			this.updateGroupVisibility(setting.settingEl);
		});
	}

	public updateSettingSwatches(targetEl?: HTMLElement): void {
		const root = this.getTabRoot(targetEl);
		const defaultStyle =
			this.plugin.settings.styles.find((s) => s.id === this.plugin.settings.defaultStyleId) ??
			this.plugin.settings.styles[0] ??
			getDefaultStyles()[0]!;

		const isGradient = defaultStyle.type === 'gradient';
		const warnColor = isGradient
			? interpolateGoalColors(defaultStyle.colorDefault, defaultStyle.colorDone).colorWarn
			: defaultStyle.colorWarn;
		const goodColor = isGradient
			? interpolateGoalColors(defaultStyle.colorDefault, defaultStyle.colorDone).colorGood
			: defaultStyle.colorGood;

		setCssProps(root, {
			'--sgb-color-default': defaultStyle.colorDefault,
			'--sgb-color-warn': warnColor,
			'--sgb-color-good': goodColor,
			'--sgb-color-done': defaultStyle.colorDone,
		});

		root.querySelectorAll<HTMLElement>('.sgb-color-preview-warn').forEach((el) => {
			el.style.backgroundColor = warnColor;
		});
		root.querySelectorAll<HTMLElement>('.sgb-color-preview-good').forEach((el) => {
			el.style.backgroundColor = goodColor;
		});
		root.querySelectorAll<HTMLElement>('.sgb-color-preview-done').forEach((el) => {
			el.style.backgroundColor = defaultStyle.colorDone;
		});
		root.querySelectorAll<HTMLElement>('.sgb-color-preview-default').forEach((el) => {
			el.style.backgroundColor = defaultStyle.colorDefault;
		});

		root.querySelectorAll<HTMLElement>('.sgb-date-swatch-warn').forEach((el) => {
			el.style.backgroundColor = this.plugin.settings.dateColorWarn || DEFAULT_SETTINGS.dateColorWarn;
		});
		root.querySelectorAll<HTMLElement>('.sgb-date-swatch-urgent').forEach((el) => {
			el.style.backgroundColor = this.plugin.settings.dateColorUrgent || DEFAULT_SETTINGS.dateColorUrgent;
		});
		root.querySelectorAll<HTMLElement>('.sgb-date-swatch-overdue').forEach((el) => {
			el.style.backgroundColor = this.plugin.settings.dateColorOverdue || DEFAULT_SETTINGS.dateColorOverdue;
		});
	}

	public updateGroupVisibility(targetEl?: HTMLElement): void {
		const root = this.getTabRoot(targetEl);
		const showDate = this.plugin.settings.showDateProgress;
		const showCumulative = this.plugin.settings.showCumulativeProgress;
		const showSection = this.plugin.settings.showSectionProgress;
		const showTotal = this.plugin.settings.showTotalProgress;

		// Date sub-items
		root.querySelectorAll<HTMLElement>('.sgb-group-date').forEach((el) => {
			el.classList.toggle('sgb-is-hidden', !showDate);
			el.style.setProperty('display', showDate ? '' : 'none', 'important');
		});

		// Date independent position sub-items (custom mode)
		const showDateCustom = showDate && this.plugin.settings.datePositionMode === 'custom';
		root.querySelectorAll<HTMLElement>('.sgb-group-date-custom').forEach((el) => {
			el.classList.toggle('sgb-is-hidden', !showDateCustom);
			el.style.setProperty('display', showDateCustom ? '' : 'none', 'important');
		});


		// Cumulative sub-items
		root.querySelectorAll<HTMLElement>('.sgb-group-cumulative').forEach((el) => {
			el.classList.toggle('sgb-is-hidden', !showCumulative);
			el.style.setProperty('display', showCumulative ? '' : 'none', 'important');
		});

		// Cumulative overflow sub-item
		const showCumulativeOverflow = showCumulative && this.plugin.settings.showCumulativeProgressBar;
		root.querySelectorAll<HTMLElement>('.sgb-group-cumulative-overflow').forEach((el) => {
			el.classList.toggle('sgb-is-hidden', !showCumulativeOverflow);
			el.style.setProperty('display', showCumulativeOverflow ? '' : 'none', 'important');
		});

		// Section sub-items
		root.querySelectorAll<HTMLElement>('.sgb-group-section').forEach((el) => {
			el.classList.toggle('sgb-is-hidden', !showSection);
			el.style.setProperty('display', showSection ? '' : 'none', 'important');
		});

		// Section overflow sub-item
		const showSectionOverflow = showSection && this.plugin.settings.showSectionProgressBar;
		root.querySelectorAll<HTMLElement>('.sgb-group-section-overflow').forEach((el) => {
			el.classList.toggle('sgb-is-hidden', !showSectionOverflow);
			el.style.setProperty('display', showSectionOverflow ? '' : 'none', 'important');
		});

		// Accordion row
		const accordionRow = root.querySelector<HTMLElement>('.sgb-settings-accordion-item');
		if (accordionRow) {
			accordionRow.classList.toggle('sgb-is-hidden', !showSection);
			accordionRow.style.setProperty('display', showSection ? '' : 'none', 'important');
			const chevron = accordionRow.querySelector<HTMLElement>('.sgb-settings-accordion-chevron');
			if (chevron) {
				setIcon(chevron, this.isHeadingLevelsAccordionOpen ? 'chevron-down' : 'chevron-right');
			}
		}

		// Heading levels H1..H6
		const showLevels = showSection && this.isHeadingLevelsAccordionOpen;
		root.querySelectorAll<HTMLElement>('.sgb-group-heading-level').forEach((el) => {
			el.classList.toggle('sgb-is-hidden', !showLevels);
			el.style.setProperty('display', showLevels ? '' : 'none', 'important');
		});

		// Total sub-items
		root.querySelectorAll<HTMLElement>('.sgb-group-total').forEach((el) => {
			el.classList.toggle('sgb-is-hidden', !showTotal);
			el.style.setProperty('display', showTotal ? '' : 'none', 'important');
		});

		// Total overflow sub-item
		const showTotalOverflow = showTotal && this.plugin.settings.showTotalProgressBar;
		root.querySelectorAll<HTMLElement>('.sgb-group-total-overflow').forEach((el) => {
			el.classList.toggle('sgb-is-hidden', !showTotalOverflow);
			el.style.setProperty('display', showTotalOverflow ? '' : 'none', 'important');
		});
	}

	private renderSettings(containerEl: HTMLElement): void {
		containerEl.empty();
		containerEl.addClass('sgb-settings-container');
		const definitions = this.buildSettingDefinitions();

		const iconMap: Record<string, string> = {
			[t('SETTINGS_HEADING_DATE')]: 'calendar',
			[t('SETTINGS_HEADING_CUMULATIVE')]: 'text-cursor',
			[t('SETTINGS_HEADING_SECTION')]: 'hash',
			[t('SETTINGS_HEADING_TOTAL')]: 'book-text',
			[t('SETTINGS_HEADING_RULES')]: 'calculator',
			[t('SETTINGS_HEADING_APPEARANCE')]: 'layout',
			[t('SETTINGS_HEADING_THRESHOLDS')]: 'gauge',
			[t('SETTINGS_HEADING_STYLES')]: 'palette',
			[t('SETTINGS_HEADING_FOLDER_GOALS')]: 'folder',
			[t('SETTINGS_HEADING_SUPPORT')]: 'heart',
		};

		for (const def of definitions) {
			if (def.type === 'group') {
				const group = def;
				if (!group.heading) {
					for (const item of group.items) {
						const setting = new Setting(containerEl);
						setting.settingEl.addClass('sgb-settings-item');
						item.render(setting);
					}
					continue;
				}

				const sectionKey = group.heading;
				const isExpanded = this.expandedSectionIds.has(sectionKey);

				const sectionEl = containerEl.createDiv({
					cls: `sgb-settings-section ${isExpanded ? 'is-expanded' : 'is-collapsed'}`,
				});
				sectionEl.setAttribute('data-section-key', sectionKey);

				const headerSetting = new Setting(sectionEl);
				headerSetting.setName(group.heading).setHeading();
				headerSetting.settingEl.addClass('sgb-settings-section-header');

				const nameEl = headerSetting.nameEl;
				nameEl.addClass('sgb-setting-heading');

				const chevronSpan = createSpan({ cls: 'sgb-settings-section-chevron' });
				setIcon(chevronSpan, isExpanded ? 'chevron-down' : 'chevron-right');

				const iconName = iconMap[group.heading];
				if (iconName) {
					const iconSpan = createSpan({ cls: 'sgb-heading-icon' });
					setIcon(iconSpan, iconName);
					nameEl.prepend(iconSpan);
				}
				nameEl.prepend(chevronSpan);

				const bodyEl = sectionEl.createDiv({
					cls: `sgb-settings-section-body${isExpanded ? '' : ' sgb-is-hidden'}`,
				});
				bodyEl.hidden = !isExpanded;

				headerSetting.settingEl.addEventListener('click', (e) => {
					if ((e.target as HTMLElement).closest('button, input, select')) return;
					const currentlyExpanded = this.expandedSectionIds.has(sectionKey);
					if (currentlyExpanded) {
						this.expandedSectionIds.delete(sectionKey);
						sectionEl.removeClass('is-expanded');
						sectionEl.addClass('is-collapsed');
						bodyEl.addClass('sgb-is-hidden');
						bodyEl.hidden = true;
						setIcon(chevronSpan, 'chevron-right');
					} else {
						this.expandedSectionIds.add(sectionKey);
						sectionEl.removeClass('is-collapsed');
						sectionEl.addClass('is-expanded');
						bodyEl.removeClass('sgb-is-hidden');
						bodyEl.hidden = false;
						setIcon(chevronSpan, 'chevron-down');
						this.updateGroupVisibility(sectionEl);
						this.updateSettingSwatches(sectionEl);
					}
				});

				for (const item of group.items) {
					const setting = new Setting(bodyEl);
					setting.settingEl.addClass('sgb-settings-item');
					item.render(setting);
				}
			}
		}

		this.updateGroupVisibility(containerEl);
		this.updateSettingSwatches(containerEl);
	}

	/**
	 * Returning an empty array signals Obsidian 1.13+ to fall back to the custom
	 * imperative display() rendering, preserving the collapsible accordion sections
	 * while satisfying the declarative settings interface and linter.
	 */
	getSettingDefinitions(): SettingGroupDefinition[] {
		return [];
	}

	buildSettingDefinitions(): SettingGroupDefinition[] {
		return [
			// General (No heading at top per Obsidian guidelines)
			{
				type: 'group',
				items: [
					{
						name: t('SETTINGS_LONG_PRESS'),
						desc: t('SETTINGS_LONG_PRESS_DESC'),
						render: (setting: Setting) => {
							setting
								.setName(t('SETTINGS_LONG_PRESS'))
								.setDesc(t('SETTINGS_LONG_PRESS_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.longPressToOpenModal).onChange(async (val) => {
										this.plugin.settings.longPressToOpenModal = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
				],
			},

			// Group: Appearance & Position (Top)
			{
				type: 'group',
				heading: t('SETTINGS_HEADING_APPEARANCE'),
				items: [
					{
						name: t('SETTINGS_BADGE_POS'),
						desc: t('SETTINGS_BADGE_POS_DESC'),
						render: (setting: Setting) => {
							this.attachHeadingIcon(setting, 'layout');
							setting
								.setName(t('SETTINGS_BADGE_POS'))
								.setDesc(t('SETTINGS_BADGE_POS_DESC'))
								.addDropdown((dropdown) =>
									dropdown
										.addOptions({
											'bottom-right': t('POS_BOTTOM_RIGHT'),
											'bottom-left': t('POS_BOTTOM_LEFT'),
											'top-right': t('POS_TOP_RIGHT'),
											'top-left': t('POS_TOP_LEFT'),
										})
										.setValue(this.plugin.settings.badgePosition)
										.onChange(async (val) => {
											this.plugin.settings.badgePosition = val as BadgePositionPreset;
											await this.plugin.saveSettings();
											this.plugin.updateBadgePosition();
										}),
								);
						},
					},
					{
						name: t('SETTINGS_FONT_SIZE'),
						desc: t('SETTINGS_FONT_SIZE_DESC'),
						render: (setting: Setting) => {
							setting
								.setName(t('SETTINGS_FONT_SIZE'))
								.setDesc(t('SETTINGS_FONT_SIZE_DESC'))
								.addSlider((slider) =>
									slider
										.setLimits(8, 64, 1)
										.setValue(this.plugin.settings.fontSize)
										.setDynamicTooltip()
										.onChange(async (val) => {
											this.plugin.settings.fontSize = val;
											await this.plugin.saveSettings();
											this.plugin.updateBadgePosition();
										}),
								)
								.addExtraButton((btn) =>
									btn
										.setIcon('rotate-ccw')
										.setTooltip(t('SETTINGS_RESET_DEFAULT'))
										.onClick(async () => {
											this.plugin.settings.fontSize = DEFAULT_SETTINGS.fontSize;
											await this.plugin.saveSettings();
											this.plugin.updateBadgePosition();
											const sliderInput = setting.controlEl.querySelector<HTMLInputElement>(
												'input.slider, input[type="range"]',
											);
											if (sliderInput) {
												sliderInput.value = String(DEFAULT_SETTINGS.fontSize);
												sliderInput.dispatchEvent(new Event('input', { bubbles: true }));
											}
										}),
								);
						},
					},
					{
						name: t('SETTINGS_OFFSET_X'),
						desc: t('SETTINGS_OFFSET_X_DESC'),
						render: (setting: Setting) => {
							setting
								.setName(t('SETTINGS_OFFSET_X'))
								.setDesc(t('SETTINGS_OFFSET_X_DESC'))
								.addText((text) => {
									text.inputEl.type = 'number';
									text.setPlaceholder(String(DEFAULT_SETTINGS.offsetX));
									text.setValue(String(this.plugin.settings.offsetX));
									text.onChange(async (newVal) => {
										const num = parseFloat(newVal);
										this.plugin.settings.offsetX = !isNaN(num) ? num : DEFAULT_SETTINGS.offsetX;
										await this.plugin.saveSettings();
										this.plugin.updateBadgePosition();
									});
								});
						},
					},
					{
						name: t('SETTINGS_OFFSET_Y'),
						desc: t('SETTINGS_OFFSET_Y_DESC'),
						render: (setting: Setting) => {
							setting
								.setName(t('SETTINGS_OFFSET_Y'))
								.setDesc(t('SETTINGS_OFFSET_Y_DESC'))
								.addText((text) => {
									text.inputEl.type = 'number';
									text.setPlaceholder(String(DEFAULT_SETTINGS.offsetY));
									text.setValue(String(this.plugin.settings.offsetY));
									text.onChange(async (newVal) => {
										const num = parseFloat(newVal);
										this.plugin.settings.offsetY = !isNaN(num) ? num : DEFAULT_SETTINGS.offsetY;
										await this.plugin.saveSettings();
										this.plugin.updateBadgePosition();
									});
								});
						},
					},
					{
						name: t('SETTINGS_OPACITY'),
						desc: t('SETTINGS_OPACITY_DESC'),
						render: (setting: Setting) => {
							setting
								.setName(t('SETTINGS_OPACITY'))
								.setDesc(t('SETTINGS_OPACITY_DESC'))
								.addSlider((slider) =>
									slider
										.setLimits(0.1, 1.0, 0.05)
										.setValue(this.plugin.settings.badgeOpacity)
										.setDynamicTooltip()
										.onChange(async (val) => {
											this.plugin.settings.badgeOpacity = val;
											await this.plugin.saveSettings();
											this.plugin.updateBadgePosition();
										}),
								)
								.addExtraButton((btn) =>
									btn
										.setIcon('rotate-ccw')
										.setTooltip(t('SETTINGS_RESET_DEFAULT'))
										.onClick(async () => {
											this.plugin.settings.badgeOpacity = DEFAULT_SETTINGS.badgeOpacity;
											await this.plugin.saveSettings();
											this.plugin.updateBadgePosition();
											const sliderInput = setting.controlEl.querySelector<HTMLInputElement>(
												'input.slider, input[type="range"]',
											);
											if (sliderInput) {
												sliderInput.value = String(DEFAULT_SETTINGS.badgeOpacity);
												sliderInput.dispatchEvent(new Event('input', { bubbles: true }));
											}
										}),
								);
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
						render: (setting: Setting) => {
							this.attachHeadingIcon(setting, 'text-cursor');
							setting
								.setName(t('SETTINGS_CUMULATIVE_SHOW'))
								.setDesc(t('SETTINGS_CUMULATIVE_SHOW_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showCumulativeProgress).onChange(async (val) => {
										this.plugin.settings.showCumulativeProgress = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
										this.updateGroupVisibility(setting.settingEl);
									}),
								);
						},
					},
					{
						name: t('SETTINGS_CUMULATIVE_MODE'),
						desc: t('SETTINGS_CUMULATIVE_MODE_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-cumulative');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showCumulativeProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showCumulativeProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_CUMULATIVE_MODE'))
								.setDesc(t('SETTINGS_CUMULATIVE_MODE_DESC'))
								.addDropdown((dropdown) =>
									dropdown
										.addOptions({
											'from-top': t('CUMULATIVE_MODE_TOP'),
											'from-section': t('CUMULATIVE_MODE_SECTION'),
										})
										.setValue(this.plugin.settings.cumulativeMode)
										.onChange(async (val) => {
											this.plugin.settings.cumulativeMode = val as CumulativeCountMode;
											await this.plugin.saveSettings();
											this.plugin.recalculateCounts();
										}),
								);
						},
					},
					{
						name: t('SETTINGS_CUMULATIVE_CURRENT'),
						desc: t('SETTINGS_CUMULATIVE_CURRENT_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-cumulative');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showCumulativeProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showCumulativeProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_CUMULATIVE_CURRENT'))
								.setDesc(t('SETTINGS_CUMULATIVE_CURRENT_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showCumulativeCurrent).onChange(async (val) => {
										this.plugin.settings.showCumulativeCurrent = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_CUMULATIVE_GOAL'),
						desc: t('SETTINGS_CUMULATIVE_GOAL_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-cumulative');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showCumulativeProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showCumulativeProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_CUMULATIVE_GOAL'))
								.setDesc(t('SETTINGS_CUMULATIVE_GOAL_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showCumulativeGoal).onChange(async (val) => {
										this.plugin.settings.showCumulativeGoal = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_CUMULATIVE_PERCENT'),
						desc: t('SETTINGS_CUMULATIVE_PERCENT_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-cumulative');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showCumulativeProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showCumulativeProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_CUMULATIVE_PERCENT'))
								.setDesc(t('SETTINGS_CUMULATIVE_PERCENT_DESC'))
								.addToggle((toggle) =>
									toggle
										.setValue(this.plugin.settings.showCumulativePercentage)
										.onChange(async (val) => {
											this.plugin.settings.showCumulativePercentage = val;
											await this.plugin.saveSettings();
											this.plugin.refreshBadgeUI();
										}),
								);
						},
					},
					{
						name: t('SETTINGS_CUMULATIVE_PROGRESS_BAR'),
						desc: t('SETTINGS_CUMULATIVE_PROGRESS_BAR_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-cumulative');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showCumulativeProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showCumulativeProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_CUMULATIVE_PROGRESS_BAR'))
								.setDesc(t('SETTINGS_CUMULATIVE_PROGRESS_BAR_DESC'))
								.addToggle((toggle) =>
									toggle
										.setValue(this.plugin.settings.showCumulativeProgressBar)
										.onChange(async (val) => {
											this.plugin.settings.showCumulativeProgressBar = val;
											await this.plugin.saveSettings();
											this.plugin.refreshBadgeUI();
											this.updateGroupVisibility(setting.settingEl);
										}),
								);
						},
					},
					{
						name: t('SETTINGS_CUMULATIVE_OVERFLOW_BAR'),
						desc: t('SETTINGS_CUMULATIVE_OVERFLOW_BAR_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-cumulative-overflow');
							const isVisible =
								this.plugin.settings.showCumulativeProgress &&
								this.plugin.settings.showCumulativeProgressBar;
							setting.settingEl.classList.toggle('sgb-is-hidden', !isVisible);
							setting.settingEl.style.setProperty('display', isVisible ? '' : 'none', 'important');
							setting
								.setName(t('SETTINGS_CUMULATIVE_OVERFLOW_BAR'))
								.setDesc(t('SETTINGS_CUMULATIVE_OVERFLOW_BAR_DESC'))
								.addToggle((toggle) =>
									toggle
										.setValue(this.plugin.settings.showCumulativeOverflowBar)
										.onChange(async (val) => {
											this.plugin.settings.showCumulativeOverflowBar = val;
											await this.plugin.saveSettings();
											this.plugin.refreshBadgeUI();
										}),
								);
						},
					},
					{
						name: t('SETTINGS_CUMULATIVE_ICON'),
						desc: t('SETTINGS_CUMULATIVE_ICON_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-cumulative');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showCumulativeProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showCumulativeProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_CUMULATIVE_ICON'))
								.setDesc(t('SETTINGS_CUMULATIVE_ICON_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showCumulativeIcon).onChange(async (val) => {
										this.plugin.settings.showCumulativeIcon = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_CUMULATIVE_LABEL'),
						desc: t('SETTINGS_CUMULATIVE_LABEL_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-cumulative');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showCumulativeProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showCumulativeProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_CUMULATIVE_LABEL'))
								.setDesc(t('SETTINGS_CUMULATIVE_LABEL_DESC'))
								.addText((text) =>
									text.setValue(this.plugin.settings.cumulativeLabel).onChange(async (val) => {
										this.plugin.settings.cumulativeLabel = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
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
						render: (setting: Setting) => {
							this.attachHeadingIcon(setting, 'hash');
							setting
								.setName(t('SETTINGS_SECTION_SHOW'))
								.setDesc(t('SETTINGS_SECTION_SHOW_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showSectionProgress).onChange(async (val) => {
										this.plugin.settings.showSectionProgress = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
										this.updateGroupVisibility(setting.settingEl);
									}),
								);
						},
					},
					{
						name: t('SETTINGS_SECTION_CURRENT'),
						desc: t('SETTINGS_SECTION_CURRENT_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-section');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showSectionProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showSectionProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_SECTION_CURRENT'))
								.setDesc(t('SETTINGS_SECTION_CURRENT_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showSectionCurrent).onChange(async (val) => {
										this.plugin.settings.showSectionCurrent = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_SECTION_GOAL'),
						desc: t('SETTINGS_SECTION_GOAL_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-section');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showSectionProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showSectionProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_SECTION_GOAL'))
								.setDesc(t('SETTINGS_SECTION_GOAL_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showSectionGoal).onChange(async (val) => {
										this.plugin.settings.showSectionGoal = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_SECTION_PERCENT'),
						desc: t('SETTINGS_SECTION_PERCENT_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-section');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showSectionProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showSectionProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_SECTION_PERCENT'))
								.setDesc(t('SETTINGS_SECTION_PERCENT_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showSectionPercentage).onChange(async (val) => {
										this.plugin.settings.showSectionPercentage = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_SECTION_PROGRESS_BAR'),
						desc: t('SETTINGS_SECTION_PROGRESS_BAR_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-section');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showSectionProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showSectionProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_SECTION_PROGRESS_BAR'))
								.setDesc(t('SETTINGS_SECTION_PROGRESS_BAR_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showSectionProgressBar).onChange(async (val) => {
										this.plugin.settings.showSectionProgressBar = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
										this.updateGroupVisibility(setting.settingEl);
									}),
								);
						},
					},
					{
						name: t('SETTINGS_SECTION_OVERFLOW_BAR'),
						desc: t('SETTINGS_SECTION_OVERFLOW_BAR_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-section-overflow');
							const isVisible =
								this.plugin.settings.showSectionProgress &&
								this.plugin.settings.showSectionProgressBar;
							setting.settingEl.classList.toggle('sgb-is-hidden', !isVisible);
							setting.settingEl.style.setProperty('display', isVisible ? '' : 'none', 'important');
							setting
								.setName(t('SETTINGS_SECTION_OVERFLOW_BAR'))
								.setDesc(t('SETTINGS_SECTION_OVERFLOW_BAR_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showSectionOverflowBar).onChange(async (val) => {
										this.plugin.settings.showSectionOverflowBar = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_SECTION_ICON'),
						desc: t('SETTINGS_SECTION_ICON_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-section');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showSectionProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showSectionProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_SECTION_ICON'))
								.setDesc(t('SETTINGS_SECTION_ICON_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showSectionIcon).onChange(async (val) => {
										this.plugin.settings.showSectionIcon = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_SECTION_LABEL'),
						desc: t('SETTINGS_SECTION_LABEL_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-section');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showSectionProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showSectionProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_SECTION_LABEL'))
								.setDesc(t('SETTINGS_SECTION_LABEL_DESC'))
								.addText((text) =>
									text.setValue(this.plugin.settings.sectionLabel).onChange(async (val) => {
										this.plugin.settings.sectionLabel = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
					// Accordion Row for Heading Levels (H1〜H6)
					{
						name: t('SETTINGS_HEADING_LEVELS_ACCORDION'),
						desc: t('SETTINGS_HEADING_LEVELS_ACCORDION_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-settings-accordion-item');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showSectionProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showSectionProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_HEADING_LEVELS_ACCORDION'))
								.setDesc(t('SETTINGS_HEADING_LEVELS_ACCORDION_DESC'));

							const chevron = setting.controlEl.createSpan({
								cls: 'sgb-settings-accordion-chevron',
							});
							setIcon(chevron, this.isHeadingLevelsAccordionOpen ? 'chevron-down' : 'chevron-right');

							setting.settingEl.addEventListener('click', () => {
								this.isHeadingLevelsAccordionOpen = !this.isHeadingLevelsAccordionOpen;
								setIcon(chevron, this.isHeadingLevelsAccordionOpen ? 'chevron-down' : 'chevron-right');
								this.updateGroupVisibility(setting.settingEl);
							});
						},
					},
					{
						name: t('SETTINGS_HEADING_LEVEL_1'),
						desc: t('SETTINGS_HEADING_LEVEL_1_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-setting-sub-item', 'sgb-group-heading-level');
							const showLevel = this.plugin.settings.showSectionProgress && this.isHeadingLevelsAccordionOpen;
							setting.settingEl.classList.toggle('sgb-is-hidden', !showLevel);
							setting.settingEl.style.setProperty(
								'display',
								showLevel ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_HEADING_LEVEL_1'))
								.setDesc(t('SETTINGS_HEADING_LEVEL_1_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showHeadingLevel1).onChange(async (val) => {
										this.plugin.settings.showHeadingLevel1 = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_HEADING_LEVEL_2'),
						desc: t('SETTINGS_HEADING_LEVEL_2_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-setting-sub-item', 'sgb-group-heading-level');
							const showLevel = this.plugin.settings.showSectionProgress && this.isHeadingLevelsAccordionOpen;
							setting.settingEl.classList.toggle('sgb-is-hidden', !showLevel);
							setting.settingEl.style.setProperty(
								'display',
								showLevel ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_HEADING_LEVEL_2'))
								.setDesc(t('SETTINGS_HEADING_LEVEL_2_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showHeadingLevel2).onChange(async (val) => {
										this.plugin.settings.showHeadingLevel2 = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_HEADING_LEVEL_3'),
						desc: t('SETTINGS_HEADING_LEVEL_3_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-setting-sub-item', 'sgb-group-heading-level');
							const showLevel = this.plugin.settings.showSectionProgress && this.isHeadingLevelsAccordionOpen;
							setting.settingEl.classList.toggle('sgb-is-hidden', !showLevel);
							setting.settingEl.style.setProperty(
								'display',
								showLevel ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_HEADING_LEVEL_3'))
								.setDesc(t('SETTINGS_HEADING_LEVEL_3_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showHeadingLevel3).onChange(async (val) => {
										this.plugin.settings.showHeadingLevel3 = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_HEADING_LEVEL_4'),
						desc: t('SETTINGS_HEADING_LEVEL_4_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-setting-sub-item', 'sgb-group-heading-level');
							const showLevel = this.plugin.settings.showSectionProgress && this.isHeadingLevelsAccordionOpen;
							setting.settingEl.classList.toggle('sgb-is-hidden', !showLevel);
							setting.settingEl.style.setProperty(
								'display',
								showLevel ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_HEADING_LEVEL_4'))
								.setDesc(t('SETTINGS_HEADING_LEVEL_4_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showHeadingLevel4).onChange(async (val) => {
										this.plugin.settings.showHeadingLevel4 = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_HEADING_LEVEL_5'),
						desc: t('SETTINGS_HEADING_LEVEL_5_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-setting-sub-item', 'sgb-group-heading-level');
							const showLevel = this.plugin.settings.showSectionProgress && this.isHeadingLevelsAccordionOpen;
							setting.settingEl.classList.toggle('sgb-is-hidden', !showLevel);
							setting.settingEl.style.setProperty(
								'display',
								showLevel ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_HEADING_LEVEL_5'))
								.setDesc(t('SETTINGS_HEADING_LEVEL_5_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showHeadingLevel5).onChange(async (val) => {
										this.plugin.settings.showHeadingLevel5 = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_HEADING_LEVEL_6'),
						desc: t('SETTINGS_HEADING_LEVEL_6_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-setting-sub-item', 'sgb-group-heading-level');
							const showLevel = this.plugin.settings.showSectionProgress && this.isHeadingLevelsAccordionOpen;
							setting.settingEl.classList.toggle('sgb-is-hidden', !showLevel);
							setting.settingEl.style.setProperty(
								'display',
								showLevel ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_HEADING_LEVEL_6'))
								.setDesc(t('SETTINGS_HEADING_LEVEL_6_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showHeadingLevel6).onChange(async (val) => {
										this.plugin.settings.showHeadingLevel6 = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
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
						render: (setting: Setting) => {
							this.attachHeadingIcon(setting, 'book-text');
							setting
								.setName(t('SETTINGS_TOTAL_SHOW'))
								.setDesc(t('SETTINGS_TOTAL_SHOW_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showTotalProgress).onChange(async (val) => {
										this.plugin.settings.showTotalProgress = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
										this.updateGroupVisibility(setting.settingEl);
									}),
								);
						},
					},
					{
						name: t('SETTINGS_TOTAL_CURRENT'),
						desc: t('SETTINGS_TOTAL_CURRENT_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-total');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showTotalProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showTotalProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_TOTAL_CURRENT'))
								.setDesc(t('SETTINGS_TOTAL_CURRENT_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showTotalCurrent).onChange(async (val) => {
										this.plugin.settings.showTotalCurrent = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_TOTAL_GOAL'),
						desc: t('SETTINGS_TOTAL_GOAL_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-total');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showTotalProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showTotalProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_TOTAL_GOAL'))
								.setDesc(t('SETTINGS_TOTAL_GOAL_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showTotalGoal).onChange(async (val) => {
										this.plugin.settings.showTotalGoal = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_TOTAL_PERCENT'),
						desc: t('SETTINGS_TOTAL_PERCENT_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-total');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showTotalProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showTotalProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_TOTAL_PERCENT'))
								.setDesc(t('SETTINGS_TOTAL_PERCENT_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showTotalPercentage).onChange(async (val) => {
										this.plugin.settings.showTotalPercentage = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_TOTAL_PROGRESS_BAR'),
						desc: t('SETTINGS_TOTAL_PROGRESS_BAR_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-total');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showTotalProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showTotalProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_TOTAL_PROGRESS_BAR'))
								.setDesc(t('SETTINGS_TOTAL_PROGRESS_BAR_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showTotalProgressBar).onChange(async (val) => {
										this.plugin.settings.showTotalProgressBar = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
										this.updateGroupVisibility(setting.settingEl);
									}),
								);
						},
					},
					{
						name: t('SETTINGS_TOTAL_OVERFLOW_BAR'),
						desc: t('SETTINGS_TOTAL_OVERFLOW_BAR_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-total-overflow');
							const isVisible =
								this.plugin.settings.showTotalProgress &&
								this.plugin.settings.showTotalProgressBar;
							setting.settingEl.classList.toggle('sgb-is-hidden', !isVisible);
							setting.settingEl.style.setProperty('display', isVisible ? '' : 'none', 'important');
							setting
								.setName(t('SETTINGS_TOTAL_OVERFLOW_BAR'))
								.setDesc(t('SETTINGS_TOTAL_OVERFLOW_BAR_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showTotalOverflowBar).onChange(async (val) => {
										this.plugin.settings.showTotalOverflowBar = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_TOTAL_ICON'),
						desc: t('SETTINGS_TOTAL_ICON_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-total');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showTotalProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showTotalProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_TOTAL_ICON'))
								.setDesc(t('SETTINGS_TOTAL_ICON_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showTotalIcon).onChange(async (val) => {
										this.plugin.settings.showTotalIcon = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_TOTAL_LABEL'),
						desc: t('SETTINGS_TOTAL_LABEL_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-total');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showTotalProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showTotalProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_TOTAL_LABEL'))
								.setDesc(t('SETTINGS_TOTAL_LABEL_DESC'))
								.addText((text) =>
									text.setValue(this.plugin.settings.totalLabel).onChange(async (val) => {
										this.plugin.settings.totalLabel = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
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
						render: (setting: Setting) => {
							this.attachHeadingIcon(setting, 'calculator');
							setting
								.setName(t('SETTINGS_COUNT_TYPE'))
								.setDesc(t('SETTINGS_COUNT_TYPE_DESC'))
								.addDropdown((dropdown) =>
									dropdown
										.addOptions({
											character: t('COUNT_TYPE_CHARACTER'),
											word: t('COUNT_TYPE_WORD'),
										})
										.setValue(this.plugin.settings.countType)
										.onChange(async (val) => {
											this.plugin.settings.countType = val as CountType;
											await this.plugin.saveSettings();
											this.plugin.recalculateCounts();
										}),
								);
						},
					},
					{
						name: t('SETTINGS_EXCLUDE_WHITESPACE'),
						desc: t('SETTINGS_EXCLUDE_WHITESPACE_DESC'),
						render: (setting: Setting) => {
							setting
								.setName(t('SETTINGS_EXCLUDE_WHITESPACE'))
								.setDesc(t('SETTINGS_EXCLUDE_WHITESPACE_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.excludeWhitespace).onChange(async (val) => {
										this.plugin.settings.excludeWhitespace = val;
										await this.plugin.saveSettings();
										this.plugin.recalculateCounts();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_EXCLUDE_RUBY'),
						desc: t('SETTINGS_EXCLUDE_RUBY_DESC'),
						render: (setting: Setting) => {
							setting
								.setName(t('SETTINGS_EXCLUDE_RUBY'))
								.setDesc(t('SETTINGS_EXCLUDE_RUBY_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.excludeRuby).onChange(async (val) => {
										this.plugin.settings.excludeRuby = val;
										await this.plugin.saveSettings();
										this.plugin.recalculateCounts();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_EXCLUDE_CHARACTERS'),
						desc: t('SETTINGS_EXCLUDE_CHARACTERS_DESC'),
						render: (setting: Setting) => {
							setting
								.setName(t('SETTINGS_EXCLUDE_CHARACTERS'))
								.setDesc(t('SETTINGS_EXCLUDE_CHARACTERS_DESC'))
								.addText((text) =>
									text.setValue(this.plugin.settings.excludeCharacters).onChange(async (val) => {
										this.plugin.settings.excludeCharacters = val;
										await this.plugin.saveSettings();
										this.plugin.recalculateCounts();
									}),
								);
						},
					},
				],
			},

			// Group: Color Styles
			{
				type: 'group',
				heading: t('SETTINGS_HEADING_STYLES'),
				items: [
					{
						name: t('SETTINGS_DEFAULT_STYLE'),
						desc: t('SETTINGS_DEFAULT_STYLE_DESC'),
						render: (setting: Setting) => {
							this.attachHeadingIcon(setting, 'palette');
							setting.settingEl.addClass('sgb-default-style-setting');
							setting
								.setName(t('SETTINGS_DEFAULT_STYLE'))
								.setDesc(t('SETTINGS_DEFAULT_STYLE_DESC'))
								.addDropdown((dropdown) => {
									for (const style of this.plugin.settings.styles) {
										dropdown.addOption(String(style.id), style.name);
									}
									dropdown.setValue(String(this.plugin.settings.defaultStyleId ?? 1));
									dropdown.onChange(async (val) => {
										const id = parseInt(val, 10);
										if (!isNaN(id)) {
											this.plugin.settings.defaultStyleId = id;
											await this.plugin.saveSettings();
											this.plugin.refreshBadgeUI();
											this.updateSettingSwatches(setting.settingEl);
										}
									});
								});
						},
					},
					{
						render: (stylesManagerSetting: Setting) => {
							stylesManagerSetting.settingEl.addClass('sgb-styles-manager-setting');
							stylesManagerSetting.infoEl.remove();

							const stylesContainer = stylesManagerSetting.controlEl.createDiv({
								cls: 'sgb-styles-manager-container',
							});

							const updateAllStyleDropdowns = () => {
								const root = this.getTabRoot(stylesManagerSetting.settingEl);

								// 1. Update Default Color Style Dropdown
								const defaultSettingEl = root.querySelector<HTMLElement>(
									'.sgb-default-style-setting',
								);
								if (defaultSettingEl) {
									const selectEl = defaultSettingEl.querySelector<HTMLSelectElement>('select');
									if (selectEl) {
										selectEl.empty();
										for (const style of this.plugin.settings.styles) {
											const opt = selectEl.createEl('option', {
												value: String(style.id),
												text: style.name,
											});
											if (style.id === this.plugin.settings.defaultStyleId) {
												opt.selected = true;
											}
										}
									}
								}
								this.updateSettingSwatches(stylesManagerSetting.settingEl);

								// 2. Update Folder Goals Style Dropdowns in all expanded folder cards
								const folderCards = root.querySelectorAll<HTMLElement>('.sgb-folder-goal-card');
								folderCards.forEach((cardEl) => {
									const folderId = cardEl.getAttribute('data-folder-id');
									const folderConfig = this.plugin.settings.folderGoals.find((f) => f.id === folderId);
									const folderSelect = cardEl.querySelector<HTMLSelectElement>('.sgb-folder-style-select');
									if (folderSelect && folderConfig) {
										folderSelect.empty();
										const defaultOpt = folderSelect.createEl('option', {
											value: '',
											text: t('SETTINGS_FOLDER_STYLE_INHERIT'),
										});
										if (folderConfig.styleId === undefined) {
											defaultOpt.selected = true;
										}
										for (const style of this.plugin.settings.styles) {
											const opt = folderSelect.createEl('option', {
												value: String(style.id),
												text: style.name,
											});
											if (folderConfig.styleId === style.id) {
												opt.selected = true;
											}
										}
									}
								});
							};

							const renderStylesList = () => {
								stylesContainer.empty();

								const listEl = stylesContainer.createDiv({ cls: 'sgb-styles-list' });

								this.plugin.settings.styles.forEach((style) => {
									const cardEl = listEl.createDiv({ cls: 'sgb-style-card' });

									// Card Header: Name Input & Action Button
									const headerEl = cardEl.createDiv({ cls: 'sgb-style-card-header' });
									const nameWrapper = headerEl.createDiv({ cls: 'sgb-style-name-wrapper' });
									nameWrapper.createSpan({
										cls: 'sgb-style-name-label',
										text: t('SETTINGS_STYLE_NAME_LABEL'),
									});
									const nameInput = nameWrapper.createEl('input', {
										type: 'text',
										cls: 'sgb-style-name-input',
										placeholder: t('SETTINGS_STYLE_NAME_PLACEHOLDER'),
										value: style.name,
										attr: {
											maxlength: '14',
										},
									});
									nameInput.addEventListener('change', () => {
										void (async () => {
											const trimmed = nameInput.value.trim().slice(0, 14);
											style.name = trimmed || `Style ${style.id}`;
											nameInput.value = style.name;
											await this.plugin.saveSettings();
											this.plugin.refreshBadgeUI();
											updateAllStyleDropdowns();
										})();
									});

									const actionsEl = headerEl.createDiv({ cls: 'sgb-style-card-actions' });

									if (style.type !== 'gradient') {
										const gradientBtn = actionsEl.createEl('button', {
											cls: 'clickable-icon sgb-style-action-btn',
											title: t('SETTINGS_STYLE_AUTO_GRADIENT'),
										});
										setIcon(gradientBtn, 'sparkles');
										gradientBtn.addEventListener('click', () => {
											new ConfirmModal(this.app, {
												message: t('SETTINGS_STYLE_AUTO_GRADIENT_CONFIRM'),
												confirmText: t('MODAL_CONFIRM_OK'),
												isWarning: false,
												onConfirm: () => {
													void (async () => {
														const { colorWarn, colorGood } = interpolateGoalColors(
															style.colorDefault,
															style.colorDone,
														);
														style.colorWarn = colorWarn;
														style.colorGood = colorGood;
														await this.plugin.saveSettings();
														this.plugin.refreshBadgeUI();
														renderStylesList();
														if (style.id === this.plugin.settings.defaultStyleId) {
															this.updateSettingSwatches(stylesManagerSetting.settingEl);
														}
													})();
												},
											}).open();
										});
									}

									if (style.isPreset || style.id === 1 || style.id === 2) {
										const resetBtn = actionsEl.createEl('button', {
											cls: 'clickable-icon sgb-style-action-btn',
											title: t('SETTINGS_STYLE_RESET_ITEM'),
										});
										setIcon(resetBtn, 'rotate-ccw');
										resetBtn.addEventListener('click', () => {
											void (async () => {
												const defaults = getDefaultStyles();
												const defaultPreset = defaults.find((d) => d.id === style.id);
												if (defaultPreset) {
													style.name = defaultPreset.name;
													style.type = defaultPreset.type ?? 'discrete';
													style.colorDefault = defaultPreset.colorDefault;
													style.colorWarn = defaultPreset.colorWarn;
													style.colorGood = defaultPreset.colorGood;
													style.colorDone = defaultPreset.colorDone;
													await this.plugin.saveSettings();
													this.plugin.refreshBadgeUI();
													renderStylesList();
													updateAllStyleDropdowns();
												}
											})();
										});
									} else {
										const deleteBtn = actionsEl.createEl('button', {
											cls: 'clickable-icon sgb-style-action-btn mod-warning',
											title: t('SETTINGS_STYLE_DELETE'),
										});
										setIcon(deleteBtn, 'trash-2');
										deleteBtn.addEventListener('click', () => {
											void (async () => {
												const deletedStyleId = style.id;
												this.plugin.settings.styles = this.plugin.settings.styles.filter(
													(s) => s.id !== deletedStyleId,
												);
												if (this.plugin.settings.defaultStyleId === deletedStyleId) {
													this.plugin.settings.defaultStyleId =
														this.plugin.settings.styles[0]?.id ?? 1;
												}
												// Clean up any folder goals pointing to deleted style
												for (const fg of this.plugin.settings.folderGoals) {
													if (fg.styleId === deletedStyleId) {
														fg.styleId = undefined;
													}
												}
												await this.plugin.saveSettings();
												this.plugin.refreshBadgeUI();
												renderStylesList();
												updateAllStyleDropdowns();
											})();
										});
									}

									// Sub-row: Type Dropdown
									const subRowEl = cardEl.createDiv({ cls: 'sgb-style-card-subrow' });
									subRowEl.createSpan({
										cls: 'sgb-style-type-label',
										text: t('SETTINGS_STYLE_TYPE_LABEL'),
									});
									const typeDropdown = new DropdownComponent(subRowEl);
									typeDropdown.selectEl.addClass('sgb-style-type-dropdown');
									typeDropdown
										.addOption('discrete', t('SETTINGS_STYLE_TYPE_DISCRETE'))
										.addOption('gradient', t('SETTINGS_STYLE_TYPE_GRADIENT'))
										.setValue(style.type === 'gradient' ? 'gradient' : 'discrete')
										.onChange((val) => {
											void (async () => {
												style.type = val as 'discrete' | 'gradient';
												await this.plugin.saveSettings();
												this.plugin.refreshBadgeUI();
												renderStylesList();
												if (style.id === this.plugin.settings.defaultStyleId) {
													this.updateSettingSwatches(stylesManagerSetting.settingEl);
												}
											})();
										});

									// Card Body: Color Pickers Grid
									const isGradient = style.type === 'gradient';
									const colorsGrid = cardEl.createDiv({
										cls: isGradient ? 'sgb-style-colors-grid is-gradient' : 'sgb-style-colors-grid',
									});

									let gradientBarEl: HTMLElement | null = null;
									const updateGradientBar = () => {
										if (gradientBarEl) {
											gradientBarEl.style.background = `linear-gradient(to right, ${style.colorDefault}, ${style.colorDone})`;
										}
									};

									const createColorItem = (
										key: 'colorDefault' | 'colorWarn' | 'colorGood' | 'colorDone',
										label: string,
									) => {
										const colorItemEl = colorsGrid.createDiv({ cls: 'sgb-style-color-item' });
										colorItemEl.createSpan({ cls: 'sgb-style-color-label', text: label });

										const colorPickerWrapper = colorItemEl.createDiv({
											cls: 'sgb-style-color-picker-wrapper',
										});
										const colorInput = colorPickerWrapper.createEl('input', {
											type: 'color',
											cls: 'sgb-style-color-input',
											value: style[key],
										});
										const hexInput = colorPickerWrapper.createEl('input', {
											type: 'text',
											cls: 'sgb-style-hex-input',
											value: style[key],
											placeholder: '#000000',
										});

										colorInput.addEventListener('input', () => {
											void (async () => {
												style[key] = colorInput.value;
												hexInput.value = colorInput.value;
												updateGradientBar();
												await this.plugin.saveSettings();
												this.plugin.refreshBadgeUI();
												if (style.id === this.plugin.settings.defaultStyleId) {
													this.updateSettingSwatches(stylesManagerSetting.settingEl);
												}
											})();
										});

										const handleHexChange = () => {
											void (async () => {
												let val = hexInput.value.trim();
												if (!val.startsWith('#') && /^[0-9a-fA-F]{3,6}$/.test(val)) {
													val = '#' + val;
												}
												if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)) {
													if (val.length === 4) {
														val = `#${val[1]}${val[1]}${val[2]}${val[2]}${val[3]}${val[3]}`;
													}
													style[key] = val;
													colorInput.value = val;
													hexInput.value = val;
													updateGradientBar();
													await this.plugin.saveSettings();
													this.plugin.refreshBadgeUI();
													if (style.id === this.plugin.settings.defaultStyleId) {
														this.updateSettingSwatches(stylesManagerSetting.settingEl);
													}
												} else {
													hexInput.value = style[key];
												}
											})();
										};

										hexInput.addEventListener('change', handleHexChange);
										hexInput.addEventListener('blur', handleHexChange);
									};

									if (isGradient) {
										createColorItem('colorDefault', t('SETTINGS_COLOR_START'));

										const previewItem = colorsGrid.createDiv({ cls: 'sgb-style-gradient-preview-item' });
										previewItem.createSpan({ cls: 'sgb-style-color-label', text: t('SETTINGS_STYLE_PREVIEW') });
										gradientBarEl = previewItem.createDiv({ cls: 'sgb-style-gradient-bar' });
										updateGradientBar();

										createColorItem('colorDone', t('SETTINGS_COLOR_END'));
									} else {
										createColorItem('colorDefault', t('SETTINGS_COLOR_DEFAULT'));
										createColorItem('colorWarn', t('SETTINGS_COLOR_WARN'));
										createColorItem('colorGood', t('SETTINGS_COLOR_GOOD'));
										createColorItem('colorDone', t('SETTINGS_COLOR_DONE'));
									}
								});

								// Footer: Add Button & Reset All Button
								const footerEl = stylesContainer.createDiv({ cls: 'sgb-styles-footer' });

								const canAdd = this.plugin.settings.styles.length < MAX_COLOR_STYLES;
								const addBtn = footerEl.createEl('button', {
									cls: 'sgb-add-style-btn',
									text: t('SETTINGS_STYLE_ADD'),
								});
								if (!canAdd) {
									addBtn.disabled = true;
								}
								addBtn.addEventListener('click', () => {
									void (async () => {
										if (this.plugin.settings.styles.length >= MAX_COLOR_STYLES) return;
										const existingIds = this.plugin.settings.styles.map((s) => s.id);
										const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

										this.plugin.settings.styles.push({
											id: nextId,
											name: `Style ${nextId}`,
											type: 'discrete',
											colorDefault: '#ababab',
											colorWarn: '#e2b93b',
											colorGood: '#ff7843',
											colorDone: '#ff4d4f',
										});
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
										renderStylesList();
										updateAllStyleDropdowns();
									})();
								});

								const resetAllBtn = footerEl.createEl('button', {
									cls: 'clickable-icon sgb-reset-all-styles-btn',
									title: t('SETTINGS_STYLE_RESET_ALL'),
								});
								setIcon(resetAllBtn, 'rotate-ccw');
								resetAllBtn.addEventListener('click', () => {
									new ConfirmModal(this.app, {
										message: t('SETTINGS_STYLE_RESET_ALL_CONFIRM'),
										confirmText: t('MODAL_CONFIRM_OK'),
										isWarning: true,
										onConfirm: () => {
											void (async () => {
												this.plugin.settings.styles = getDefaultStyles();
												this.plugin.settings.defaultStyleId = 1;
												const validStyleIds = new Set(this.plugin.settings.styles.map((s) => s.id));
												for (const fg of this.plugin.settings.folderGoals) {
													if (fg.styleId !== undefined && !validStyleIds.has(fg.styleId)) {
														fg.styleId = undefined;
													}
												}
												await this.plugin.saveSettings();
												this.plugin.refreshBadgeUI();
												renderStylesList();
												updateAllStyleDropdowns();
											})();
										},
									}).open();
								});
							};

							renderStylesList();
						},
					},
				],

			},

			// Group 7: Progress Thresholds
			{
				type: 'group',
				heading: t('SETTINGS_HEADING_THRESHOLDS'),
				items: [
					{
						name: t('SETTINGS_THRESH_WARN'),
						desc: t('SETTINGS_THRESH_WARN_DESC'),
						render: (setting: Setting) => {
							this.attachHeadingIcon(setting, 'gauge');
							setting
								.setName(t('SETTINGS_THRESH_WARN'))
								.setDesc(t('SETTINGS_THRESH_WARN_DESC'));
							const circle = createSpan({ cls: 'sgb-color-preview-circle sgb-color-preview-warn' });
							setting.nameEl.prepend(circle);
							setting.addText((text) => {
								text.inputEl.type = 'number';
								text.setPlaceholder(String(DEFAULT_SETTINGS.colorThresholdWarn));
								text.setValue(String(this.plugin.settings.colorThresholdWarn));
								text.onChange(async (newVal) => {
									const num = parseFloat(newVal);
									this.plugin.settings.colorThresholdWarn = !isNaN(num)
										? num
										: DEFAULT_SETTINGS.colorThresholdWarn;
									await this.plugin.saveSettings();
									this.plugin.refreshBadgeUI();
								});
							});
							this.updateSettingSwatches(setting.settingEl);
						},
					},
					{
						name: t('SETTINGS_THRESH_GOOD'),
						desc: t('SETTINGS_THRESH_GOOD_DESC'),
						render: (setting: Setting) => {
							setting
								.setName(t('SETTINGS_THRESH_GOOD'))
								.setDesc(t('SETTINGS_THRESH_GOOD_DESC'));
							const circle = createSpan({ cls: 'sgb-color-preview-circle sgb-color-preview-good' });
							setting.nameEl.prepend(circle);
							setting.addText((text) => {
								text.inputEl.type = 'number';
								text.setPlaceholder(String(DEFAULT_SETTINGS.colorThresholdGood));
								text.setValue(String(this.plugin.settings.colorThresholdGood));
								text.onChange(async (newVal) => {
									const num = parseFloat(newVal);
									this.plugin.settings.colorThresholdGood = !isNaN(num)
										? num
										: DEFAULT_SETTINGS.colorThresholdGood;
									await this.plugin.saveSettings();
									this.plugin.refreshBadgeUI();
								});
							});
							this.updateSettingSwatches(setting.settingEl);
						},
					},
					{
						name: t('SETTINGS_THRESH_DONE'),
						desc: t('SETTINGS_THRESH_DONE_DESC'),
						render: (setting: Setting) => {
							setting
								.setName(t('SETTINGS_THRESH_DONE'))
								.setDesc(t('SETTINGS_THRESH_DONE_DESC'));
							const circle = createSpan({ cls: 'sgb-color-preview-circle sgb-color-preview-done' });
							setting.nameEl.prepend(circle);
							setting.addText((text) => {
								text.inputEl.type = 'number';
								text.setPlaceholder(String(DEFAULT_SETTINGS.colorThresholdDone));
								text.setValue(String(this.plugin.settings.colorThresholdDone));
								text.onChange(async (newVal) => {
									const num = parseFloat(newVal);
									this.plugin.settings.colorThresholdDone = !isNaN(num)
										? num
										: DEFAULT_SETTINGS.colorThresholdDone;
									await this.plugin.saveSettings();
									this.plugin.refreshBadgeUI();
								});
							});
							this.updateSettingSwatches(setting.settingEl);
						},
					},
				],
			},

			// Group 8: Date Goals & Deadlines
			{
				type: 'group',
				heading: t('SETTINGS_HEADING_DATE'),
				items: [
					{
						name: t('SETTINGS_DATE_SHOW'),
						desc: t('SETTINGS_DATE_SHOW_DESC'),
						render: (setting: Setting) => {
							this.attachHeadingIcon(setting, 'calendar');
							setting
								.setName(t('SETTINGS_DATE_SHOW'))
								.setDesc(t('SETTINGS_DATE_SHOW_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showDateProgress).onChange(async (val) => {
										this.plugin.settings.showDateProgress = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
										this.updateGroupVisibility(setting.settingEl);
									}),
								);
						},
					},
					{
						name: t('SETTINGS_DATE_WHEN_UNSET'),
						desc: t('SETTINGS_DATE_WHEN_UNSET_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-date');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showDateProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showDateProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_DATE_WHEN_UNSET'))
								.setDesc(t('SETTINGS_DATE_WHEN_UNSET_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showDateWhenUnset).onChange(async (val) => {
										this.plugin.settings.showDateWhenUnset = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_DATE_POSITION_MODE'),
						desc: t('SETTINGS_DATE_POSITION_MODE_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-date');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showDateProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showDateProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_DATE_POSITION_MODE'))
								.setDesc(t('SETTINGS_DATE_POSITION_MODE_DESC'))
								.addDropdown((dropdown) =>
									dropdown
										.addOptions({
											left: t('SETTINGS_DATE_POS_LEFT'),
											custom: t('SETTINGS_DATE_POS_CUSTOM'),
										})
										.setValue(this.plugin.settings.datePositionMode === 'custom' ? 'custom' : 'left')
										.onChange(async (val) => {
											this.plugin.settings.datePositionMode = val === 'custom' ? 'custom' : 'left';
											await this.plugin.saveSettings();
											this.plugin.updateBadgePosition();
											this.plugin.refreshBadgeUI();
											this.updateGroupVisibility(setting.settingEl);
										}),
								);
						},
					},
					{
						name: t('SETTINGS_DATE_BADGE_POS'),
						desc: t('SETTINGS_DATE_BADGE_POS_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-date');
							setting.settingEl.addClass('sgb-group-date-custom');
							const isVisible =
								this.plugin.settings.showDateProgress &&
								this.plugin.settings.datePositionMode === 'custom';
							setting.settingEl.classList.toggle('sgb-is-hidden', !isVisible);
							setting.settingEl.style.setProperty('display', isVisible ? '' : 'none', 'important');
							setting
								.setName(t('SETTINGS_DATE_BADGE_POS'))
								.setDesc(t('SETTINGS_DATE_BADGE_POS_DESC'))
								.addDropdown((dropdown) =>
									dropdown
										.addOptions({
											'top-left': t('POS_TOP_LEFT'),
											'top-right': t('POS_TOP_RIGHT'),
											'bottom-left': t('POS_BOTTOM_LEFT'),
											'bottom-right': t('POS_BOTTOM_RIGHT'),
										})
										.setValue(this.plugin.settings.dateBadgePosition || 'top-left')
										.onChange(async (val) => {
											this.plugin.settings.dateBadgePosition = val as BadgePositionPreset;
											await this.plugin.saveSettings();
											this.plugin.updateBadgePosition();
										}),
								);
						},
					},
					{
						name: t('SETTINGS_DATE_FONT_SIZE'),
						desc: t('SETTINGS_DATE_FONT_SIZE_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-date');
							setting.settingEl.addClass('sgb-group-date-custom');
							const isVisible =
								this.plugin.settings.showDateProgress &&
								this.plugin.settings.datePositionMode === 'custom';
							setting.settingEl.classList.toggle('sgb-is-hidden', !isVisible);
							setting.settingEl.style.setProperty('display', isVisible ? '' : 'none', 'important');
							setting
								.setName(t('SETTINGS_DATE_FONT_SIZE'))
								.setDesc(t('SETTINGS_DATE_FONT_SIZE_DESC'))
								.addSlider((slider) =>
									slider
										.setLimits(8, 64, 1)
										.setValue(this.plugin.settings.dateFontSize || DEFAULT_FONT_SIZE_PX)
										.setDynamicTooltip()
										.onChange(async (val) => {
											this.plugin.settings.dateFontSize = val;
											await this.plugin.saveSettings();
											this.plugin.updateBadgePosition();
										}),
								)
								.addExtraButton((btn) =>
									btn
										.setIcon('rotate-ccw')
										.setTooltip(t('SETTINGS_RESET_DEFAULT'))
										.onClick(async () => {
											this.plugin.settings.dateFontSize = DEFAULT_SETTINGS.dateFontSize;
											await this.plugin.saveSettings();
											this.plugin.updateBadgePosition();
											const sliderInput = setting.controlEl.querySelector<HTMLInputElement>(
												'input.slider, input[type="range"]',
											);
											if (sliderInput) {
												sliderInput.value = String(DEFAULT_SETTINGS.dateFontSize);
												sliderInput.dispatchEvent(new Event('input', { bubbles: true }));
											}
										}),
								);
						},
					},
					{
						name: t('SETTINGS_DATE_OPACITY'),
						desc: t('SETTINGS_DATE_OPACITY_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-date');
							setting.settingEl.addClass('sgb-group-date-custom');
							const isVisible =
								this.plugin.settings.showDateProgress &&
								this.plugin.settings.datePositionMode === 'custom';
							setting.settingEl.classList.toggle('sgb-is-hidden', !isVisible);
							setting.settingEl.style.setProperty('display', isVisible ? '' : 'none', 'important');
							setting
								.setName(t('SETTINGS_DATE_OPACITY'))
								.setDesc(t('SETTINGS_DATE_OPACITY_DESC'))
								.addSlider((slider) =>
									slider
										.setLimits(0.1, 1.0, 0.05)
										.setValue(this.plugin.settings.dateBadgeOpacity ?? DEFAULT_SETTINGS.dateBadgeOpacity)
										.setDynamicTooltip()
										.onChange(async (val) => {
											this.plugin.settings.dateBadgeOpacity = val;
											await this.plugin.saveSettings();
											this.plugin.updateBadgePosition();
										}),
								)
								.addExtraButton((btn) =>
									btn
										.setIcon('rotate-ccw')
										.setTooltip(t('SETTINGS_RESET_DEFAULT'))
										.onClick(async () => {
											this.plugin.settings.dateBadgeOpacity = DEFAULT_SETTINGS.dateBadgeOpacity;
											await this.plugin.saveSettings();
											this.plugin.updateBadgePosition();
											const sliderInput = setting.controlEl.querySelector<HTMLInputElement>(
												'input.slider, input[type="range"]',
											);
											if (sliderInput) {
												sliderInput.value = String(DEFAULT_SETTINGS.dateBadgeOpacity);
												sliderInput.dispatchEvent(new Event('input', { bubbles: true }));
											}
										}),
								);
						},
					},
					{
						name: t('SETTINGS_DATE_OFFSET_X'),
						desc: t('SETTINGS_DATE_OFFSET_X_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-date');
							setting.settingEl.addClass('sgb-group-date-custom');
							const isVisible =
								this.plugin.settings.showDateProgress &&
								this.plugin.settings.datePositionMode === 'custom';
							setting.settingEl.classList.toggle('sgb-is-hidden', !isVisible);
							setting.settingEl.style.setProperty('display', isVisible ? '' : 'none', 'important');
							setting
								.setName(t('SETTINGS_DATE_OFFSET_X'))
								.setDesc(t('SETTINGS_DATE_OFFSET_X_DESC'))
								.addText((text) => {
									text.inputEl.type = 'number';
									text.setPlaceholder(String(DEFAULT_SETTINGS.dateOffsetX));
									text.setValue(String(this.plugin.settings.dateOffsetX ?? DEFAULT_SETTINGS.dateOffsetX));
									text.onChange(async (newVal) => {
										const num = parseFloat(newVal);
										this.plugin.settings.dateOffsetX = !isNaN(num) ? num : DEFAULT_SETTINGS.dateOffsetX;
										await this.plugin.saveSettings();
										this.plugin.updateBadgePosition();
									});
								});
						},
					},
					{
						name: t('SETTINGS_DATE_OFFSET_Y'),
						desc: t('SETTINGS_DATE_OFFSET_Y_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-date');
							setting.settingEl.addClass('sgb-group-date-custom');
							const isVisible =
								this.plugin.settings.showDateProgress &&
								this.plugin.settings.datePositionMode === 'custom';
							setting.settingEl.classList.toggle('sgb-is-hidden', !isVisible);
							setting.settingEl.style.setProperty('display', isVisible ? '' : 'none', 'important');
							setting
								.setName(t('SETTINGS_DATE_OFFSET_Y'))
								.setDesc(t('SETTINGS_DATE_OFFSET_Y_DESC'))
								.addText((text) => {
									text.inputEl.type = 'number';
									text.setPlaceholder(String(DEFAULT_SETTINGS.dateOffsetY));
									text.setValue(String(this.plugin.settings.dateOffsetY ?? DEFAULT_SETTINGS.dateOffsetY));
									text.onChange(async (newVal) => {
										const num = parseFloat(newVal);
										this.plugin.settings.dateOffsetY = !isNaN(num) ? num : DEFAULT_SETTINGS.dateOffsetY;
										await this.plugin.saveSettings();
										this.plugin.updateBadgePosition();
									});
								});
						},
					},
					{
						name: t('SETTINGS_DATE_HOURS_ALWAYS'),
						desc: t('SETTINGS_DATE_HOURS_ALWAYS_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-date');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showDateProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showDateProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_DATE_HOURS_ALWAYS'))
								.setDesc(t('SETTINGS_DATE_HOURS_ALWAYS_DESC'))
								.addToggle((toggle) =>
									toggle
										.setValue(this.plugin.settings.showDateHoursAlways)
										.onChange(async (val) => {
											this.plugin.settings.showDateHoursAlways = val;
											await this.plugin.saveSettings();
											this.plugin.refreshBadgeUI();
										}),
								);
						},
					},
					{
						name: t('SETTINGS_DEFAULT_START_TIME'),
						desc: t('SETTINGS_DEFAULT_START_TIME_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-date');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showDateProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showDateProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_DEFAULT_START_TIME'))
								.setDesc(t('SETTINGS_DEFAULT_START_TIME_DESC'));
							let textComponent: TextComponent | undefined;
							const nativeTimePicker = setting.controlEl.createEl('input', {
								type: 'time',
								cls: 'sgb-native-date-picker',
								value: this.plugin.settings.defaultStartTime || DEFAULT_SETTINGS.defaultStartTime,
							});
							nativeTimePicker.addEventListener('change', () => {
								void (async () => {
									const val = nativeTimePicker.value.trim();
									if (val) {
										textComponent?.setValue(val);
										this.plugin.settings.defaultStartTime = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}
								})();
							});
							setting
								.addText((text) => {
									textComponent = text;
									text.setPlaceholder(DEFAULT_SETTINGS.defaultStartTime);
									text.setValue(this.plugin.settings.defaultStartTime || DEFAULT_SETTINGS.defaultStartTime);
									text.inputEl.addClass('sgb-time-setting-text-input');
									text.onChange(async (val) => {
										const trimmed = val.trim();
										if (/^([01]?\d|2[0-3]):[0-5]\d$/.test(trimmed)) {
											this.plugin.settings.defaultStartTime = trimmed;
											nativeTimePicker.value = trimmed;
											await this.plugin.saveSettings();
											this.plugin.refreshBadgeUI();
										} else if (!trimmed) {
											this.plugin.settings.defaultStartTime = DEFAULT_SETTINGS.defaultStartTime;
											nativeTimePicker.value = DEFAULT_SETTINGS.defaultStartTime;
											await this.plugin.saveSettings();
											this.plugin.refreshBadgeUI();
										}
									});
									text.inputEl.addEventListener('blur', () => {
										void (async () => {
											const trimmed = text.inputEl.value.trim();
											const norm = normalizeTimeInput(trimmed);
											if (norm) {
												this.plugin.settings.defaultStartTime = norm;
												text.setValue(norm);
												nativeTimePicker.value = norm;
												await this.plugin.saveSettings();
												this.plugin.refreshBadgeUI();
											} else {
												text.setValue(this.plugin.settings.defaultStartTime || DEFAULT_SETTINGS.defaultStartTime);
												nativeTimePicker.value = this.plugin.settings.defaultStartTime || DEFAULT_SETTINGS.defaultStartTime;
											}
										})();
									});
								})
								.addExtraButton((btn) =>
									btn
										.setIcon('clock')
										.setTooltip(t('MODAL_TIME_PICKER_TOOLTIP'))
										.onClick(() => {
											const currentVal = textComponent?.getValue().trim();
											const normTime = normalizeTimeInput(currentVal ?? '');
											nativeTimePicker.value = normTime || this.plugin.settings.defaultStartTime || DEFAULT_SETTINGS.defaultStartTime;
											try {
												if (typeof nativeTimePicker.showPicker === 'function') {
													nativeTimePicker.showPicker();
												} else {
													nativeTimePicker.click();
												}
											} catch {
												nativeTimePicker.click();
											}
										}),
								)
								.addExtraButton((btn) =>
									btn
										.setIcon('rotate-ccw')
										.setTooltip(t('SETTINGS_RESET_DEFAULT'))
										.onClick(async () => {
											this.plugin.settings.defaultStartTime = DEFAULT_SETTINGS.defaultStartTime;
											nativeTimePicker.value = DEFAULT_SETTINGS.defaultStartTime;
											await this.plugin.saveSettings();
											this.plugin.refreshBadgeUI();
											textComponent?.setValue(DEFAULT_SETTINGS.defaultStartTime);
										}),
								);
						},
					},
					{
						name: t('SETTINGS_DEFAULT_TARGET_TIME'),
						desc: t('SETTINGS_DEFAULT_TARGET_TIME_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-date');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showDateProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showDateProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_DEFAULT_TARGET_TIME'))
								.setDesc(t('SETTINGS_DEFAULT_TARGET_TIME_DESC'));
							let textComponent: TextComponent | undefined;
							const nativeTimePicker = setting.controlEl.createEl('input', {
								type: 'time',
								cls: 'sgb-native-date-picker',
								value: this.plugin.settings.defaultTargetTime || DEFAULT_SETTINGS.defaultTargetTime,
							});
							nativeTimePicker.addEventListener('change', () => {
								void (async () => {
									const val = nativeTimePicker.value.trim();
									if (val) {
										textComponent?.setValue(val);
										this.plugin.settings.defaultTargetTime = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}
								})();
							});
							setting
								.addText((text) => {
									textComponent = text;
									text.setPlaceholder(DEFAULT_SETTINGS.defaultTargetTime);
									text.setValue(this.plugin.settings.defaultTargetTime || DEFAULT_SETTINGS.defaultTargetTime);
									text.inputEl.addClass('sgb-time-setting-text-input');
									text.onChange(async (val) => {
										const trimmed = val.trim();
										if (/^([01]?\d|2[0-3]):[0-5]\d$/.test(trimmed)) {
											this.plugin.settings.defaultTargetTime = trimmed;
											nativeTimePicker.value = trimmed;
											await this.plugin.saveSettings();
											this.plugin.refreshBadgeUI();
										} else if (!trimmed) {
											this.plugin.settings.defaultTargetTime = DEFAULT_SETTINGS.defaultTargetTime;
											nativeTimePicker.value = DEFAULT_SETTINGS.defaultTargetTime;
											await this.plugin.saveSettings();
											this.plugin.refreshBadgeUI();
										}
									});
									text.inputEl.addEventListener('blur', () => {
										void (async () => {
											const trimmed = text.inputEl.value.trim();
											const norm = normalizeTimeInput(trimmed);
											if (norm) {
												this.plugin.settings.defaultTargetTime = norm;
												text.setValue(norm);
												nativeTimePicker.value = norm;
												await this.plugin.saveSettings();
												this.plugin.refreshBadgeUI();
											} else {
												text.setValue(this.plugin.settings.defaultTargetTime || DEFAULT_SETTINGS.defaultTargetTime);
												nativeTimePicker.value = this.plugin.settings.defaultTargetTime || DEFAULT_SETTINGS.defaultTargetTime;
											}
										})();
									});
								})
								.addExtraButton((btn) =>
									btn
										.setIcon('clock')
										.setTooltip(t('MODAL_TIME_PICKER_TOOLTIP'))
										.onClick(() => {
											const currentVal = textComponent?.getValue().trim();
											const normTime = normalizeTimeInput(currentVal ?? '');
											nativeTimePicker.value = normTime || this.plugin.settings.defaultTargetTime || DEFAULT_SETTINGS.defaultTargetTime;
											try {
												if (typeof nativeTimePicker.showPicker === 'function') {
													nativeTimePicker.showPicker();
												} else {
													nativeTimePicker.click();
												}
											} catch {
												nativeTimePicker.click();
											}
										}),
								)
								.addExtraButton((btn) =>
									btn
										.setIcon('rotate-ccw')
										.setTooltip(t('SETTINGS_RESET_DEFAULT'))
										.onClick(async () => {
											this.plugin.settings.defaultTargetTime = DEFAULT_SETTINGS.defaultTargetTime;
											nativeTimePicker.value = DEFAULT_SETTINGS.defaultTargetTime;
											await this.plugin.saveSettings();
											this.plugin.refreshBadgeUI();
											textComponent?.setValue(DEFAULT_SETTINGS.defaultTargetTime);
										}),
								);
						},
					},
					{
						name: t('SETTINGS_DATE_REFERENCE'),
						desc: t('SETTINGS_DATE_REFERENCE_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-date');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showDateProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showDateProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_DATE_REFERENCE'))
								.setDesc(t('SETTINGS_DATE_REFERENCE_DESC'))
								.addDropdown((dropdown) => {
									dropdown
										.addOption('none', t('SETTINGS_DATE_REFERENCE_NONE'))
										.addOption('parent', t('SETTINGS_DATE_REFERENCE_PARENT'))
										.addOption('note', t('SETTINGS_DATE_REFERENCE_NOTE'))
										.setValue(this.plugin.settings.defaultDateReference ?? 'parent')
										.onChange(async (val) => {
											this.plugin.settings.defaultDateReference = val as DateReferenceMode;
											await this.plugin.saveSettings();
											this.plugin.refreshBadgeUI();
										});
								});
						},
					},
					{
						name: t('SETTINGS_DATE_CYCLE'),
						desc: t('SETTINGS_DATE_CYCLE_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-date');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showDateProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showDateProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_DATE_CYCLE'))
								.setDesc(t('SETTINGS_DATE_CYCLE_DESC'));

							const parsedCycle = parseCycle(this.plugin.settings.defaultDateCycle);

							const cycleControl = setting.controlEl.createDiv({ cls: 'sgb-setting-cycle-control' });
							const cycleNumInput = cycleControl.createEl('input', {
								type: 'number',
								cls: 'sgb-folder-number-input sgb-folder-cycle-num-input',
								value: parsedCycle ? String(parsedCycle.value) : '1',
								attr: { min: '1', step: '1' },
							});
							const cycleUnitSelect = cycleControl.createEl('select', {
								cls: 'dropdown sgb-folder-style-select',
							});
							cycleUnitSelect.createEl('option', {
								value: 'none',
								text: t('MODAL_DATE_CYCLE_NONE'),
							});
							cycleUnitSelect.createEl('option', {
								value: 'day',
								text: t('MODAL_DATE_CYCLE_DAY'),
							});
							cycleUnitSelect.createEl('option', {
								value: 'week',
								text: t('MODAL_DATE_CYCLE_WEEK'),
							});
							cycleUnitSelect.createEl('option', {
								value: 'month',
								text: t('MODAL_DATE_CYCLE_MONTH'),
							});
							cycleUnitSelect.createEl('option', {
								value: 'year',
								text: t('MODAL_DATE_CYCLE_YEAR'),
							});
							if (parsedCycle) {
								cycleUnitSelect.value = parsedCycle.unit;
							} else {
								cycleUnitSelect.value = 'none';
							}
							const updateCycleVisibility = () => {
								cycleNumInput.style.display =
									cycleUnitSelect.value && cycleUnitSelect.value !== 'none' ? '' : 'none';
							};
							updateCycleVisibility();

							const updateCycleConfig = async () => {
								const unit = cycleUnitSelect.value;
								if (!unit || unit === 'none') {
									this.plugin.settings.defaultDateCycle = '';
								} else {
									const val = parseInt(cycleNumInput.value, 10);
									this.plugin.settings.defaultDateCycle = formatCycle({
										value: !isNaN(val) && val > 0 ? val : 1,
										unit: unit as DateCycle['unit'],
									});
								}
								await this.plugin.saveSettings();
								this.plugin.refreshBadgeUI();
								this.plugin.recalculateCounts();
							};
							cycleNumInput.addEventListener('change', () => {
								void updateCycleConfig();
							});
							cycleUnitSelect.addEventListener('change', () => {
								updateCycleVisibility();
								void updateCycleConfig();
							});

							setting.addExtraButton((btn) =>
								btn
									.setIcon('rotate-ccw')
									.setTooltip(t('SETTINGS_RESET_DEFAULT'))
									.onClick(async () => {
										this.plugin.settings.defaultDateCycle = '';
										cycleUnitSelect.value = 'none';
										cycleNumInput.value = '1';
										updateCycleVisibility();
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
										this.plugin.recalculateCounts();
									}),
							);
						},
					},
					{
						name: t('SETTINGS_DATE_PROGRESS_BAR'),
						desc: t('SETTINGS_DATE_PROGRESS_BAR_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-date');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showDateProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showDateProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_DATE_PROGRESS_BAR'))
								.setDesc(t('SETTINGS_DATE_PROGRESS_BAR_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showDateProgressBar).onChange(async (val) => {
										this.plugin.settings.showDateProgressBar = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
										this.updateGroupVisibility(setting.settingEl);
									}),
								);
						},
					},
					{
						name: t('SETTINGS_DATE_ICON'),
						desc: t('SETTINGS_DATE_ICON_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-date');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showDateProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showDateProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_DATE_ICON'))
								.setDesc(t('SETTINGS_DATE_ICON_DESC'))
								.addToggle((toggle) =>
									toggle.setValue(this.plugin.settings.showDateIcon).onChange(async (val) => {
										this.plugin.settings.showDateIcon = val;
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									}),
								);
						},
					},
					{
						name: t('SETTINGS_DATE_LABEL'),
						desc: t('SETTINGS_DATE_LABEL_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-date');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showDateProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showDateProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_DATE_LABEL'))
								.setDesc(t('SETTINGS_DATE_LABEL_DESC'))
								.addText((text) =>
									text
										.setPlaceholder(t('BADGE_DATE_LABEL'))
										.setValue(this.plugin.settings.dateLabel ?? '')
										.onChange(async (val) => {
											this.plugin.settings.dateLabel = val;
											await this.plugin.saveSettings();
											this.plugin.refreshBadgeUI();
										}),
								);
						},
					},
					{
						name: t('SETTINGS_DATE_OVERDUE_LABEL'),
						desc: t('SETTINGS_DATE_OVERDUE_LABEL_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-date');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showDateProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showDateProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_DATE_OVERDUE_LABEL'))
								.setDesc(t('SETTINGS_DATE_OVERDUE_LABEL_DESC'))
								.addText((text) =>
									text
										.setPlaceholder(t('BADGE_DATE_OVERDUE_LABEL'))
										.setValue(this.plugin.settings.dateOverdueLabel ?? '')
										.onChange(async (val) => {
											this.plugin.settings.dateOverdueLabel = val;
											await this.plugin.saveSettings();
											this.plugin.refreshBadgeUI();
										}),
								);
						},
					},
					{
						name: t('SETTINGS_DATE_UNIT_DAYS'),
						desc: t('SETTINGS_DATE_UNIT_DAYS_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-date');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showDateProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showDateProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_DATE_UNIT_DAYS'))
								.setDesc(t('SETTINGS_DATE_UNIT_DAYS_DESC'))
								.addText((text) =>
									text
										.setPlaceholder(t('BADGE_DAYS_UNIT'))
										.setValue(this.plugin.settings.dateUnitDays ?? '')
										.onChange(async (val) => {
											this.plugin.settings.dateUnitDays = val;
											await this.plugin.saveSettings();
											this.plugin.refreshBadgeUI();
										}),
								);
						},
					},
					{
						name: t('SETTINGS_DATE_UNIT_HOURS'),
						desc: t('SETTINGS_DATE_UNIT_HOURS_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-date');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showDateProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showDateProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_DATE_UNIT_HOURS'))
								.setDesc(t('SETTINGS_DATE_UNIT_HOURS_DESC'))
								.addText((text) =>
									text
										.setPlaceholder(t('BADGE_HOURS_UNIT'))
										.setValue(this.plugin.settings.dateUnitHours ?? '')
										.onChange(async (val) => {
											this.plugin.settings.dateUnitHours = val;
											await this.plugin.saveSettings();
											this.plugin.refreshBadgeUI();
										}),
								);
						},
					},
					{
						name: t('SETTINGS_DATE_THRESHOLD_WARN'),
						desc: t('SETTINGS_DATE_THRESHOLD_WARN_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-date');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showDateProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showDateProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_DATE_THRESHOLD_WARN'))
								.setDesc(t('SETTINGS_DATE_THRESHOLD_WARN_DESC'));
							const circle = createSpan({ cls: 'sgb-color-preview-circle sgb-date-swatch-warn' });
							circle.style.backgroundColor =
								this.plugin.settings.dateColorWarn || DEFAULT_SETTINGS.dateColorWarn;
							setting.nameEl.prepend(circle);
							setting.addText((text) => {
								text.inputEl.type = 'number';
								text.setPlaceholder(String(DEFAULT_SETTINGS.dateThresholdWarn));
								text.setValue(String(this.plugin.settings.dateThresholdWarn ?? 50));
								text.onChange(async (newVal) => {
									const num = parseFloat(newVal);
									this.plugin.settings.dateThresholdWarn = !isNaN(num)
										? num
										: DEFAULT_SETTINGS.dateThresholdWarn;
									await this.plugin.saveSettings();
									this.plugin.refreshBadgeUI();
								});
							});
						},
					},
					{
						name: t('SETTINGS_DATE_THRESHOLD_URGENT'),
						desc: t('SETTINGS_DATE_THRESHOLD_URGENT_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-date');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showDateProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showDateProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_DATE_THRESHOLD_URGENT'))
								.setDesc(t('SETTINGS_DATE_THRESHOLD_URGENT_DESC'));
							const circle = createSpan({ cls: 'sgb-color-preview-circle sgb-date-swatch-urgent' });
							circle.style.backgroundColor =
								this.plugin.settings.dateColorUrgent || DEFAULT_SETTINGS.dateColorUrgent;
							setting.nameEl.prepend(circle);
							setting.addText((text) => {
								text.inputEl.type = 'number';
								text.setPlaceholder(String(DEFAULT_SETTINGS.dateThresholdUrgent));
								text.setValue(String(this.plugin.settings.dateThresholdUrgent ?? 75));
								text.onChange(async (newVal) => {
									const num = parseFloat(newVal);
									this.plugin.settings.dateThresholdUrgent = !isNaN(num)
										? num
										: DEFAULT_SETTINGS.dateThresholdUrgent;
									await this.plugin.saveSettings();
									this.plugin.refreshBadgeUI();
								});
							});
						},
					},
					{
						name: t('SETTINGS_DATE_THRESHOLD_OVERDUE'),
						desc: t('SETTINGS_DATE_THRESHOLD_OVERDUE_DESC'),
						render: (setting: Setting) => {
							setting.settingEl.addClass('sgb-group-date');
							setting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showDateProgress);
							setting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showDateProgress ? '' : 'none',
								'important',
							);
							setting
								.setName(t('SETTINGS_DATE_THRESHOLD_OVERDUE'))
								.setDesc(t('SETTINGS_DATE_THRESHOLD_OVERDUE_DESC'));
							const circle = createSpan({ cls: 'sgb-color-preview-circle sgb-date-swatch-overdue' });
							circle.style.backgroundColor =
								this.plugin.settings.dateColorOverdue || DEFAULT_SETTINGS.dateColorOverdue;
							setting.nameEl.prepend(circle);
							setting.addText((text) => {
								text.inputEl.type = 'number';
								text.setPlaceholder(String(DEFAULT_SETTINGS.dateThresholdOverdue));
								text.setValue(String(this.plugin.settings.dateThresholdOverdue ?? 100));
								text.onChange(async (newVal) => {
									const num = parseFloat(newVal);
									this.plugin.settings.dateThresholdOverdue = !isNaN(num)
										? num
										: DEFAULT_SETTINGS.dateThresholdOverdue;
									await this.plugin.saveSettings();
									this.plugin.refreshBadgeUI();
								});
							});
						},
					},
					{
						render: (colorsSetting: Setting) => {
							colorsSetting.settingEl.addClass('sgb-group-date');
							colorsSetting.settingEl.addClass('sgb-group-date-colors');
							colorsSetting.settingEl.classList.toggle('sgb-is-hidden', !this.plugin.settings.showDateProgress);
							colorsSetting.settingEl.style.setProperty(
								'display',
								this.plugin.settings.showDateProgress ? '' : 'none',
								'important',
							);
							colorsSetting.infoEl.remove();

							const cardEl = colorsSetting.controlEl.createDiv({ cls: 'sgb-style-card sgb-date-colors-card' });

							// Card Header: Label & Reset Button
							const headerEl = cardEl.createDiv({ cls: 'sgb-style-card-header' });
							const nameWrapper = headerEl.createDiv({ cls: 'sgb-style-name-wrapper' });
							nameWrapper.createSpan({
								cls: 'sgb-style-name-label',
								text: t('SETTINGS_DATE_COLORS'),
							});

							const updateFns: Array<() => void> = [];

							const actionsEl = headerEl.createDiv({ cls: 'sgb-style-card-actions' });
							const resetBtn = actionsEl.createEl('button', {
								cls: 'clickable-icon sgb-style-action-btn',
								title: t('SETTINGS_RESET_DEFAULT'),
							});
							setIcon(resetBtn, 'rotate-ccw');
							resetBtn.addEventListener('click', () => {
								void (async () => {
									this.plugin.settings.dateColorNormal = DEFAULT_SETTINGS.dateColorNormal;
									this.plugin.settings.dateColorWarn = DEFAULT_SETTINGS.dateColorWarn;
									this.plugin.settings.dateColorUrgent = DEFAULT_SETTINGS.dateColorUrgent;
									this.plugin.settings.dateColorOverdue = DEFAULT_SETTINGS.dateColorOverdue;
									await this.plugin.saveSettings();
									this.plugin.refreshBadgeUI();
									for (const fn of updateFns) {
										fn();
									}
								})();
							});

							const gridEl = cardEl.createDiv({
								cls: 'sgb-style-colors-grid sgb-date-colors-grid',
							});

							const colorKeys: Array<{
								key: 'dateColorNormal' | 'dateColorWarn' | 'dateColorUrgent' | 'dateColorOverdue';
								label: string;
								defaultColor: string;
								swatchClass?: string;
							}> = [
									{
										key: 'dateColorNormal',
										label: t('SETTINGS_DATE_COLOR_NORMAL'),
										defaultColor: DEFAULT_SETTINGS.dateColorNormal,
									},
									{
										key: 'dateColorWarn',
										label: t('SETTINGS_DATE_COLOR_WARN'),
										defaultColor: DEFAULT_SETTINGS.dateColorWarn,
										swatchClass: 'sgb-date-swatch-warn',
									},
									{
										key: 'dateColorUrgent',
										label: t('SETTINGS_DATE_COLOR_URGENT'),
										defaultColor: DEFAULT_SETTINGS.dateColorUrgent,
										swatchClass: 'sgb-date-swatch-urgent',
									},
									{
										key: 'dateColorOverdue',
										label: t('SETTINGS_DATE_COLOR_OVERDUE'),
										defaultColor: DEFAULT_SETTINGS.dateColorOverdue,
										swatchClass: 'sgb-date-swatch-overdue',
									},
								];

							const root = this.getTabRoot(colorsSetting.settingEl);

							for (const item of colorKeys) {
								const colorItemEl = gridEl.createDiv({ cls: 'sgb-style-color-item' });
								colorItemEl.createSpan({ cls: 'sgb-style-color-label', text: item.label });

								const colorPickerWrapper = colorItemEl.createDiv({
									cls: 'sgb-style-color-picker-wrapper',
								});
								const colorInput = colorPickerWrapper.createEl('input', {
									type: 'color',
									cls: 'sgb-style-color-input',
									value: this.plugin.settings[item.key] || item.defaultColor,
								});
								const hexInput = colorPickerWrapper.createEl('input', {
									type: 'text',
									cls: 'sgb-style-hex-input',
									value: this.plugin.settings[item.key] || item.defaultColor,
									placeholder: item.defaultColor,
								});

								const updateSwatch = (colorVal: string) => {
									if (item.swatchClass) {
										root.querySelectorAll<HTMLElement>(`.${item.swatchClass}`).forEach((swatchEl) => {
											swatchEl.style.backgroundColor = colorVal;
										});
									}
								};

								colorInput.addEventListener('input', () => {
									void (async () => {
										const val = colorInput.value;
										this.plugin.settings[item.key] = val;
										hexInput.value = val;
										updateSwatch(val);
										await this.plugin.saveSettings();
										this.plugin.refreshBadgeUI();
									})();
								});

								const handleHexChange = () => {
									void (async () => {
										let val = hexInput.value.trim();
										if (!val.startsWith('#') && /^[0-9a-fA-F]{3,6}$/.test(val)) {
											val = '#' + val;
										}
										if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)) {
											if (val.length === 4) {
												val = `#${val[1]}${val[1]}${val[2]}${val[2]}${val[3]}${val[3]}`;
											}
											this.plugin.settings[item.key] = val;
											colorInput.value = val;
											hexInput.value = val;
											updateSwatch(val);
											await this.plugin.saveSettings();
											this.plugin.refreshBadgeUI();
										} else {
											hexInput.value = this.plugin.settings[item.key] || item.defaultColor;
										}
									})();
								};

								hexInput.addEventListener('change', handleHexChange);
								hexInput.addEventListener('blur', handleHexChange);

								updateFns.push(() => {
									colorInput.value = item.defaultColor;
									hexInput.value = item.defaultColor;
									updateSwatch(item.defaultColor);
								});
							}
						},
					},
				],
			},

			// Group 9: Folder Goals
			{
				type: 'group',
				heading: t('SETTINGS_HEADING_FOLDER_GOALS'),
				items: [
					{
						render: (folderGoalsSetting: Setting) => {
							this.attachHeadingIcon(folderGoalsSetting, 'folder');
							folderGoalsSetting.settingEl.addClass('sgb-folder-goals-setting');
							folderGoalsSetting.infoEl.remove();

							const container = folderGoalsSetting.controlEl.createDiv({
								cls: 'sgb-folder-goals-container',
							});

							container.createDiv({
								cls: 'sgb-folder-goals-desc',
								text: t('SETTINGS_FOLDER_GOALS_DESC'),
							});

							const listEl = container.createDiv({ cls: 'sgb-folder-goals-list' });

							const renderList = () => {
								listEl.empty();

								if (!this.plugin.settings.folderGoals || this.plugin.settings.folderGoals.length === 0) {
									listEl.createDiv({
										cls: 'sgb-folder-goals-empty',
										text: t('SETTINGS_FOLDER_EMPTY_LIST'),
									});
								} else {
									this.plugin.settings.folderGoals.forEach((folderConfig) => {
										const isCardExpanded = this.expandedFolderCardIds.has(folderConfig.id);
										const cardEl = listEl.createDiv({
											cls: `sgb-folder-goal-card ${isCardExpanded ? 'is-expanded' : 'is-collapsed'}`,
										});
										cardEl.setAttribute('data-folder-id', folderConfig.id);

										// Header
										const headerEl = cardEl.createDiv({ cls: 'sgb-folder-card-header' });

										const headerLeft = headerEl.createDiv({ cls: 'sgb-folder-card-header-left' });
										const chevronEl = headerLeft.createSpan({ cls: 'sgb-folder-card-chevron' });
										setIcon(chevronEl, isCardExpanded ? 'chevron-down' : 'chevron-right');

										const folderIconEl = headerLeft.createSpan({ cls: 'sgb-folder-card-icon' });
										setIcon(folderIconEl, 'folder');

										const titleText = folderConfig.folderPath || t('SETTINGS_FOLDER_SELECT_PLACEHOLDER');
										const titleEl = headerLeft.createSpan({
											cls: `sgb-folder-card-title ${!folderConfig.folderPath ? 'is-placeholder' : ''}`,
											text: titleText,
										});

										headerLeft.addEventListener('click', () => {
											if (this.expandedFolderCardIds.has(folderConfig.id)) {
												this.expandedFolderCardIds.delete(folderConfig.id);
											} else {
												this.expandedFolderCardIds.add(folderConfig.id);
											}
											renderList();
										});

										const headerRight = headerEl.createDiv({ cls: 'sgb-folder-card-header-right' });
										const deleteBtn = headerRight.createEl('button', {
											cls: 'clickable-icon sgb-folder-action-btn mod-warning',
											title: t('SETTINGS_FOLDER_GOAL_DELETE'),
										});
										setIcon(deleteBtn, 'trash-2');
										deleteBtn.addEventListener('click', (e) => {
											e.stopPropagation();
											void (async () => {
												this.plugin.settings.folderGoals = this.plugin.settings.folderGoals.filter(
													(f) => f.id !== folderConfig.id,
												);
												this.expandedFolderCardIds.delete(folderConfig.id);
												this.expandedFolderHeadingIds.delete(folderConfig.id);
												await this.plugin.saveSettings();
												this.plugin.refreshBadgeUI();
												this.plugin.recalculateCounts();
												renderList();
											})();
										});

										// Body (when expanded)
										if (isCardExpanded) {
											const bodyEl = cardEl.createDiv({ cls: 'sgb-folder-card-body' });

											// 1. Folder path input with Suggest
											const pathRow = bodyEl.createDiv({ cls: 'sgb-folder-card-row' });
											pathRow.createSpan({
												cls: 'sgb-folder-row-label',
												text: t('SETTINGS_FOLDER_PATH_LABEL'),
											});
											const pathInput = pathRow.createEl('input', {
												type: 'text',
												cls: 'sgb-folder-path-input',
												placeholder: t('SETTINGS_FOLDER_PATH_PLACEHOLDER'),
												value: folderConfig.folderPath,
											});
											new FolderSuggest(this.app, pathInput);
											pathInput.addEventListener('change', () => {
												void (async () => {
													const rawVal = pathInput.value.trim();
													const normalized = rawVal.replace(/^\/+|\/+$/g, '');

													if (normalized) {
														const isDuplicate = this.plugin.settings.folderGoals.some(
															(f) =>
																f.id !== folderConfig.id &&
																f.folderPath.trim().replace(/^\/+|\/+$/g, '') === normalized,
														);
														if (isDuplicate) {
															new Notice(t('SETTINGS_FOLDER_DUPLICATE_NOTICE'));
															pathInput.value = folderConfig.folderPath;
															return;
														}
													}

													folderConfig.folderPath = rawVal;
													titleEl.setText(folderConfig.folderPath || t('SETTINGS_FOLDER_SELECT_PLACEHOLDER'));
													titleEl.classList.toggle('is-placeholder', !folderConfig.folderPath);
													await this.plugin.saveSettings();
													this.plugin.refreshBadgeUI();
													this.plugin.recalculateCounts();
												})();
											});

											// Section Header: Word Count Goals
											const countSectionHeader = bodyEl.createDiv({ cls: 'sgb-folder-section-header' });
											const countTitle = countSectionHeader.createSpan({ cls: 'sgb-folder-section-title' });
											const countIcon = countTitle.createSpan();
											setIcon(countIcon, 'file-text');
											countTitle.createSpan({ text: t('SETTINGS_FOLDER_SECTION_COUNT') });

											// 2. Note Total Goal
											const totalRow = bodyEl.createDiv({ cls: 'sgb-folder-card-row' });
											totalRow.createSpan({
												cls: 'sgb-folder-row-label',
												text: t('SETTINGS_FOLDER_TOTAL_GOAL'),
											});
											const totalInput = totalRow.createEl('input', {
												type: 'number',
												cls: 'sgb-folder-number-input',
												placeholder: t('SETTINGS_FOLDER_UNSET_PLACEHOLDER'),
												value: folderConfig.fileGoal ? String(folderConfig.fileGoal) : '',
												attr: { min: '0', step: '1' },
											});
											totalInput.addEventListener('change', () => {
												void (async () => {
													const val = parseInt(totalInput.value, 10);
													folderConfig.fileGoal = !isNaN(val) && val > 0 ? val : undefined;
													await this.plugin.saveSettings();
													this.plugin.refreshBadgeUI();
													this.plugin.recalculateCounts();
												})();
											});

											// 3. Section Default Goal
											const secRow = bodyEl.createDiv({ cls: 'sgb-folder-card-row' });
											secRow.createSpan({
												cls: 'sgb-folder-row-label',
												text: t('SETTINGS_FOLDER_SECTION_GOAL'),
											});
											const secInput = secRow.createEl('input', {
												type: 'number',
												cls: 'sgb-folder-number-input',
												placeholder: t('SETTINGS_FOLDER_UNSET_PLACEHOLDER'),
												value: folderConfig.defaultSectionGoal ? String(folderConfig.defaultSectionGoal) : '',
												attr: { min: '0', step: '1' },
											});
											secInput.addEventListener('change', () => {
												void (async () => {
													const val = parseInt(secInput.value, 10);
													folderConfig.defaultSectionGoal = !isNaN(val) && val > 0 ? val : undefined;
													await this.plugin.saveSettings();
													this.plugin.refreshBadgeUI();
													this.plugin.recalculateCounts();
												})();
											});

											// 4. Heading Level Goals Accordion
											const isHeadingsExpanded = this.expandedFolderHeadingIds.has(folderConfig.id);
											const headingsAccordionHeader = bodyEl.createDiv({
												cls: 'sgb-folder-headings-accordion-header',
											});
											const hChevron = headingsAccordionHeader.createSpan({
												cls: 'sgb-folder-headings-chevron',
											});
											setIcon(hChevron, isHeadingsExpanded ? 'chevron-down' : 'chevron-right');
											headingsAccordionHeader.createSpan({
												cls: 'sgb-folder-headings-title',
												text: t('SETTINGS_FOLDER_HEADING_GOALS_ACCORDION'),
											});

											headingsAccordionHeader.addEventListener('click', () => {
												if (this.expandedFolderHeadingIds.has(folderConfig.id)) {
													this.expandedFolderHeadingIds.delete(folderConfig.id);
												} else {
													this.expandedFolderHeadingIds.add(folderConfig.id);
												}
												renderList();
											});

											if (isHeadingsExpanded) {
												const headingsGrid = bodyEl.createDiv({
													cls: 'sgb-folder-headings-grid',
												});
												for (let level = 1; level <= 6; level++) {
													const hItem = headingsGrid.createDiv({
														cls: 'sgb-folder-heading-item',
													});
													const hLabel = hItem.createSpan({
														cls: 'sgb-folder-heading-label',
													});
													hLabel.title = `H${level}`;
													const hIcon = hLabel.createSpan({
														cls: 'sgb-folder-heading-icon',
													});
													setIcon(hIcon, `heading-${level}`);

													const hInput = hItem.createEl('input', {
														type: 'number',
														cls: 'sgb-folder-number-input sgb-folder-heading-input',
														placeholder: t('SETTINGS_FOLDER_UNSET_PLACEHOLDER'),
														value: folderConfig.headingLevelGoals?.[level]
															? String(folderConfig.headingLevelGoals[level])
															: '',
														attr: { min: '0', step: '1' },
													});

													hInput.addEventListener('change', () => {
														void (async () => {
															const val = parseInt(hInput.value, 10);
															if (!folderConfig.headingLevelGoals) {
																folderConfig.headingLevelGoals = {};
															}
															if (!isNaN(val) && val > 0) {
																folderConfig.headingLevelGoals[level] = val;
															} else {
																delete folderConfig.headingLevelGoals[level];
															}
															await this.plugin.saveSettings();
															this.plugin.refreshBadgeUI();
															this.plugin.recalculateCounts();
														})();
													});
												}
											}

											// 5. Color Style Dropdown
											const styleRow = bodyEl.createDiv({ cls: 'sgb-folder-card-row' });
											styleRow.createSpan({
												cls: 'sgb-folder-row-label',
												text: t('SETTINGS_FOLDER_STYLE_LABEL'),
											});
											const styleSelect = styleRow.createEl('select', {
												cls: 'dropdown sgb-folder-style-select',
											});
											// Option for inherit/default
											const defaultOpt = styleSelect.createEl('option', {
												value: '',
												text: t('SETTINGS_FOLDER_STYLE_INHERIT'),
											});
											if (folderConfig.styleId === undefined) {
												defaultOpt.selected = true;
											}
											for (const style of this.plugin.settings.styles) {
												const opt = styleSelect.createEl('option', {
													value: String(style.id),
													text: style.name,
												});
												if (folderConfig.styleId === style.id) {
													opt.selected = true;
												}
											}
											styleSelect.addEventListener('change', () => {
												void (async () => {
													if (!styleSelect.value) {
														folderConfig.styleId = undefined;
													} else {
														const parsed = parseInt(styleSelect.value, 10);
														folderConfig.styleId = !isNaN(parsed) ? parsed : undefined;
													}
													await this.plugin.saveSettings();
													this.plugin.refreshBadgeUI();
													this.plugin.recalculateCounts();
												})();
											});

											// Section Header: Date Goals
											const dateSectionHeader = bodyEl.createDiv({ cls: 'sgb-folder-section-header' });
											const dateTitle = dateSectionHeader.createSpan({ cls: 'sgb-folder-section-title' });
											const dateIcon = dateTitle.createSpan();
											setIcon(dateIcon, 'calendar');
											dateTitle.createSpan({ text: t('SETTINGS_FOLDER_SECTION_DATE') });

											// 6. Default Date Reference
											const refRow = bodyEl.createDiv({ cls: 'sgb-folder-card-row' });
											refRow.createSpan({
												cls: 'sgb-folder-row-label',
												text: t('SETTINGS_DATE_REFERENCE'),
											});
											const refSelect = refRow.createEl('select', {
												cls: 'dropdown sgb-folder-style-select',
											});
											refSelect.createEl('option', {
												value: '',
												text: t('SETTINGS_FOLDER_DATE_REF_INHERIT'),
											});
											refSelect.createEl('option', {
												value: 'none',
												text: t('SETTINGS_DATE_REFERENCE_NONE'),
											});
											refSelect.createEl('option', {
												value: 'parent',
												text: t('SETTINGS_DATE_REFERENCE_PARENT'),
											});
											refSelect.createEl('option', {
												value: 'note',
												text: t('SETTINGS_DATE_REFERENCE_NOTE'),
											});
											refSelect.value = folderConfig.defaultDateReference ?? '';
											refSelect.addEventListener('change', () => {
												void (async () => {
													if (!refSelect.value) {
														delete folderConfig.defaultDateReference;
													} else {
														folderConfig.defaultDateReference = refSelect.value as DateReferenceMode;
													}
													await this.plugin.saveSettings();
													this.plugin.refreshBadgeUI();
													this.plugin.recalculateCounts();
												})();
											});

											// 7. Relative Date Calculation (Cycle)
											const cycleRow = bodyEl.createDiv({ cls: 'sgb-folder-card-row' });
											cycleRow.createSpan({
												cls: 'sgb-folder-row-label',
												text: t('SETTINGS_FOLDER_CYCLE_LABEL'),
											});
											const cycleControl = cycleRow.createDiv({ cls: 'sgb-folder-cycle-control' });
											const parsedCycle = parseCycle(folderConfig.defaultCycle);
											const cycleNumInput = cycleControl.createEl('input', {
												type: 'number',
												cls: 'sgb-folder-number-input sgb-folder-cycle-num-input',
												value: parsedCycle ? String(parsedCycle.value) : '1',
												attr: { min: '1', step: '1' },
											});
											const cycleUnitSelect = cycleControl.createEl('select', {
												cls: 'dropdown sgb-folder-style-select',
											});
											cycleUnitSelect.createEl('option', {
												value: '',
												text: t('SETTINGS_FOLDER_DATE_REF_INHERIT'),
											});
											cycleUnitSelect.createEl('option', {
												value: 'none',
												text: t('MODAL_DATE_CYCLE_NONE'),
											});
											cycleUnitSelect.createEl('option', {
												value: 'day',
												text: t('MODAL_DATE_CYCLE_DAY'),
											});
											cycleUnitSelect.createEl('option', {
												value: 'week',
												text: t('MODAL_DATE_CYCLE_WEEK'),
											});
											cycleUnitSelect.createEl('option', {
												value: 'month',
												text: t('MODAL_DATE_CYCLE_MONTH'),
											});
											cycleUnitSelect.createEl('option', {
												value: 'year',
												text: t('MODAL_DATE_CYCLE_YEAR'),
											});
											if (folderConfig.defaultCycle === 'none') {
												cycleUnitSelect.value = 'none';
											} else if (parsedCycle) {
												cycleUnitSelect.value = parsedCycle.unit;
											} else {
												cycleUnitSelect.value = '';
											}
											const updateCycleVisibility = () => {
												cycleNumInput.style.display =
													cycleUnitSelect.value && cycleUnitSelect.value !== 'none' ? '' : 'none';
											};
											updateCycleVisibility();

											const updateCycleConfig = async () => {
												const unit = cycleUnitSelect.value;
												if (!unit) {
													delete folderConfig.defaultCycle;
												} else if (unit === 'none') {
													folderConfig.defaultCycle = 'none';
												} else {
													const val = parseInt(cycleNumInput.value, 10);
													folderConfig.defaultCycle = formatCycle({
														value: !isNaN(val) && val > 0 ? val : 1,
														unit: unit as DateCycle['unit'],
													});
												}
												await this.plugin.saveSettings();
												this.plugin.refreshBadgeUI();
												this.plugin.recalculateCounts();
											};
											cycleNumInput.addEventListener('change', () => {
												void updateCycleConfig();
											});
											cycleUnitSelect.addEventListener('change', () => {
												updateCycleVisibility();
												void updateCycleConfig();
											});

											// 8. Start Time
											const startRow = bodyEl.createDiv({ cls: 'sgb-folder-card-row' });
											startRow.createSpan({
												cls: 'sgb-folder-row-label',
												text: t('SETTINGS_DEFAULT_START_TIME'),
											});
											const startControl = startRow.createDiv({ cls: 'sgb-folder-time-control' });
											const startInput = startControl.createEl('input', {
												type: 'text',
												cls: 'sgb-folder-time-input',
												value: folderConfig.defaultStartTime ?? '',
												placeholder: this.plugin.settings.defaultStartTime || '00:00',
											});
											const nativeStartPicker = startControl.createEl('input', {
												type: 'time',
												cls: 'sgb-native-date-picker',
												value: folderConfig.defaultStartTime || this.plugin.settings.defaultStartTime || '00:00',
											});
											const startClockBtn = startControl.createEl('button', {
												cls: 'clickable-icon sgb-folder-time-btn',
												attr: { type: 'button', 'aria-label': t('MODAL_TIME_PICKER_TOOLTIP') },
											});
											setIcon(startClockBtn, 'clock');
											setTooltip(startClockBtn, t('MODAL_TIME_PICKER_TOOLTIP'));

											const startResetBtn = startControl.createEl('button', {
												cls: 'clickable-icon sgb-folder-time-btn',
												attr: { type: 'button', 'aria-label': t('SETTINGS_RESET_DEFAULT') },
											});
											setIcon(startResetBtn, 'rotate-ccw');
											setTooltip(startResetBtn, t('SETTINGS_RESET_DEFAULT'));

											const saveStartTime = async () => {
												const trimmed = startInput.value.trim();
												const normalized = normalizeTimeInput(trimmed);
												if (normalized) {
													startInput.value = normalized;
													folderConfig.defaultStartTime = normalized;
													nativeStartPicker.value = normalized;
												} else if (!trimmed) {
													startInput.value = '';
													delete folderConfig.defaultStartTime;
													nativeStartPicker.value = this.plugin.settings.defaultStartTime || '00:00';
												} else {
													startInput.value = folderConfig.defaultStartTime ?? '';
													nativeStartPicker.value = folderConfig.defaultStartTime || this.plugin.settings.defaultStartTime || '00:00';
													return;
												}
												await this.plugin.saveSettings();
												this.plugin.refreshBadgeUI();
												this.plugin.recalculateCounts();
											};
											startInput.addEventListener('change', () => {
												void saveStartTime();
											});
											startInput.addEventListener('blur', () => {
												void saveStartTime();
											});
											startClockBtn.addEventListener('click', (e) => {
												e.preventDefault();
												const norm = normalizeTimeInput(startInput.value.trim());
												nativeStartPicker.value = norm || this.plugin.settings.defaultStartTime || '00:00';
												try {
													if (typeof nativeStartPicker.showPicker === 'function') {
														nativeStartPicker.showPicker();
													} else {
														nativeStartPicker.click();
													}
												} catch {
													nativeStartPicker.click();
												}
											});
											nativeStartPicker.addEventListener('change', () => {
												const val = nativeStartPicker.value.trim();
												if (val) {
													startInput.value = val;
													void saveStartTime();
												}
											});
											startResetBtn.addEventListener('click', (e) => {
												e.preventDefault();
												startInput.value = '';
												delete folderConfig.defaultStartTime;
												nativeStartPicker.value = this.plugin.settings.defaultStartTime || '00:00';
												void (async () => {
													await this.plugin.saveSettings();
													this.plugin.refreshBadgeUI();
													this.plugin.recalculateCounts();
												})();
											});

											// 9. Target Time
											const targetRow = bodyEl.createDiv({ cls: 'sgb-folder-card-row' });
											targetRow.createSpan({
												cls: 'sgb-folder-row-label',
												text: t('SETTINGS_DEFAULT_TARGET_TIME'),
											});
											const targetControl = targetRow.createDiv({ cls: 'sgb-folder-time-control' });
											const targetInput = targetControl.createEl('input', {
												type: 'text',
												cls: 'sgb-folder-time-input',
												value: folderConfig.defaultTargetTime ?? '',
												placeholder: this.plugin.settings.defaultTargetTime || '23:59',
											});
											const nativeTargetPicker = targetControl.createEl('input', {
												type: 'time',
												cls: 'sgb-native-date-picker',
												value: folderConfig.defaultTargetTime || this.plugin.settings.defaultTargetTime || '23:59',
											});
											const targetClockBtn = targetControl.createEl('button', {
												cls: 'clickable-icon sgb-folder-time-btn',
												attr: { type: 'button', 'aria-label': t('MODAL_TIME_PICKER_TOOLTIP') },
											});
											setIcon(targetClockBtn, 'clock');
											setTooltip(targetClockBtn, t('MODAL_TIME_PICKER_TOOLTIP'));

											const targetResetBtn = targetControl.createEl('button', {
												cls: 'clickable-icon sgb-folder-time-btn',
												attr: { type: 'button', 'aria-label': t('SETTINGS_RESET_DEFAULT') },
											});
											setIcon(targetResetBtn, 'rotate-ccw');
											setTooltip(targetResetBtn, t('SETTINGS_RESET_DEFAULT'));

											const saveTargetTime = async () => {
												const trimmed = targetInput.value.trim();
												const normalized = normalizeTimeInput(trimmed);
												if (normalized) {
													targetInput.value = normalized;
													folderConfig.defaultTargetTime = normalized;
													nativeTargetPicker.value = normalized;
												} else if (!trimmed) {
													targetInput.value = '';
													delete folderConfig.defaultTargetTime;
													nativeTargetPicker.value = this.plugin.settings.defaultTargetTime || '23:59';
												} else {
													targetInput.value = folderConfig.defaultTargetTime ?? '';
													nativeTargetPicker.value = folderConfig.defaultTargetTime || this.plugin.settings.defaultTargetTime || '23:59';
													return;
												}
												await this.plugin.saveSettings();
												this.plugin.refreshBadgeUI();
												this.plugin.recalculateCounts();
											};
											targetInput.addEventListener('change', () => {
												void saveTargetTime();
											});
											targetInput.addEventListener('blur', () => {
												void saveTargetTime();
											});
											targetClockBtn.addEventListener('click', (e) => {
												e.preventDefault();
												const norm = normalizeTimeInput(targetInput.value.trim());
												nativeTargetPicker.value = norm || this.plugin.settings.defaultTargetTime || '23:59';
												try {
													if (typeof nativeTargetPicker.showPicker === 'function') {
														nativeTargetPicker.showPicker();
													} else {
														nativeTargetPicker.click();
													}
												} catch {
													nativeTargetPicker.click();
												}
											});
											nativeTargetPicker.addEventListener('change', () => {
												const val = nativeTargetPicker.value.trim();
												if (val) {
													targetInput.value = val;
													void saveTargetTime();
												}
											});
											targetResetBtn.addEventListener('click', (e) => {
												e.preventDefault();
												targetInput.value = '';
												delete folderConfig.defaultTargetTime;
												nativeTargetPicker.value = this.plugin.settings.defaultTargetTime || '23:59';
												void (async () => {
													await this.plugin.saveSettings();
													this.plugin.refreshBadgeUI();
													this.plugin.recalculateCounts();
												})();
											});
										}
									});
								}
							};

							const footerEl = container.createDiv({ cls: 'sgb-folder-goals-footer' });
							const addBtn = footerEl.createEl('button', {
								cls: 'mod-cta sgb-add-folder-goal-btn',
								text: t('SETTINGS_FOLDER_GOAL_ADD'),
							});
							setIcon(addBtn.createSpan({ cls: 'sgb-btn-icon' }), 'plus');
							addBtn.addEventListener('click', () => {
								void (async () => {
									if (!Array.isArray(this.plugin.settings.folderGoals)) {
										this.plugin.settings.folderGoals = [];
									}

									// If an unconfigured empty card already exists, reuse and expand it
									const existingEmpty = this.plugin.settings.folderGoals.find(
										(f) => !f.folderPath.trim(),
									);
									if (existingEmpty) {
										this.expandedFolderCardIds.add(existingEmpty.id);
										renderList();
										window.requestAnimationFrame(() => {
											const emptyCard = listEl.querySelector(`[data-folder-id="${existingEmpty.id}"]`);
											const input = emptyCard?.querySelector<HTMLInputElement>('.sgb-folder-path-input');
											input?.focus();
										});
										return;
									}

									const newId = String(Date.now());
									this.plugin.settings.folderGoals.push({
										id: newId,
										folderPath: '',
									});
									this.expandedFolderCardIds.add(newId);
									await this.plugin.saveSettings();
									renderList();
									window.requestAnimationFrame(() => {
										const lastCard = listEl.querySelector('.sgb-folder-goal-card:last-child');
										const input = lastCard?.querySelector<HTMLInputElement>('.sgb-folder-path-input');
										input?.focus();
									});
								})();
							});

							renderList();
						},
					},
				],
			},

			// Group: Support
			{
				type: 'group',
				heading: t('SETTINGS_HEADING_SUPPORT'),

				items: [
					{
						name: t('SETTINGS_DONATE'),
						desc: t('SETTINGS_DONATE_DESC'),
						render: (setting: Setting) => {
							this.attachHeadingIcon(setting, 'heart');
							setting
								.setName(t('SETTINGS_DONATE'))
								.setDesc(t('SETTINGS_DONATE_DESC'))
								.addButton((button) =>
									button
										.setButtonText(t('SETTINGS_DONATE_BUTTON'))
										.setCta()
										.onClick(() => {
											const fundingUrl =
												(this.plugin.manifest as { fundingUrl?: string }).fundingUrl ||
												'https://buymeacoffee.com/quels';
											window.open(fundingUrl, '_blank');
										}),
								);
						},
					},
				],
			},
		];
	}
}


