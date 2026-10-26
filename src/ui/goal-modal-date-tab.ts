import { App, DropdownComponent, Modal, setIcon, setTooltip } from 'obsidian';
import { EffectiveGoalData, FrontmatterManager } from '../frontmatter/frontmatter-manager';
import { t } from '../lang/helpers';
import { ParsedDocumentSections } from '../parser/section-parser';
import { DateCycle, DateReferenceMode, PluginSettings, SectionDateGoalItem, SectionNode } from '../types';
import { ConfirmModal } from './confirm-modal';
import {
	buildParentIndexMap,
	combineDateAndTime,
	extractDateAndTime,
	ChainConnectorState,
	computeChainConnectorStates,
	formatCycle,
	formatShortDate,
	getSectionEffectiveParentCycle,
	getWeekdayLabel,
	isValidDateOrTimeString,
	isValidDateString,
	matchSectionDateGoals,
	normalizeDateInput,
	normalizeTimeInput,
	parseCycle,
	resolveChainedDateGoals,
} from '../utils/date-goal';

/**
 * Formats a cycle string (e.g. '1w') into localized human-readable text (e.g. '1週後' or '1 Week(s) later').
 */
function formatCycleLocale(cycleStr: string | undefined | null): string {
	if (!cycleStr) return '';
	const c = parseCycle(cycleStr);
	if (!c) return cycleStr;
	const unitMap: Record<string, string> = {
		day: t('MODAL_DATE_CYCLE_DAY'),
		week: t('MODAL_DATE_CYCLE_WEEK'),
		month: t('MODAL_DATE_CYCLE_MONTH'),
		year: t('MODAL_DATE_CYCLE_YEAR'),
	};
	const unitText = unitMap[c.unit] || c.unit;
	return t('MODAL_DATE_CYCLE_DISPLAY', { value: c.value, unit: unitText });
}

/**
 * Sub-modal for configuring detailed date goal properties (start date/time, target date/time, cycle).
 */
export class DateDetailModal extends Modal {
	private titleText: string;
	private initialStartDate?: string;
	private initialStartTime?: string;
	private initialTargetDate?: string;
	private initialTargetTime?: string;
	private initialCycle?: string;
	private defaultStartTime: string;
	private defaultTargetTime: string;
	private parentFileCycle?: string;
	private isNoteTotal: boolean;
	private isFirstSection: boolean;
	private computePreviewDates?: (tempCycle: string | undefined) => { start?: string; target?: string };
	private onSave: (result: {
		startDate?: string;
		startTime?: string;
		targetDate?: string;
		targetTime?: string;
		cycle?: string;
	}) => void;

	constructor(
		app: App,
		titleText: string,
		initialStartDate: string | undefined,
		initialStartTime: string | undefined,
		initialTargetDate: string | undefined,
		initialTargetTime: string | undefined,
		initialCycle: string | undefined,
		defaultStartTime: string,
		defaultTargetTime: string,
		parentFileCycle: string | undefined,
		isNoteTotal: boolean,
		onSave: (result: {
			startDate?: string;
			startTime?: string;
			targetDate?: string;
			targetTime?: string;
			cycle?: string;
		}) => void,
		computePreviewDates?: (tempCycle: string | undefined) => { start?: string; target?: string },
		isFirstSection = false,
	) {
		super(app);
		this.titleText = titleText;
		this.initialStartDate = initialStartDate;
		this.initialStartTime = initialStartTime;
		this.initialTargetDate = initialTargetDate;
		this.initialTargetTime = initialTargetTime;
		this.initialCycle = initialCycle;
		this.defaultStartTime = defaultStartTime;
		this.defaultTargetTime = defaultTargetTime;
		this.parentFileCycle = parentFileCycle;
		this.isNoteTotal = isNoteTotal;
		this.computePreviewDates = computePreviewDates;
		this.onSave = onSave;
		this.isFirstSection = isFirstSection;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('sgb-date-detail-modal');

		contentEl.createEl('h3', { text: t('MODAL_DATE_DETAIL_TITLE') });

		let updateWeekdayDisplay: () => void = () => {};
		let updatePriorityNote: () => void = () => {};

		// Helper to create date + time row
		const createDateTimeRow = (
			labelText: string,
			initDate: string | undefined,
			initTime: string | undefined,
			defaultTime: string,
		) => {
			const row = contentEl.createDiv({ cls: 'sgb-detail-row' });
			row.createDiv({ cls: 'sgb-detail-label', text: labelText });

			const control = row.createDiv({ cls: 'sgb-detail-control' });

			// 1. Date Group (Date Input + Calendar Button + Date Clear Button)
			const dateGroup = control.createDiv({ cls: 'sgb-detail-group' });
			const dateWrapper = dateGroup.createDiv({ cls: 'sgb-date-input-wrapper sgb-modal-date-picker' });
			const dateInput = dateWrapper.createEl('input', {
				type: 'text',
				cls: 'sgb-goal-input sgb-date-text-input',
				value: formatShortDate(initDate),
				placeholder: DEFAULT_DATE_PLACEHOLDER,
			});
			const nativeDatePicker = dateWrapper.createEl('input', {
				type: 'date',
				cls: 'sgb-native-date-picker',
				value: normalizeDateInput(initDate) || '',
			});
			const calendarBtn = dateWrapper.createEl('button', {
				cls: 'clickable-icon sgb-date-calendar-btn',
				attr: { type: 'button', 'aria-label': t('MODAL_DATE_PICKER_TOOLTIP') },
			});
			setIcon(calendarBtn, 'calendar');
			setTooltip(calendarBtn, t('MODAL_DATE_PICKER_TOOLTIP'));

			calendarBtn.addEventListener('click', (e) => {
				e.preventDefault();
				const normalized = normalizeDateInput(dateInput.value);
				if (normalized) nativeDatePicker.value = normalized;
				try {
					if (typeof nativeDatePicker.showPicker === 'function') {
						nativeDatePicker.showPicker();
					} else {
						nativeDatePicker.click();
					}
				} catch {
					nativeDatePicker.click();
				}
			});

			nativeDatePicker.addEventListener('change', () => {
				const val = nativeDatePicker.value.trim();
				dateInput.value = formatShortDate(val);
				updateWeekdayDisplay();
				updatePriorityNote();
			});

			dateInput.addEventListener('input', () => {
				const norm = normalizeDateInput(dateInput.value.trim());
				if (norm) nativeDatePicker.value = norm;
				updateWeekdayDisplay();
				updatePriorityNote();
			});

			dateInput.addEventListener('blur', () => {
				const val = dateInput.value.trim();
				if (val) {
					const norm = normalizeDateInput(val);
					if (isValidDateString(norm)) {
						dateInput.value = formatShortDate(norm);
						nativeDatePicker.value = norm;
					}
				}
				updateWeekdayDisplay();
				updatePriorityNote();
			});

			const dateClearBtn = dateGroup.createEl('button', {
				cls: 'clickable-icon sgb-detail-clear-btn',
				text: '✕',
				attr: { type: 'button', 'aria-label': t('MODAL_CLEAR_DATE_TOOLTIP') },
			});
			setTooltip(dateClearBtn, t('MODAL_CLEAR_DATE_TOOLTIP'));
			dateClearBtn.addEventListener('click', (e) => {
				e.preventDefault();
				dateInput.value = '';
				nativeDatePicker.value = '';
				updateWeekdayDisplay();
				updatePriorityNote();
			});

			// 2. Time Group (Time Input + Clock Button + Time Clear Button)
			const timeGroup = control.createDiv({ cls: 'sgb-detail-group' });
			const timeWrapper = timeGroup.createDiv({ cls: 'sgb-date-input-wrapper sgb-modal-time-picker' });
			const timeInput = timeWrapper.createEl('input', {
				type: 'text',
				cls: 'sgb-goal-input sgb-date-text-input sgb-time-text-input',
				value: initTime || '',
				placeholder: defaultTime,
			});
			const nativeTimePicker = timeWrapper.createEl('input', {
				type: 'time',
				cls: 'sgb-native-date-picker',
				value: initTime || defaultTime,
			});
			const clockBtn = timeWrapper.createEl('button', {
				cls: 'clickable-icon sgb-time-picker-btn',
				attr: { type: 'button', 'aria-label': t('MODAL_TIME_PICKER_TOOLTIP') },
			});
			setIcon(clockBtn, 'clock');
			setTooltip(clockBtn, t('MODAL_TIME_PICKER_TOOLTIP'));

			const triggerTimePicker = () => {
				const currentVal = timeInput.value.trim();
				const normTime = normalizeTimeInput(currentVal);
				if (normTime) {
					nativeTimePicker.value = normTime;
				} else if (defaultTime) {
					nativeTimePicker.value = defaultTime;
				}
				try {
					if (typeof nativeTimePicker.showPicker === 'function') {
						nativeTimePicker.showPicker();
					} else {
						nativeTimePicker.click();
					}
				} catch {
					nativeTimePicker.click();
				}
			};

			clockBtn.addEventListener('click', (e) => {
				e.preventDefault();
				triggerTimePicker();
			});

			nativeTimePicker.addEventListener('change', () => {
				timeInput.value = nativeTimePicker.value.trim();
			});

			timeInput.addEventListener('input', () => {
				const tVal = timeInput.value.trim();
				const normTime = normalizeTimeInput(tVal);
				if (normTime) {
					nativeTimePicker.value = normTime;
				}
			});

			timeInput.addEventListener('blur', () => {
				const tVal = timeInput.value.trim();
				const normTime = normalizeTimeInput(tVal);
				if (normTime) {
					timeInput.value = normTime;
					nativeTimePicker.value = normTime;
				}
			});

			const timeClearBtn = timeGroup.createEl('button', {
				cls: 'clickable-icon sgb-detail-clear-btn',
				text: '✕',
				attr: { type: 'button', 'aria-label': t('MODAL_CLEAR_TIME_TOOLTIP') },
			});
			setTooltip(timeClearBtn, t('MODAL_CLEAR_TIME_TOOLTIP'));
			timeClearBtn.addEventListener('click', (e) => {
				e.preventDefault();
				timeInput.value = '';
				nativeTimePicker.value = defaultTime;
			});

			return {
				getDate: () => normalizeDateInput(dateInput.value.trim()) || undefined,
				getTime: () => {
					const tVal = timeInput.value.trim();
					return normalizeTimeInput(tVal) || undefined;
				},
				setDateDisabled: (disabled: boolean) => {
					dateInput.disabled = disabled;
					nativeDatePicker.disabled = disabled;
					calendarBtn.disabled = disabled;
					dateClearBtn.disabled = disabled;
					dateGroup.classList.toggle('is-disabled', disabled);
					dateWrapper.classList.toggle('is-disabled', disabled);
				},
				setPlaceholder: (placeholder: string) => {
					dateInput.placeholder = placeholder || DEFAULT_DATE_PLACEHOLDER;
				},
			};
		};

		// 1. Chain (Inherit) Setting - Top row (hidden for note total only)
		let cycleUnit = 'none';
		let cycleNum = 1;
		let getFormattedCycle: () => string | undefined = () => undefined;
		let currentPreviewDates: { start?: string; target?: string } | undefined;

		const hasParentCycle = Boolean(!this.isNoteTotal && parseCycle(this.parentFileCycle));
		const parentCycleDisplay = hasParentCycle ? formatCycleLocale(this.parentFileCycle) : '';

		if (!this.isNoteTotal) {
			const cycleRow = contentEl.createDiv({ cls: 'sgb-detail-row sgb-detail-setting-row' });
			const cycleInfo = cycleRow.createDiv({ cls: 'sgb-detail-info' });
			cycleInfo.createDiv({ cls: 'sgb-detail-label sgb-detail-setting-label', text: t('MODAL_DATE_CYCLE_LABEL') });
			cycleInfo.createDiv({ cls: 'sgb-detail-desc', text: t('MODAL_DATE_CYCLE_DESC') });

			const cycleControl = cycleRow.createDiv({ cls: 'sgb-detail-control sgb-detail-cycle-control' });

			if (hasParentCycle && !this.initialCycle) {
				cycleUnit = 'inherit';
				const p = parseCycle(this.parentFileCycle);
				cycleNum = p ? p.value : 1;
			} else if (this.initialCycle === 'none') {
				cycleUnit = 'none';
				cycleNum = 1;
			} else {
				const parsed = parseCycle(this.initialCycle);
				cycleUnit = parsed ? parsed.unit : (hasParentCycle ? 'inherit' : 'none');
				cycleNum = parsed ? parsed.value : 1;
			}

			const numInput = cycleControl.createEl('input', {
				type: 'number',
				cls: 'sgb-goal-input sgb-cycle-num-input',
				attr: { min: '1', max: '99' },
				value: String(cycleNum),
			});
			if (cycleUnit === 'none' || cycleUnit === 'inherit') {
				numInput.addClass('sgb-hidden');
			}

			const unitSelect = cycleControl.createEl('select', { cls: 'dropdown sgb-cycle-unit-select' });
			const units: Array<{ value: string; text: string }> = [];
			if (hasParentCycle) {
				units.push({
					value: 'inherit',
					text: t('MODAL_DATE_CYCLE_INHERIT', { cycle: parentCycleDisplay }),
				});
			}
			units.push(
				{ value: 'none', text: t('MODAL_DATE_CYCLE_NONE') },
				{ value: 'day', text: t('MODAL_DATE_CYCLE_DAY') },
				{ value: 'week', text: t('MODAL_DATE_CYCLE_WEEK') },
				{ value: 'month', text: t('MODAL_DATE_CYCLE_MONTH') },
				{ value: 'year', text: t('MODAL_DATE_CYCLE_YEAR') },
			);
			for (const u of units) {
				const opt = unitSelect.createEl('option', { value: u.value, text: u.text });
				if (u.value === cycleUnit) opt.selected = true;
			}

			const weekdayEl = cycleControl.createSpan({ cls: 'sgb-cycle-weekday' });

			getFormattedCycle = (): string | undefined => {
				if (hasParentCycle) {
					if (cycleUnit === 'inherit') return undefined;
					if (cycleUnit === 'none') return 'none';
					return formatCycle({
						value: cycleNum,
						unit: cycleUnit as DateCycle['unit'],
					});
				} else {
					if (cycleUnit !== 'none') {
						return formatCycle({
							value: cycleNum,
							unit: cycleUnit as DateCycle['unit'],
						});
					}
					return undefined;
				}
			};

			updateWeekdayDisplay = () => {
				const effUnit = cycleUnit === 'inherit' && hasParentCycle ? parseCycle(this.parentFileCycle)?.unit : cycleUnit;
				if (effUnit === 'week') {
					const effDate =
						targetRowObj.getDate() ||
						startRowObj.getDate() ||
						currentPreviewDates?.target ||
						currentPreviewDates?.start;
					const weekday = getWeekdayLabel(effDate);
					if (weekday) {
						weekdayEl.setText(`(${weekday})`);
						weekdayEl.removeClass('sgb-hidden');
					} else {
						weekdayEl.setText('');
						weekdayEl.addClass('sgb-hidden');
					}
				} else {
					weekdayEl.setText('');
					weekdayEl.addClass('sgb-hidden');
				}
			};

			numInput.addEventListener('input', () => {
				const n = parseInt(numInput.value, 10);
				cycleNum = !isNaN(n) && n > 0 ? n : 1;
				updateComputedPlaceholders();
				updateWeekdayDisplay();
				updatePriorityNote();
			});

			unitSelect.addEventListener('change', () => {
				cycleUnit = unitSelect.value;
				if (cycleUnit === 'none' || cycleUnit === 'inherit') {
					numInput.addClass('sgb-hidden');
					unitSelect.classList.toggle('is-unit-none', cycleUnit === 'none');
				} else {
					numInput.removeClass('sgb-hidden');
					unitSelect.removeClass('is-unit-none');
				}
				updateComputedPlaceholders();
				updateWeekdayDisplay();
				updatePriorityNote();
			});

			unitSelect.classList.toggle('is-unit-none', cycleUnit === 'none');
		}

		// 2. Date & Time Rows (Start Date, Target Date)
		const startRowObj = createDateTimeRow(
			t('MODAL_DATE_START_LABEL'),
			this.initialStartDate,
			this.initialStartTime,
			this.defaultStartTime,
		);

		const targetRowObj = createDateTimeRow(
			t('MODAL_DATE_TARGET_LABEL'),
			this.initialTargetDate,
			this.initialTargetTime,
			this.defaultTargetTime,
		);

		// 3. Priority note row when both relative calculation and explicit date are present
		const priorityRowEl = contentEl.createDiv({
			cls: 'sgb-detail-row sgb-detail-note-row sgb-hidden',
		});
		priorityRowEl.hidden = true;
		priorityRowEl.createDiv({ cls: 'sgb-detail-label' });
		priorityRowEl.createDiv({
			cls: 'sgb-detail-priority-note',
			text: t('MODAL_DATE_CYCLE_PRIORITY_NOTE'),
		});

		updatePriorityNote = () => {
			if (this.isNoteTotal) {
				priorityRowEl.addClass('sgb-hidden');
				priorityRowEl.hidden = true;
				return;
			}
			const hasActiveCycle = (cycleUnit === 'inherit' && hasParentCycle) || (cycleUnit !== 'none' && cycleUnit !== 'inherit');
			const hasExplicitDate = Boolean(startRowObj.getDate() || targetRowObj.getDate());
			const shouldShow = hasActiveCycle && hasExplicitDate;
			priorityRowEl.classList.toggle('sgb-hidden', !shouldShow);
			priorityRowEl.hidden = !shouldShow;
		};

		const updateComputedPlaceholders = () => {
			if (this.computePreviewDates) {
				const tempCycle = getFormattedCycle();
				currentPreviewDates = this.computePreviewDates(tempCycle);
				startRowObj.setPlaceholder(
					currentPreviewDates.start ? formatShortDate(currentPreviewDates.start) : DEFAULT_DATE_PLACEHOLDER,
				);
				targetRowObj.setPlaceholder(
					currentPreviewDates.target ? formatShortDate(currentPreviewDates.target) : DEFAULT_DATE_PLACEHOLDER,
				);
			} else {
				currentPreviewDates = undefined;
			}
		};

		updateComputedPlaceholders();
		updateWeekdayDisplay();
		updatePriorityNote();

		// Buttons
		const btnContainer = contentEl.createDiv({ cls: 'sgb-confirm-buttons' });
		const cancelBtn = btnContainer.createEl('button', {
			text: t('MODAL_CONFIRM_CANCEL'),
			cls: 'sgb-confirm-cancel-button',
		});
		cancelBtn.addEventListener('click', () => {
			this.close();
		});

		const saveBtn = btnContainer.createEl('button', {
			text: t('MODAL_CONFIRM_OK'),
			cls: 'mod-cta sgb-confirm-ok-button',
		});
		saveBtn.addEventListener('click', () => {
			const formattedCycle = this.isNoteTotal ? undefined : getFormattedCycle();

			this.close();
			this.onSave({
				startDate: startRowObj.getDate(),
				startTime: startRowObj.getTime(),
				targetDate: targetRowObj.getDate(),
				targetTime: targetRowObj.getTime(),
				cycle: formattedCycle,
			});
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export interface DateTabCallbacks {
	saveGoals: () => Promise<void>;
	debouncedSaveGoals: () => void;
	jumpToSection: (section: SectionNode) => void;
	scrollToItem?: (itemEl: HTMLElement, smooth?: boolean) => void;
}

const DEFAULT_DATE_PLACEHOLDER = 'YY-MM-DD';

export class DateGoalsTabRenderer {
	private app: App;
	private settings: PluginSettings;
	private fmManager: FrontmatterManager;
	private parsedData: ParsedDocumentSections;
	private effectiveData: EffectiveGoalData;
	private activeSectionIndex: number | null;
	private callbacks: DateTabCallbacks;
	private occurrenceOverrides?: Map<number, number>;

	public fileTargetDateInput?: string;
	public fileStartDateInput?: string;
	public fileCycleInput?: string;
	public fileDateReferenceInput?: DateReferenceMode;
	public sectionDateGoalsByIndex: Map<number, { start?: string; target?: string; cycle?: string }> = new Map();

	private sectionRowUpdateMap: Map<number, (info: {
		startPh: string;
		targetPh: string;
		isStartChained: boolean;
		isTargetChained: boolean;
		isInherited: boolean;
		cycleDisplay: string;
		tooltip?: string;
		connectorState?: ChainConnectorState;
	}) => void> = new Map();
	private updateSubgroupWeekdayDisplay: () => void = () => {};

	constructor(
		app: App,
		settings: PluginSettings,
		fmManager: FrontmatterManager,
		parsedData: ParsedDocumentSections,
		effectiveData: EffectiveGoalData,
		activeSectionIndex: number | null,
		callbacks: DateTabCallbacks,
		occurrenceOverrides?: Map<number, number>,
	) {
		this.app = app;
		this.settings = settings;
		this.fmManager = fmManager;
		this.parsedData = parsedData;
		this.effectiveData = effectiveData;
		this.activeSectionIndex = activeSectionIndex;
		this.callbacks = callbacks;
		this.occurrenceOverrides = occurrenceOverrides;

		this.fileTargetDateInput = effectiveData.fileTargetDate;
		this.fileStartDateInput = effectiveData.fileStartDate;
		this.fileCycleInput = effectiveData.rawGoalData?.fileCycle;
		this.fileDateReferenceInput = effectiveData.rawGoalData?.fileDateReference;

		if (effectiveData.sectionDateGoals) {
			const matched = matchSectionDateGoals(parsedData.flatSections, effectiveData.sectionDateGoals, occurrenceOverrides);
			for (const [idx, item] of matched.entries()) {
				this.sectionDateGoalsByIndex.set(idx, item);
			}
		}
	}

	public getEffectiveDateReference(): DateReferenceMode {
		return (
			this.fileDateReferenceInput ??
			this.effectiveData.inheritedDefaults?.defaultDateReference ??
			this.settings.defaultDateReference ??
			'parent'
		);
	}

	public getEffectiveFileCycle(): string | undefined {
		if (this.fileCycleInput !== undefined) {
			return this.fileCycleInput === 'none' ? undefined : this.fileCycleInput;
		}
		const inherited = this.effectiveData.inheritedDefaults?.defaultCycle;
		return inherited && inherited !== 'none' ? inherited : undefined;
	}

	public getSectionGoal(i: number): { start?: string; target?: string; cycle?: string } {
		let goal = this.sectionDateGoalsByIndex.get(i);
		if (!goal) {
			goal = {};
			this.sectionDateGoalsByIndex.set(i, goal);
		}
		return goal;
	}

	public updateSectionGoal(
		i: number,
		goal: { start?: string; target?: string; cycle?: string },
	): void {
		if (!goal.start && !goal.target && !goal.cycle) {
			this.sectionDateGoalsByIndex.delete(i);
		} else {
			this.sectionDateGoalsByIndex.set(i, goal);
		}
	}

	public clearSectionDates(): void {
		this.sectionDateGoalsByIndex.clear();
	}

	public cleanupInvalidDates(): void {
		if (this.fileStartDateInput && !isValidDateOrTimeString(this.fileStartDateInput)) {
			this.fileStartDateInput = undefined;
		}
		if (this.fileTargetDateInput && !isValidDateOrTimeString(this.fileTargetDateInput)) {
			this.fileTargetDateInput = undefined;
		}

		for (const [idx, data] of Array.from(this.sectionDateGoalsByIndex.entries())) {
			if (data.start && !isValidDateOrTimeString(data.start)) {
				data.start = undefined;
			}
			if (data.target && !isValidDateOrTimeString(data.target)) {
				data.target = undefined;
			}
			if (!data.start && !data.target && !data.cycle) {
				this.sectionDateGoalsByIndex.delete(idx);
			}
		}
	}

	public getSectionDateGoalsList(): SectionDateGoalItem[] {
		this.cleanupInvalidDates();
		const list: SectionDateGoalItem[] = [];

		const headingTotalCounts = new Map<string, number>();
		for (const s of this.parsedData.flatSections) {
			headingTotalCounts.set(s.heading, (headingTotalCounts.get(s.heading) ?? 0) + 1);
		}

		const headingOccCounter = new Map<string, number>();
		for (let i = 0; i < this.parsedData.flatSections.length; i++) {
			const section = this.parsedData.flatSections[i]!;
			const occ = (headingOccCounter.get(section.heading) ?? 0) + 1;
			headingOccCounter.set(section.heading, occ);

			const data = this.sectionDateGoalsByIndex.get(i);
			if (data && (data.target || data.start || data.cycle)) {
				const isDuplicate = (headingTotalCounts.get(section.heading) ?? 0) > 1;
				list.push({
					heading: section.heading,
					index: isDuplicate ? occ : undefined,
					occurrence: isDuplicate ? occ : undefined,
					target: data.target,
					start: data.start,
					cycle: data.cycle,
				});
			}
		}
		return list;
	}

	public renderDateTab(containerEl: HTMLElement): void {
		containerEl.empty();
		this.sectionRowUpdateMap.clear();

		// Table Column Header (Section Title | Start Date | Target Date | Detail)
		const tableHeaderEl = containerEl.createDiv({ cls: 'sgb-section-table-header sgb-date-table-header' });
		tableHeaderEl.createSpan({ cls: 'sgb-header-title', text: '' });
		const headerControlsEl = tableHeaderEl.createDiv({ cls: 'sgb-header-controls sgb-date-header-controls' });
		headerControlsEl.createSpan({ cls: 'sgb-header-date-start', text: t('MODAL_DATE_START_LABEL') });
		headerControlsEl.createSpan({ cls: 'sgb-header-date-target', text: t('MODAL_DATE_TARGET_LABEL') });
		headerControlsEl.createSpan({ cls: 'sgb-header-date-detail', text: t('MODAL_COL_DETAIL') });
		const cycleHeaderEl = headerControlsEl.createSpan({ cls: 'sgb-header-date-cycle' });
		setIcon(cycleHeaderEl, 'calendar-sync');
		setTooltip(cycleHeaderEl, t('MODAL_SECTION_CYCLE_LABEL'));

		// Top Card: Note Total Date Goal
		const topCardEl = containerEl.createDiv({ cls: 'sgb-modal-top-card sgb-date-top-card' });
		const totalRowEl = topCardEl.createDiv({ cls: 'sgb-modal-card-row sgb-date-card-row' });

		const totalLabelGroup = totalRowEl.createDiv({ cls: 'sgb-card-label-group' });
		const totalTitleEl = totalLabelGroup.createSpan({ cls: 'sgb-card-title' });
		const totalIconEl = totalTitleEl.createSpan({ cls: 'sgb-card-title-icon' });
		setIcon(totalIconEl, 'book-text');
		totalTitleEl.createSpan({ text: t('MODAL_TOTAL_GOAL_NAME') });

		const totalControls = totalRowEl.createDiv({ cls: 'sgb-card-controls sgb-date-card-controls' });

		// Total: Start Date input
		const totalStartPicker = this.createDateInputWithPicker(
			totalControls,
			() => this.fileStartDateInput,
			() => DEFAULT_DATE_PLACEHOLDER,
			(val) => {
				const dateOnly = normalizeDateInput(val);
				const { time } = extractDateAndTime(this.fileStartDateInput);
				this.fileStartDateInput = dateOnly ? (combineDateAndTime(dateOnly, time) || undefined) : undefined;
				this.refreshAllSectionPlaceholders();
				this.callbacks.debouncedSaveGoals();
			},
		);

		// Total: Target Date input
		const totalTargetPicker = this.createDateInputWithPicker(
			totalControls,
			() => this.fileTargetDateInput,
			() => DEFAULT_DATE_PLACEHOLDER,
			(val) => {
				const dateOnly = normalizeDateInput(val);
				const { time } = extractDateAndTime(this.fileTargetDateInput);
				this.fileTargetDateInput = dateOnly ? (combineDateAndTime(dateOnly, time) || undefined) : undefined;
				this.refreshAllSectionPlaceholders();
				this.callbacks.debouncedSaveGoals();
			},
		);

		// Total: Detail Button (Start Date/Time, Target Date/Time)
		this.createDetailButton(
			totalControls,
			t('MODAL_TOTAL_GOAL_NAME'),
			() => extractDateAndTime(this.fileStartDateInput).date || undefined,
			() => extractDateAndTime(this.fileStartDateInput).time,
			() => extractDateAndTime(this.fileTargetDateInput).date || undefined,
			() => extractDateAndTime(this.fileTargetDateInput).time,
			() => undefined,
			() => undefined,
			true,
			({ startDate, startTime, targetDate, targetTime }) => {
				this.fileStartDateInput = combineDateAndTime(startDate, startTime) || undefined;
				this.fileTargetDateInput = combineDateAndTime(targetDate, targetTime) || undefined;

				totalStartPicker.setValue(this.fileStartDateInput);
				totalTargetPicker.setValue(this.fileTargetDateInput);
				this.refreshAllSectionPlaceholders();
				this.callbacks.debouncedSaveGoals();
			},
			undefined,
			false,
			() => this.effectiveData.effectiveStartTime || this.settings.defaultStartTime,
			() => this.effectiveData.effectiveTargetTime || this.settings.defaultTargetTime,
		);

		// Spacer to match the chain connector width on section rows below
		totalControls.createDiv({ cls: 'sgb-chain-connector sgb-chain-connector-spacer' });

		// Subgroup: Section Default Goals (Reference & Relative calculation)
		const subgroupContainer = topCardEl.createDiv({ cls: 'sgb-date-subgroup-container' });
		const subgroupHeader = subgroupContainer.createDiv({ cls: 'sgb-date-subgroup-header' });
		const subgroupTitle = subgroupHeader.createSpan({ cls: 'sgb-date-subgroup-title' });
		const subgroupIcon = subgroupTitle.createSpan({ cls: 'sgb-card-title-icon' });
		setIcon(subgroupIcon, 'hash');
		subgroupTitle.createSpan({ text: t('MODAL_SECTION_DATE_DEFAULT_HEADER') });

		const subgroupBody = subgroupContainer.createDiv({ cls: 'sgb-date-subgroup-body' });

		// Subgroup Row 1: Default Date Reference
		const refRowEl = subgroupBody.createDiv({ cls: 'sgb-modal-card-row sgb-date-card-row sgb-date-reference-card-row' });
		const refLabelGroup = refRowEl.createDiv({ cls: 'sgb-card-label-group' });
		const refTitleEl = refLabelGroup.createSpan({ cls: 'sgb-card-title' });
		const refIconEl = refTitleEl.createSpan({ cls: 'sgb-card-title-icon' });
		setIcon(refIconEl, 'workflow');
		refTitleEl.createSpan({ text: t('MODAL_DATE_REFERENCE_LABEL') });
		refLabelGroup.createSpan({ cls: 'sgb-card-desc', text: t('MODAL_DATE_REFERENCE_DESC') });

		const refControls = refRowEl.createDiv({ cls: 'sgb-card-controls sgb-date-reference-controls' });
		const refDropdownWrapper = refControls.createDiv({ cls: 'sgb-date-reference-dropdown-wrapper' });
		const refDropdown = new DropdownComponent(refDropdownWrapper);

		const inheritedRef =
			this.effectiveData.inheritedDefaults?.defaultDateReference ??
			this.settings.defaultDateReference ??
			'parent';
		const getRefLabel = (mode: DateReferenceMode) => {
			let base = '';
			if (mode === 'none') base = t('SETTINGS_DATE_REFERENCE_NONE');
			else if (mode === 'note') base = t('SETTINGS_DATE_REFERENCE_NOTE');
			else base = t('SETTINGS_DATE_REFERENCE_PARENT');

			if (mode === inheritedRef) {
				return t('MODAL_DATE_REF_WITH_DEFAULT', { label: base });
			}
			return base;
		};

		refDropdown.addOption('none', getRefLabel('none'));
		refDropdown.addOption('parent', getRefLabel('parent'));
		refDropdown.addOption('note', getRefLabel('note'));
		refDropdown.setValue(this.fileDateReferenceInput || inheritedRef);
		refDropdown.onChange((val) => {
			const selected = val as DateReferenceMode;
			if (selected === inheritedRef) {
				this.fileDateReferenceInput = undefined;
			} else {
				this.fileDateReferenceInput = selected;
			}
			this.refreshAllSectionPlaceholders();
			this.callbacks.debouncedSaveGoals();
		});

		// Subgroup Row 2: Relative Date Calculation Cycle
		const cycleRowEl = subgroupBody.createDiv({ cls: 'sgb-modal-card-row sgb-date-card-row sgb-section-cycle-card-row' });
		const cycleLabelGroup = cycleRowEl.createDiv({ cls: 'sgb-card-label-group' });
		const cycleTitleEl = cycleLabelGroup.createSpan({ cls: 'sgb-card-title' });
		const cycleIconEl = cycleTitleEl.createSpan({ cls: 'sgb-card-title-icon' });
		setIcon(cycleIconEl, 'calendar-sync');
		cycleTitleEl.createSpan({ text: t('MODAL_SECTION_CYCLE_LABEL') });
		cycleLabelGroup.createSpan({ cls: 'sgb-card-desc', text: t('MODAL_SECTION_CYCLE_DESC') });

		const cycleControls = cycleRowEl.createDiv({ cls: 'sgb-card-controls sgb-section-cycle-controls' });

		const inheritedCycle = this.effectiveData.inheritedDefaults?.defaultCycle;
		const hasInheritedCycle = Boolean(inheritedCycle && inheritedCycle !== 'none' && parseCycle(inheritedCycle));
		let cycleUnit: string;
		let cycleNum: number;
		if (this.fileCycleInput === undefined) {
			if (hasInheritedCycle) {
				cycleUnit = 'inherit';
				const p = parseCycle(inheritedCycle);
				cycleNum = p ? p.value : 1;
			} else {
				cycleUnit = 'none';
				cycleNum = 1;
			}
		} else if (this.fileCycleInput === 'none') {
			cycleUnit = 'none';
			cycleNum = 1;
		} else {
			const parsed = parseCycle(this.fileCycleInput);
			cycleUnit = parsed ? parsed.unit : (hasInheritedCycle ? 'inherit' : 'none');
			cycleNum = parsed ? parsed.value : 1;
		}

		const cycleNumInput = cycleControls.createEl('input', {
			type: 'number',
			cls: 'sgb-goal-input sgb-cycle-num-input',
			attr: { min: '1', max: '99' },
			value: String(cycleNum),
		});
		if (cycleUnit === 'none' || cycleUnit === 'inherit') {
			cycleNumInput.addClass('sgb-hidden');
		}

		const cycleUnitSelect = cycleControls.createEl('select', { cls: 'dropdown sgb-cycle-unit-select' });

		const cycleUnits: Array<{ value: string; text: string }> = [];
		if (hasInheritedCycle) {
			cycleUnits.push({
				value: 'inherit',
				text: t('MODAL_DATE_CYCLE_INHERIT', { cycle: formatCycleLocale(inheritedCycle) }),
			});
		}
		cycleUnits.push(
			{ value: 'none', text: t('MODAL_DATE_CYCLE_NONE') },
			{ value: 'day', text: t('MODAL_DATE_CYCLE_DAY') },
			{ value: 'week', text: t('MODAL_DATE_CYCLE_WEEK') },
			{ value: 'month', text: t('MODAL_DATE_CYCLE_MONTH') },
			{ value: 'year', text: t('MODAL_DATE_CYCLE_YEAR') },
		);
		for (const u of cycleUnits) {
			const opt = cycleUnitSelect.createEl('option', { value: u.value, text: u.text });
			if (u.value === cycleUnit) opt.selected = true;
		}

		const weekdayEl = cycleControls.createSpan({ cls: 'sgb-cycle-weekday' });

		const getEffectiveSubgroupDate = (): string | undefined => {
			if (this.fileTargetDateInput) return this.fileTargetDateInput;
			if (this.fileStartDateInput) return this.fileStartDateInput;
			if (this.effectiveData.fileTargetDate) {
				return this.effectiveData.fileTargetDate;
			}
			if (this.effectiveData.fileStartDate) {
				return this.effectiveData.fileStartDate;
			}
			for (let i = 0; i < this.parsedData.flatSections.length; i++) {
				const item = this.sectionDateGoalsByIndex.get(i);
				if (item?.target) return item.target;
				if (item?.start) return item.start;
			}
			return undefined;
		};

		this.updateSubgroupWeekdayDisplay = () => {
			const effUnit =
				cycleUnit === 'inherit' && hasInheritedCycle
					? parseCycle(inheritedCycle)?.unit
					: cycleUnit;
			if (effUnit === 'week') {
				const effDate = getEffectiveSubgroupDate();
				const weekday = getWeekdayLabel(effDate);
				if (weekday) {
					weekdayEl.setText(`(${weekday})`);
					weekdayEl.removeClass('sgb-hidden');
				} else {
					weekdayEl.setText('');
					weekdayEl.addClass('sgb-hidden');
				}
			} else {
				weekdayEl.setText('');
				weekdayEl.addClass('sgb-hidden');
			}
		};

		const updateFileCycleFromInputs = () => {
			if (cycleUnit === 'inherit') {
				this.fileCycleInput = undefined;
			} else if (cycleUnit === 'none') {
				this.fileCycleInput = hasInheritedCycle ? 'none' : undefined;
			} else {
				this.fileCycleInput = formatCycle({
					value: cycleNum,
					unit: cycleUnit as DateCycle['unit'],
				});
			}
			this.refreshAllSectionPlaceholders();
			this.updateSubgroupWeekdayDisplay();
			this.callbacks.debouncedSaveGoals();
		};

		cycleNumInput.addEventListener('input', () => {
			const n = parseInt(cycleNumInput.value, 10);
			cycleNum = !isNaN(n) && n > 0 ? n : 1;
			updateFileCycleFromInputs();
		});

		cycleUnitSelect.addEventListener('change', () => {
			cycleUnit = cycleUnitSelect.value;
			if (cycleUnit === 'none' || cycleUnit === 'inherit') {
				cycleNumInput.addClass('sgb-hidden');
			} else {
				cycleNumInput.removeClass('sgb-hidden');
			}
			updateFileCycleFromInputs();
		});

		this.updateSubgroupWeekdayDisplay();

		// Section Header: Headings Tree & Clear Dates Button
		const sectionHeaderEl = containerEl.createDiv({ cls: 'sgb-modal-section-header' });
		sectionHeaderEl.createEl('h3', { text: t('MODAL_SECTIONS_HEADER') });

		const clearBtn = sectionHeaderEl.createEl('button', {
			cls: 'sgb-reset-button mod-warning',
			text: t('MODAL_CLEAR_DATES_BUTTON'),
		});
		clearBtn.addEventListener('click', () => {
			new ConfirmModal(this.app, {
				message: t('MODAL_CLEAR_DATES_CONFIRM_MSG'),
				confirmText: t('MODAL_CONFIRM_DELETE'),
				isWarning: true,
				onConfirm: () => {
					this.clearSectionDates();
					this.renderDateTab(containerEl);
					void this.callbacks.saveGoals();
				},
			}).open();
		});

		if (this.parsedData.sections.length === 0) {
			containerEl.createEl('p', {
				text: t('MODAL_NO_HEADINGS'),
				cls: 'sgb-empty-notice',
			});
			return;
		}

		// Section Items List
		const listContainer = containerEl.createDiv({ cls: 'sgb-section-tree-container sgb-date-tree-container' });
		let activeItemEl: HTMLElement | null = null;
		const parentIndexMap = buildParentIndexMap(this.parsedData.flatSections);

		for (let i = 0; i < this.parsedData.flatSections.length; i++) {
			const section = this.parsedData.flatSections[i]!;
			const isFirstSection = (i === 0);
			const itemEl = listContainer.createDiv({
				cls: `sgb-section-tree-item sgb-level-${section.level}`,
			});

			if (i === this.activeSectionIndex) {
				itemEl.addClass('is-active-section');
				activeItemEl = itemEl;
			}

			// Clickable heading title
			const titleEl = itemEl.createDiv({ cls: 'sgb-section-title' });
			const headingIcon = '#'.repeat(section.level);
			titleEl.createSpan({ cls: 'sgb-heading-prefix', text: `${headingIcon} ` });
			titleEl.createSpan({ cls: 'sgb-heading-name', text: section.heading });
			titleEl.addEventListener('click', () => {
				this.callbacks.jumpToSection(section);
			});

			const controlsEl = itemEl.createDiv({ cls: 'sgb-section-controls sgb-date-section-controls' });
			const existingGoal = this.getSectionGoal(i);

			// Section: Start Date Input
			const startPicker = this.createDateInputWithPicker(
				controlsEl,
				() => existingGoal.start,
				() => DEFAULT_DATE_PLACEHOLDER,
				(val) => {
					const dateOnly = normalizeDateInput(val);
					const { time } = extractDateAndTime(existingGoal.start);
					existingGoal.start = dateOnly ? (combineDateAndTime(dateOnly, time) || undefined) : undefined;
					this.updateSectionGoal(i, existingGoal);
					this.refreshAllSectionPlaceholders();
					this.callbacks.debouncedSaveGoals();
				},
			);

			// Section: Target Date Input
			const targetPicker = this.createDateInputWithPicker(
				controlsEl,
				() => existingGoal.target,
				() => DEFAULT_DATE_PLACEHOLDER,
				(val) => {
					const dateOnly = normalizeDateInput(val);
					const { time } = extractDateAndTime(existingGoal.target);
					existingGoal.target = dateOnly ? (combineDateAndTime(dateOnly, time) || undefined) : undefined;
					this.updateSectionGoal(i, existingGoal);
					this.refreshAllSectionPlaceholders();
					this.callbacks.debouncedSaveGoals();
				},
			);

			// Section: Detail Button (Start Date/Time, Target Date/Time, Cycle)
			const detailBtnObj = this.createDetailButton(
				controlsEl,
				section.heading,
				() => (existingGoal.start ? extractDateAndTime(existingGoal.start).date || undefined : undefined),
				() => (existingGoal.start ? extractDateAndTime(existingGoal.start).time : undefined),
				() => (existingGoal.target ? extractDateAndTime(existingGoal.target).date || undefined : undefined),
				() => (existingGoal.target ? extractDateAndTime(existingGoal.target).time : undefined),
				() => existingGoal.cycle,
				() => {
					if (isFirstSection) {
						return this.getEffectiveFileCycle();
					}
					return getSectionEffectiveParentCycle(
						i,
						this.parsedData.flatSections,
						parentIndexMap,
						this.sectionDateGoalsByIndex,
						this.getEffectiveFileCycle(),
						this.getEffectiveDateReference(),
					);
				},
				false,
				({ startDate, startTime, targetDate, targetTime, cycle }) => {
					existingGoal.start = combineDateAndTime(startDate, startTime) || undefined;
					existingGoal.target = combineDateAndTime(targetDate, targetTime) || undefined;
					existingGoal.cycle = cycle || undefined;

					startPicker.setValue(existingGoal.start);
					targetPicker.setValue(existingGoal.target);
					this.updateSectionGoal(i, existingGoal);
					this.refreshAllSectionPlaceholders();
					this.callbacks.debouncedSaveGoals();
				},
				(tempCycle) => {
					const tempMap = new Map(this.sectionDateGoalsByIndex);
					const curr = { ...(tempMap.get(i) ?? {}) };
					curr.cycle = tempCycle;
					tempMap.set(i, curr);

					const resolvedMap = resolveChainedDateGoals(
						this.parsedData.flatSections,
						this.fileStartDateInput,
						this.fileTargetDateInput,
						this.getEffectiveFileCycle(),
						tempMap,
						this.effectiveData.effectiveStartTime || this.settings.defaultStartTime,
						this.effectiveData.effectiveTargetTime || this.settings.defaultTargetTime,
						this.getEffectiveDateReference(),
					);

					const resolved = resolvedMap.get(i) ?? resolvedMap.get(section.heading);
					return {
						start: extractDateAndTime(resolved?.start).date || undefined,
						target: extractDateAndTime(resolved?.target).date || undefined,
					};
				},
				isFirstSection,
				() => {
					const resolvedMap = resolveChainedDateGoals(
						this.parsedData.flatSections,
						this.fileStartDateInput,
						this.fileTargetDateInput,
						this.getEffectiveFileCycle(),
						this.sectionDateGoalsByIndex,
						this.effectiveData.effectiveStartTime || this.settings.defaultStartTime,
						this.effectiveData.effectiveTargetTime || this.settings.defaultTargetTime,
						this.getEffectiveDateReference(),
					);
					const res = resolvedMap.get(i) ?? resolvedMap.get(section.heading);
					return (
						res?.effectiveStartTime ||
						this.effectiveData.effectiveStartTime ||
						this.settings.defaultStartTime
					);
				},
				() => {
					const resolvedMap = resolveChainedDateGoals(
						this.parsedData.flatSections,
						this.fileStartDateInput,
						this.fileTargetDateInput,
						this.getEffectiveFileCycle(),
						this.sectionDateGoalsByIndex,
						this.effectiveData.effectiveStartTime || this.settings.defaultStartTime,
						this.effectiveData.effectiveTargetTime || this.settings.defaultTargetTime,
						this.getEffectiveDateReference(),
					);
					const res = resolvedMap.get(i) ?? resolvedMap.get(section.heading);
					return (
						res?.effectiveTargetTime ||
						this.effectiveData.effectiveTargetTime ||
						this.settings.defaultTargetTime
					);
				},
			);

			const connectorEl = controlsEl.createDiv({ cls: 'sgb-chain-connector' });

			// Register refresh callback for placeholders and chained state
			this.sectionRowUpdateMap.set(i, (info) => {
				startPicker.setPlaceholder(info.startPh);
				targetPicker.setPlaceholder(info.targetPh);

				// Always keep inputs editable so users can specify dates overriding relative calculations.
				startPicker.setChainedState(false, info.isInherited, info.tooltip);
				targetPicker.setChainedState(false, info.isInherited, info.tooltip);

				detailBtnObj.updateActiveState(info.isInherited, info.cycleDisplay);

				this.renderConnectorSvg(connectorEl, info.connectorState ?? 'none');
			});
		}

		// Initial calculation and population of chained placeholders for all sections
		this.refreshAllSectionPlaceholders();

		// Scroll to active section immediately
		if (activeItemEl && this.callbacks.scrollToItem) {
			window.setTimeout(() => {
				if (activeItemEl && this.callbacks.scrollToItem) {
					this.callbacks.scrollToItem(activeItemEl, false);
				}
			}, 0);
		}
	}

	private renderConnectorSvg(el: HTMLElement, state: ChainConnectorState): void {
		el.empty();
		el.removeClass(
			'is-start',
			'is-start-dotted-down',
			'is-middle',
			'is-middle-dotted-down',
			'is-middle-dotted-up',
			'is-middle-dotted-both',
			'is-end',
			'is-end-dotted-up',
			'is-pass-through',
			'is-pass-through-dotted',
		);
		if (state === 'none') {
			return;
		}
		el.addClass(`is-${state}`);

		const svg = el.createSvg('svg', {
			cls: 'sgb-connector-svg',
			attr: {
				viewBox: '0 0 10 28',
			},
		});

		let solidD = '';
		let dottedD = '';

		switch (state) {
			case 'start':
				solidD = 'M 0 14 L 6 14 Q 8 14 8 16 L 8 42';
				break;
			case 'start-dotted-down':
				// Top curve with solid stub continuing downwards past junction to y=23, followed by 3 dots at y=26.5, 30.0, 33.5
				solidD = 'M 0 14 L 6 14 Q 8 14 8 16 L 8 23';
				dottedD = 'M 8 26.5 L 8 33.5';
				break;
			case 'middle':
				solidD = 'M 8 -14 L 8 42 M 0 14 L 8 14';
				break;
			case 'middle-dotted-down':
				// T-shape (┤): solid line continues downward past junction to y=23, then 3 dots at y=26.5, 30.0, 33.5
				solidD = 'M 8 -14 L 8 23 M 0 14 L 8 14';
				dottedD = 'M 8 26.5 L 8 33.5';
				break;
			case 'middle-dotted-up':
				// T-shape (┤): 3 dots at y=-4.5, -1.0, 2.5, then solid line starts at y=5 (same 9px stub as downward) and continues downward past junction
				solidD = 'M 8 5 L 8 42 M 0 14 L 8 14';
				dottedD = 'M 8 -4.5 L 8 2.5';
				break;
			case 'middle-dotted-both':
				solidD = 'M 8 5 L 8 23 M 0 14 L 8 14';
				dottedD = 'M 8 -4.5 L 8 2.5 M 8 26.5 L 8 33.5';
				break;
			case 'end':
				solidD = 'M 8 -14 L 8 12 Q 8 14 6 14 L 0 14';
				break;
			case 'end-dotted-up':
				// 3 dots from top (y=-4.5, -1.0, 2.5), then solid stub starting at y=5 leading into bottom curve
				solidD = 'M 8 5 L 8 12 Q 8 14 6 14 L 0 14';
				dottedD = 'M 8 -4.5 L 8 2.5';
				break;
			case 'pass-through':
				// Vertical straight line passing completely through this section with no horizontal branch
				solidD = 'M 8 -14 L 8 42';
				break;
			case 'pass-through-dotted':
				dottedD = 'M 8 -4.5 L 8 33.5';
				break;
		}

		if (solidD) {
			svg.createSvg('path', {
				attr: {
					d: solidD,
					fill: 'none',
					stroke: 'var(--text-muted)',
					'stroke-width': '1.2',
					'stroke-linecap': 'round',
					'stroke-linejoin': 'round',
				},
			});
		}

		if (dottedD) {
			svg.createSvg('path', {
				attr: {
					d: dottedD,
					fill: 'none',
					stroke: 'var(--text-muted)',
					'stroke-width': '1.2',
					'stroke-linecap': 'round',
					'stroke-linejoin': 'round',
					'stroke-dasharray': '0 3.5',
				},
			});
		}
	}

	private refreshAllSectionPlaceholders(): void {
		const resolvedMap = resolveChainedDateGoals(
			this.parsedData.flatSections,
			this.fileStartDateInput,
			this.fileTargetDateInput,
			this.getEffectiveFileCycle(),
			this.sectionDateGoalsByIndex,
			this.effectiveData.effectiveStartTime || this.settings.defaultStartTime,
			this.effectiveData.effectiveTargetTime || this.settings.defaultTargetTime,
			this.getEffectiveDateReference(),
		);

		const parentIndexMap = buildParentIndexMap(this.parsedData.flatSections);

		// Collect sections actively inheriting relative date calculations
		const inheritedSet = new Set<number>();
		for (let i = 1; i < this.parsedData.flatSections.length; i++) {
			const section = this.parsedData.flatSections[i]!;
			const resolved = resolvedMap.get(i) ?? resolvedMap.get(section.heading);
			const existing = this.sectionDateGoalsByIndex.get(i);
			const effectiveParentCycle = getSectionEffectiveParentCycle(
				i,
				this.parsedData.flatSections,
				parentIndexMap,
				this.sectionDateGoalsByIndex,
				this.getEffectiveFileCycle(),
				this.getEffectiveDateReference(),
			);
			const hasEffectiveParentCycle = Boolean(effectiveParentCycle && parseCycle(effectiveParentCycle));
			const isTargetChained = Boolean(resolved?.isTargetChained);
			const isStartChained = Boolean(resolved?.isStartChained);
			const isInherited = Boolean(!existing?.cycle && hasEffectiveParentCycle && (isTargetChained || isStartChained));
			if (isInherited) {
				inheritedSet.add(i);
			}
		}

		const connectorMap = computeChainConnectorStates(
			this.parsedData.flatSections,
			parentIndexMap,
			this.sectionDateGoalsByIndex,
			resolvedMap,
			this.getEffectiveDateReference(),
			inheritedSet,
			this.fileTargetDateInput,
			this.fileCycleInput,
		);

		for (let i = 0; i < this.parsedData.flatSections.length; i++) {
			const section = this.parsedData.flatSections[i]!;
			const isFirstSection = (i === 0);
			const updater = this.sectionRowUpdateMap.get(i);
			if (updater) {
				const resolved = resolvedMap.get(i) ?? resolvedMap.get(section.heading);
				const existing = this.sectionDateGoalsByIndex.get(i);

				const effectiveParentCycle = getSectionEffectiveParentCycle(
					i,
					this.parsedData.flatSections,
					parentIndexMap,
					this.sectionDateGoalsByIndex,
					this.getEffectiveFileCycle(),
					this.getEffectiveDateReference(),
				);
				const hasEffectiveParentCycle = Boolean(effectiveParentCycle && parseCycle(effectiveParentCycle));
				const effectiveParentCycleDisplay = hasEffectiveParentCycle ? formatCycleLocale(effectiveParentCycle) : '';

				let isTargetChained = Boolean(resolved?.isTargetChained);
				let isStartChained = Boolean(resolved?.isStartChained);
				let isInherited = Boolean(!existing?.cycle && hasEffectiveParentCycle && (isTargetChained || isStartChained));

				if (isFirstSection) {
					isTargetChained = false;
					isStartChained = false;
					isInherited = false;
				}

				let cycleDisplay = '';
				if (!isFirstSection) {
					if (existing?.cycle && existing.cycle !== 'none') {
						cycleDisplay = formatCycleLocale(existing.cycle);
					} else if (isInherited) {
						cycleDisplay = effectiveParentCycleDisplay;
					}
				}

				let tooltip: string | undefined;
				if (!isFirstSection) {
					if (isInherited && cycleDisplay) {
						tooltip = t('MODAL_DATE_INHERITED_TOOLTIP', { cycle: cycleDisplay });
					} else if (isTargetChained && cycleDisplay) {
						tooltip = t('MODAL_DATE_CHAINED_TOOLTIP', { cycle: cycleDisplay });
					}
				}

				const startExt = extractDateAndTime(resolved?.start);
				const targetExt = extractDateAndTime(resolved?.target);
				const startPh = startExt.date
					? formatShortDate(startExt.date)
					: DEFAULT_DATE_PLACEHOLDER;
				const targetPh = targetExt.date
					? formatShortDate(targetExt.date)
					: DEFAULT_DATE_PLACEHOLDER;

				updater({
					startPh,
					targetPh,
					isStartChained,
					isTargetChained,
					isInherited,
					cycleDisplay,
					tooltip,
					connectorState: connectorMap.get(i) ?? connectorMap.get(section.heading) ?? 'none',
				});
			}
		}

		this.updateSubgroupWeekdayDisplay();
	}

	/**
	 * Creates a text input paired with a calendar button and hidden native date picker.
	 */
	private createDateInputWithPicker(
		parentEl: HTMLElement,
		getValue: () => string | undefined,
		getPlaceholder: () => string,
		onChange: (val: string) => void,
	): {
		inputEl: HTMLInputElement;
		setValue: (val: string | undefined) => void;
		setPlaceholder: (placeholder: string) => void;
		setDisabled: (disabled: boolean) => void;
		setChainedState: (isChained: boolean, isInherited: boolean, tooltipText?: string) => void;
	} {
		const wrapper = parentEl.createDiv({ cls: 'sgb-date-input-wrapper' });

		const initialFullVal = getValue();
		const initialExtract = extractDateAndTime(initialFullVal);
		const displayVal = formatShortDate(initialExtract.date);
		const initialPlaceholder = getPlaceholder();
		const displayPlaceholder = formatShortDate(initialPlaceholder) || initialPlaceholder || DEFAULT_DATE_PLACEHOLDER;

		const textInput = wrapper.createEl('input', {
			type: 'text',
			cls: 'sgb-goal-input sgb-date-text-input',
			value: displayVal,
			placeholder: displayPlaceholder,
		});

		textInput.addEventListener('focus', () => {
			window.setTimeout(() => {
				const itemEl = wrapper.closest('.sgb-section-tree-item');
				if (itemEl instanceof HTMLElement && this.callbacks.scrollToItem) {
					this.callbacks.scrollToItem(itemEl);
				}
			}, 250);
		});

		const nativePicker = wrapper.createEl('input', {
			type: 'date',
			cls: 'sgb-native-date-picker',
			value: normalizeDateInput(initialExtract.date) || '',
		});

		const calendarBtn = wrapper.createEl('button', {
			cls: 'clickable-icon sgb-date-calendar-btn',
			attr: {
				type: 'button',
				'aria-label': t('MODAL_DATE_PICKER_TOOLTIP'),
			},
		});
		setIcon(calendarBtn, 'calendar');
		setTooltip(calendarBtn, t('MODAL_DATE_PICKER_TOOLTIP'));

		let isDisabled = false;

		// Sync picker to text input
		calendarBtn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (isDisabled) return;
			const normalized = normalizeDateInput(textInput.value);
			if (normalized) {
				nativePicker.value = normalized;
			}
			try {
				if (typeof nativePicker.showPicker === 'function') {
					nativePicker.showPicker();
				} else {
					nativePicker.click();
				}
			} catch {
				nativePicker.click();
			}
		});

		nativePicker.addEventListener('change', () => {
			if (isDisabled) return;
			const newDate = nativePicker.value.trim();
			textInput.value = formatShortDate(newDate);
			const { time } = extractDateAndTime(getValue());
			onChange(newDate ? combineDateAndTime(newDate, time) : '');
		});

		textInput.addEventListener('input', () => {
			if (isDisabled) return;
			const rawVal = textInput.value.trim();
			const normalized = normalizeDateInput(rawVal);
			if (normalized) {
				nativePicker.value = normalized;
			}
			const { time } = extractDateAndTime(getValue());
			onChange(normalized ? combineDateAndTime(normalized, time) : '');
		});

		textInput.addEventListener('blur', () => {
			if (isDisabled) return;
			const val = textInput.value.trim();
			if (val) {
				const normalized = normalizeDateInput(val);
				if (isValidDateString(normalized)) {
					textInput.value = formatShortDate(normalized);
					nativePicker.value = normalized;
					const { time } = extractDateAndTime(getValue());
					onChange(combineDateAndTime(normalized, time));
				}
			}
		});

		return {
			inputEl: textInput,
			setValue: (v: string | undefined) => {
				const ext = extractDateAndTime(v);
				textInput.value = formatShortDate(ext.date);
				nativePicker.value = normalizeDateInput(ext.date) || '';
			},
			setPlaceholder: (p: string) => {
				textInput.placeholder = formatShortDate(p) || p || DEFAULT_DATE_PLACEHOLDER;
			},
			setDisabled: (disabled: boolean) => {
				isDisabled = disabled;
				textInput.disabled = disabled;
				calendarBtn.disabled = disabled;
				wrapper.classList.toggle('is-disabled', disabled);
			},
			setChainedState: (isChained: boolean, isInherited: boolean, tooltipText?: string) => {
				isDisabled = isChained;
				textInput.disabled = isChained;
				calendarBtn.disabled = isChained;
				wrapper.classList.toggle('is-disabled', isChained);
				wrapper.classList.toggle('is-chained', isChained);
				wrapper.classList.toggle('is-inherited', isInherited);
				if (tooltipText) {
					setTooltip(textInput, tooltipText);
					setTooltip(calendarBtn, tooltipText);
				} else {
					textInput.removeAttribute('aria-label');
					setTooltip(calendarBtn, t('MODAL_DATE_PICKER_TOOLTIP'));
				}
			},
		};
	}

	/**
	 * Creates a detail action button that opens the DateDetailModal.
	 */
	private createDetailButton(
		parentEl: HTMLElement,
		titleText: string,
		getStartDate: () => string | undefined,
		getStartTime: () => string | undefined,
		getTargetDate: () => string | undefined,
		getTargetTime: () => string | undefined,
		getCycle: () => string | undefined,
		getParentCycle: () => string | undefined,
		isNoteTotal: boolean,
		onSave: (result: {
			startDate?: string;
			startTime?: string;
			targetDate?: string;
			targetTime?: string;
			cycle?: string;
		}) => void,
		computePreviewDates?: (tempCycle: string | undefined) => { start?: string; target?: string },
		isFirstSection = false,
		getDefaultStartTime?: () => string,
		getDefaultTargetTime?: () => string,
	): {
		btnEl: HTMLButtonElement;
		updateActiveState: (isInherited?: boolean, parentCycleText?: string) => void;
	} {
		const btn = parentEl.createEl('button', {
			cls: 'clickable-icon sgb-date-detail-btn',
			attr: {
				type: 'button',
				'aria-label': t('MODAL_COL_DETAIL'),
			},
		});
		setIcon(btn, 'sliders-horizontal');

		let lastInherited = false;
		let lastParentCycleText = '';

		const updateActiveState = (isInherited?: boolean, parentCycleText?: string) => {
			if (isInherited !== undefined) lastInherited = isInherited;
			if (parentCycleText !== undefined) lastParentCycleText = parentCycleText;

			const hasStartTime = Boolean(getStartTime());
			const hasTargetTime = Boolean(getTargetTime());
			const explicitCycle = getCycle();
			const hasExplicitCycle = Boolean(explicitCycle && explicitCycle !== 'none' && parseCycle(explicitCycle));
			const isExplicitActive = hasStartTime || hasTargetTime || hasExplicitCycle;
			const isInheritedActive = !isFirstSection && !isExplicitActive && lastInherited;

			btn.classList.toggle('is-active', isExplicitActive);
			btn.classList.toggle('is-inherited', isInheritedActive);

			if (isInheritedActive) {
				setIcon(btn, 'calendar-sync');
			} else {
				setIcon(btn, 'sliders-horizontal');
			}

			const tooltipParts: string[] = [t('MODAL_COL_DETAIL')];
			if (hasExplicitCycle) {
				tooltipParts.push(`${t('MODAL_DATE_CYCLE_LABEL')}: ${formatCycleLocale(explicitCycle)}`);
			} else if (isInheritedActive && lastParentCycleText) {
				tooltipParts.push(t('MODAL_DATE_INHERITED_TOOLTIP', { cycle: lastParentCycleText }));
			}
			if (hasStartTime || hasTargetTime) {
				const effDefStart = getDefaultStartTime ? getDefaultStartTime() : (this.effectiveData.effectiveStartTime || this.settings.defaultStartTime);
				const effDefTarget = getDefaultTargetTime ? getDefaultTargetTime() : (this.effectiveData.effectiveTargetTime || this.settings.defaultTargetTime);
				const s = getStartTime() || effDefStart;
				const tg = getTargetTime() || effDefTarget;
				tooltipParts.push(`${s} ~ ${tg}`);
			}
			setTooltip(btn, tooltipParts.join(' '));
		};

		updateActiveState();

		btn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			const effDefaultStartTime = getDefaultStartTime ? getDefaultStartTime() : (this.effectiveData.effectiveStartTime || this.settings.defaultStartTime);
			const effDefaultTargetTime = getDefaultTargetTime ? getDefaultTargetTime() : (this.effectiveData.effectiveTargetTime || this.settings.defaultTargetTime);

			new DateDetailModal(
				this.app,
				titleText,
				getStartDate(),
				getStartTime(),
				getTargetDate(),
				getTargetTime(),
				getCycle(),
				effDefaultStartTime,
				effDefaultTargetTime,
				getParentCycle(),
				isNoteTotal,
				(res) => {
					onSave(res);
					updateActiveState();
				},
				computePreviewDates,
				isFirstSection,
			).open();
		});

		return { btnEl: btn, updateActiveState };
	}
}
