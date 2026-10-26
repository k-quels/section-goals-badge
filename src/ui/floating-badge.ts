import { setIcon } from 'obsidian';
import { t } from '../lang/helpers';
import { BadgePositionPreset, GoalColorStyle, PluginSettings, WritingProgress } from '../types';
import {
	DEFAULT_FONT_SIZE_PX,
	DRAG_THRESHOLD_PX,
	LONG_PRESS_DURATION_MS,
	MIN_BADGE_OFFSET_PX,
	MODAL_OPEN_DELAY_MS,
} from '../utils/constants';
import { setCssProps } from '../utils/dom';
import { calculateOverflowSegments } from '../utils/progress';
import { getProgressColor } from '../utils/color';
import { ViewportTracker } from '../utils/viewport';
import { SearchTracker } from '../utils/search-tracker';
import { DateProgressInfo } from '../types';
import { getDateProgressColor } from '../utils/date-goal';

export class FloatingBadge {
	private containerEl: HTMLElement;
	private dateContainerEl: HTMLElement;
	private countGroupEl: HTMLElement;
	private datePillEl: HTMLElement;
	private cumulativePillEl: HTMLElement;
	private sectionPillEl: HTMLElement;
	private totalPillEl: HTMLElement;

	private settings: PluginSettings;
	private onBadgeClick: (initialTab?: 'count' | 'date') => void;
	private onPositionChanged: (pos: { badgePosition: BadgePositionPreset; offsetX: number; offsetY: number }) => void;
	private onDatePositionChanged?: (pos: { dateBadgePosition: BadgePositionPreset; dateOffsetX: number; dateOffsetY: number }) => void;
	private currentParentEl: HTMLElement | null = null;
	private currentProgress: WritingProgress | null = null;
	private searchTracker: SearchTracker;
	private lastTargetEl: HTMLElement | null = null;

	// Dragging state
	private isDragging = false;
	private activeDragTarget: 'main' | 'date' | null = null;
	private dragStartX = 0;
	private dragStartY = 0;
	private initialLeft = 0;
	private initialTop = 0;
	private customPosition: { x: number; y: number } | null = null;
	private customDatePosition: { x: number; y: number } | null = null;

	// Long press timer
	private pressTimer: number | null = null;
	private isLongPress = false;

	constructor(
		settings: PluginSettings,
		onBadgeClick: (initialTab?: 'count' | 'date') => void,
		onPositionChanged: (pos: { badgePosition: BadgePositionPreset; offsetX: number; offsetY: number }) => void,
		onDatePositionChanged?: (pos: { dateBadgePosition: BadgePositionPreset; dateOffsetX: number; dateOffsetY: number }) => void,
	) {
		this.settings = settings;
		this.onBadgeClick = onBadgeClick;
		this.onPositionChanged = onPositionChanged;
		this.onDatePositionChanged = onDatePositionChanged;
		this.searchTracker = new SearchTracker(() => this.applyPosition());

		this.containerEl = createDiv({ cls: 'section-goals-badge' });
		this.dateContainerEl = createDiv({ cls: 'section-goals-badge sgb-date-badge sgb-hidden' });
		this.countGroupEl = createDiv({ cls: 'sgb-count-group' });

		setCssProps(this.containerEl, {
			'--sgb-badge-opacity': `${this.settings.badgeOpacity}`,
			'--sgb-badge-font-size': `${this.settings.fontSize || DEFAULT_FONT_SIZE_PX}px`,
		});
		setCssProps(this.dateContainerEl, {
			'--sgb-badge-opacity': `${this.settings.dateBadgeOpacity ?? this.settings.badgeOpacity}`,
			'--sgb-date-badge-font-size': `${this.settings.dateFontSize || DEFAULT_FONT_SIZE_PX}px`,
			'--sgb-badge-font-size': `${this.settings.dateFontSize || DEFAULT_FONT_SIZE_PX}px`,
		});

		// 0. Date progress pill
		this.datePillEl = createDiv({
			cls: 'sgb-pill-wrapper sgb-date-pill sgb-hidden',
		});

		// 1. Cumulative progress pill (inside countGroupEl)
		this.cumulativePillEl = this.countGroupEl.createDiv({
			cls: 'sgb-pill-wrapper sgb-cumulative-pill sgb-hidden',
		});

		// 2. Section progress pill (inside countGroupEl)
		this.sectionPillEl = this.countGroupEl.createDiv({
			cls: 'sgb-pill-wrapper sgb-section-pill sgb-hidden',
		});

		// 3. Total progress pill (inside countGroupEl)
		this.totalPillEl = this.countGroupEl.createDiv({
			cls: 'sgb-pill-wrapper sgb-total-pill sgb-hidden',
		});

		this.updateLayoutMode();
		this.applyPosition();
		this.bindBadgeEvents(this.containerEl, false);
		this.bindBadgeEvents(this.dateContainerEl, true);
	}

	/**
	 * Mounts the floating badge inside the specific editor container element,
	 * ensuring it never spills over sidebar panes (e.g. outline pane).
	 */
	public attachToEditor(parentEl: HTMLElement): void {
		if (this.currentParentEl !== parentEl) {
			this.currentParentEl = parentEl;
			parentEl.appendChild(this.containerEl);
			parentEl.appendChild(this.dateContainerEl);
			this.searchTracker.attach(parentEl);
			this.applyPosition();
		}
	}

	private updateLayoutMode(): void {
		const mode = this.settings.datePositionMode === 'custom' ? 'custom' : 'left';

		if (mode === 'custom') {
			this.containerEl.appendChild(this.countGroupEl);
			this.dateContainerEl.appendChild(this.datePillEl);
		} else {
			// 'left'
			this.containerEl.appendChild(this.datePillEl);
			this.containerEl.appendChild(this.countGroupEl);
			this.dateContainerEl.addClass('sgb-hidden');
		}
	}

	private triggerModalOpen(initialTab?: 'count' | 'date'): void {
		let tab = initialTab;
		if (!tab) {
			const isDate = this.lastTargetEl
				? Boolean(this.lastTargetEl.closest('.sgb-date-pill') || this.lastTargetEl.closest('.sgb-date-badge'))
				: false;
			tab = isDate ? 'date' : 'count';
		}
		// Small delay ensures touch/click event lifecycle completes before modal mounts
		window.setTimeout(() => {
			this.onBadgeClick(tab);
		}, MODAL_OPEN_DELAY_MS);
	}

	private bindBadgeEvents(badgeEl: HTMLElement, isDateBadge: boolean): void {
		const startHandler = (clientX: number, clientY: number, targetEl: HTMLElement | null) => {
			this.isDragging = false;
			this.isLongPress = false;
			this.activeDragTarget = isDateBadge ? 'date' : 'main';
			this.dragStartX = clientX;
			this.dragStartY = clientY;
			this.lastTargetEl = targetEl;

			const rect = badgeEl.getBoundingClientRect();
			const parentRect = this.currentParentEl
				? this.currentParentEl.getBoundingClientRect()
				: { left: 0, top: 0 };

			this.initialLeft = rect.left - parentRect.left;
			this.initialTop = rect.top - parentRect.top;

			if (this.settings.longPressToOpenModal) {
				this.pressTimer = window.setTimeout(() => {
					this.isLongPress = true;
					const targetIsDate = isDateBadge || (this.lastTargetEl ? Boolean(this.lastTargetEl.closest('.sgb-date-pill')) : false);
					this.triggerModalOpen(targetIsDate ? 'date' : 'count');
				}, LONG_PRESS_DURATION_MS);
			}
		};

		const moveHandler = (clientX: number, clientY: number) => {
			if (this.activeDragTarget !== (isDateBadge ? 'date' : 'main')) return;
			const dx = clientX - this.dragStartX;
			const dy = clientY - this.dragStartY;

			if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
				this.isDragging = true;
				if (this.pressTimer !== null) {
					window.clearTimeout(this.pressTimer);
					this.pressTimer = null;
				}

				const parentWidth = this.currentParentEl ? this.currentParentEl.offsetWidth : window.innerWidth;
				const parentHeight = this.currentParentEl ? this.currentParentEl.offsetHeight : window.innerHeight;

				const newX = Math.max(0, Math.min(parentWidth - badgeEl.offsetWidth, this.initialLeft + dx));
				const newY = Math.max(0, Math.min(parentHeight - badgeEl.offsetHeight, this.initialTop + dy));

				if (isDateBadge) {
					this.customDatePosition = { x: newX, y: newY };
					this.applyDatePosition();
				} else {
					this.customPosition = { x: newX, y: newY };
					this.applyPosition();
				}
			}
		};

		const endHandler = () => {
			if (this.activeDragTarget !== (isDateBadge ? 'date' : 'main')) return;

			if (this.pressTimer !== null) {
				window.clearTimeout(this.pressTimer);
				this.pressTimer = null;
			}

			if (this.isDragging && this.currentParentEl) {
				const parentWidth = this.currentParentEl.offsetWidth;
				const parentHeight = this.currentParentEl.offsetHeight;
				const badgeWidth = badgeEl.offsetWidth;
				const badgeHeight = badgeEl.offsetHeight;

				if (isDateBadge && this.customDatePosition) {
					const leftDist = this.customDatePosition.x;
					const rightDist = parentWidth - (this.customDatePosition.x + badgeWidth);
					const topDist = this.customDatePosition.y;
					const bottomDist = parentHeight - (this.customDatePosition.y + badgeHeight);

					const isRight = rightDist < leftDist;
					const isBottom = bottomDist < topDist;

					let dateBadgePosition: BadgePositionPreset = 'bottom-right';
					if (isBottom && isRight) dateBadgePosition = 'bottom-right';
					else if (isBottom && !isRight) dateBadgePosition = 'bottom-left';
					else if (!isBottom && isRight) dateBadgePosition = 'top-right';
					else dateBadgePosition = 'top-left';

					const offsetX = Math.max(MIN_BADGE_OFFSET_PX, Math.round(isRight ? rightDist : leftDist));
					const searchShift = !isBottom ? this.searchTracker.getSearchShiftOffset(topDist) : 0;
					const effectiveTopDist = Math.max(MIN_BADGE_OFFSET_PX, topDist - searchShift);
					const offsetY = Math.max(MIN_BADGE_OFFSET_PX, Math.round(isBottom ? bottomDist : effectiveTopDist));

					this.customDatePosition = null;
					this.settings.dateBadgePosition = dateBadgePosition;
					this.settings.dateOffsetX = offsetX;
					this.settings.dateOffsetY = offsetY;
					this.applyDatePosition();

					this.onDatePositionChanged?.({
						dateBadgePosition,
						dateOffsetX: offsetX,
						dateOffsetY: offsetY,
					});
				} else if (!isDateBadge && this.customPosition) {
					const leftDist = this.customPosition.x;
					const rightDist = parentWidth - (this.customPosition.x + badgeWidth);
					const topDist = this.customPosition.y;
					const bottomDist = parentHeight - (this.customPosition.y + badgeHeight);

					const isRight = rightDist < leftDist;
					const isBottom = bottomDist < topDist;

					let badgePosition: BadgePositionPreset = 'bottom-right';
					if (isBottom && isRight) badgePosition = 'bottom-right';
					else if (isBottom && !isRight) badgePosition = 'bottom-left';
					else if (!isBottom && isRight) badgePosition = 'top-right';
					else badgePosition = 'top-left';

					const offsetX = Math.max(MIN_BADGE_OFFSET_PX, Math.round(isRight ? rightDist : leftDist));
					const searchShift = !isBottom ? this.searchTracker.getSearchShiftOffset(topDist) : 0;
					const effectiveTopDist = Math.max(MIN_BADGE_OFFSET_PX, topDist - searchShift);
					const offsetY = Math.max(MIN_BADGE_OFFSET_PX, Math.round(isBottom ? bottomDist : effectiveTopDist));

					this.customPosition = null;
					this.settings.badgePosition = badgePosition;
					this.settings.offsetX = offsetX;
					this.settings.offsetY = offsetY;
					this.applyPosition();

					this.onPositionChanged({
						badgePosition,
						offsetX,
						offsetY,
					});
				}
			} else if (!this.isDragging) {
				if (!this.settings.longPressToOpenModal) {
					const targetIsDate = isDateBadge || (this.lastTargetEl ? Boolean(this.lastTargetEl.closest('.sgb-date-pill')) : false);
					this.triggerModalOpen(targetIsDate ? 'date' : 'count');
				}
			}

			this.isDragging = false;
			this.isLongPress = false;
			this.activeDragTarget = null;
		};

		// Mouse Events
		badgeEl.addEventListener('mousedown', (e: MouseEvent) => {
			if (e.button !== 0) return;
			startHandler(e.clientX, e.clientY, e.target as HTMLElement);

			const onMouseMove = (moveEvent: MouseEvent) => {
				moveHandler(moveEvent.clientX, moveEvent.clientY);
			};

			const onMouseUp = () => {
				document.removeEventListener('mousemove', onMouseMove);
				document.removeEventListener('mouseup', onMouseUp);
				endHandler();
			};

			document.addEventListener('mousemove', onMouseMove);
			document.addEventListener('mouseup', onMouseUp);
		});

		// Touch Events
		badgeEl.addEventListener(
			'touchstart',
			(e: TouchEvent) => {
				e.stopPropagation();
				const touch = e.touches[0];
				if (touch) {
					startHandler(touch.clientX, touch.clientY, e.target as HTMLElement);
				}
			},
			{ passive: true },
		);

		badgeEl.addEventListener(
			'touchmove',
			(e: TouchEvent) => {
				const touch = e.touches[0];
				if (touch) {
					moveHandler(touch.clientX, touch.clientY);
				}
			},
			{ passive: true },
		);

		badgeEl.addEventListener('touchend', (e: TouchEvent) => {
			e.stopPropagation();
			if (!this.isDragging) {
				// Prevent synthesized mouse/click event from hitting modal close button in top-right corner
				if (e.cancelable) {
					e.preventDefault();
				}
			}
			endHandler();
		});
	}

	public updateSettings(settings: PluginSettings): void {
		this.settings = settings;
		this.updateLayoutMode();
		this.applyPosition();
		if (this.currentColorStyle) {
			this.applyColorStyle(this.currentColorStyle);
		}
		if (this.currentProgress) {
			this.updateProgress(this.currentProgress);
		}
	}

	private currentColorStyle: GoalColorStyle | null = null;

	private getStyleStateKey(): string {
		if (!this.currentColorStyle) return '';
		const s = this.currentColorStyle;
		return `${s.id}:${s.type ?? 'discrete'}:${s.colorDefault}:${s.colorWarn}:${s.colorGood}:${s.colorDone}`;
	}

	public applyColorStyle(style: GoalColorStyle): void {
		const prevStyleKey = this.getStyleStateKey();
		this.currentColorStyle = style;
		const colorProps = {
			'--sgb-color-default': style.colorDefault,
			'--sgb-color-warn': style.colorWarn,
			'--sgb-color-good': style.colorGood,
			'--sgb-color-done': style.colorDone,
		};
		setCssProps(this.containerEl, colorProps);
		setCssProps(this.dateContainerEl, colorProps);
		const newStyleKey = this.getStyleStateKey();
		if (prevStyleKey !== newStyleKey && this.currentProgress) {
			this.updateProgress(this.currentProgress);
		}
	}

	public updateProgress(progress: WritingProgress): void {
		this.currentProgress = progress;

		// 0. Target date progress (Leftmost)
		this.renderDatePill(progress.date);

		// 1. Cumulative progress (Center-left)
		if (this.settings.showCumulativeProgress) {
			this.cumulativePillEl.removeClass('sgb-hidden');
			this.renderPill(
				this.cumulativePillEl,
				this.settings.cumulativeLabel !== undefined ? this.settings.cumulativeLabel : 'Cur:',
				progress.cumulative.current,
				progress.cumulative.goal,
				progress.cumulative.percentage,
				this.settings.showCumulativeCurrent ?? true,
				this.settings.showCumulativePercentage,
				this.settings.showCumulativeGoal,
				'text-cursor',
				this.settings.showCumulativeIcon,
				t('BADGE_TOOLTIP_CUMULATIVE'),
				this.settings.showCumulativeProgressBar,
				this.settings.showCumulativeOverflowBar,
			);
		} else {
			this.cumulativePillEl.addClass('sgb-hidden');
		}

		// 2. Section progress (Center)
		if (this.settings.showSectionProgress) {
			this.renderSectionPill(progress);
		} else {
			this.sectionPillEl.addClass('sgb-hidden');
		}

		// 3. Total progress (Right)
		if (this.settings.showTotalProgress) {
			this.totalPillEl.removeClass('sgb-hidden');
			this.renderPill(
				this.totalPillEl,
				this.settings.totalLabel !== undefined ? this.settings.totalLabel : 'All:',
				progress.total.current,
				progress.total.goal,
				progress.total.percentage,
				this.settings.showTotalCurrent ?? true,
				this.settings.showTotalPercentage,
				this.settings.showTotalGoal,
				'book-text',
				this.settings.showTotalIcon,
				t('BADGE_TOOLTIP_TOTAL'),
				this.settings.showTotalProgressBar,
				this.settings.showTotalOverflowBar,
			);
		} else {
			this.totalPillEl.addClass('sgb-hidden');
		}

		// Manage visibility of outer capsules
		const isCustomMode = this.settings.datePositionMode === 'custom';
		const hasDatePillVisible = !this.datePillEl.classList.contains('sgb-hidden');
		const hasSectionPillVisible = !this.sectionPillEl.classList.contains('sgb-hidden');
		const hasCountPillsVisible =
			this.settings.showCumulativeProgress ||
			hasSectionPillVisible ||
			this.settings.showTotalProgress;

		if (isCustomMode) {
			if (!hasCountPillsVisible) {
				this.containerEl.addClass('sgb-hidden');
			} else {
				this.containerEl.removeClass('sgb-hidden');
			}

			if (hasDatePillVisible) {
				this.dateContainerEl.removeClass('sgb-hidden');
			} else {
				this.dateContainerEl.addClass('sgb-hidden');
			}
		} else {
			this.dateContainerEl.addClass('sgb-hidden');
			const hasVisiblePill = hasDatePillVisible || hasCountPillsVisible;
			if (!hasVisiblePill) {
				this.containerEl.addClass('sgb-hidden');
			} else {
				this.containerEl.removeClass('sgb-hidden');
			}
		}
	}

	private renderDatePill(dateInfo?: DateProgressInfo | null): void {
		const hasDate = Boolean(
			dateInfo && (dateInfo.targetDate !== undefined || dateInfo.startDate !== undefined),
		);

		if (
			!this.settings.showDateProgress ||
			(!hasDate && !this.settings.showDateWhenUnset)
		) {
			this.datePillEl.addClass('sgb-hidden');
			return;
		}

		this.datePillEl.removeClass('sgb-hidden');

		if (!hasDate || !dateInfo) {
			const color = this.settings.dateColorNormal;
			const stateKey = `unset|${this.settings.showDateIcon}|${color}`;

			if (this.datePillEl.dataset.sgbState === stateKey) {
				return;
			}
			this.datePillEl.dataset.sgbState = stateKey;
			this.datePillEl.empty();

			this.datePillEl.title = t('BADGE_TOOLTIP_DATE_UNSET');

			const capsuleEl = this.datePillEl.createDiv({ cls: 'sgb-pill sgb-date-pill-capsule sgb-date-unset' });
			capsuleEl.removeClass('is-progress-bar');
			capsuleEl.removeClass('sgb-date-progress');
			capsuleEl.removeClass('sgb-date-overdue');

			// Icon
			if (this.settings.showDateIcon) {
				const iconEl = capsuleEl.createSpan({ cls: 'sgb-pill-icon' });
				setIcon(iconEl, 'calendar');
			}

			// Dash placeholder text
			const textWrapper = capsuleEl.createSpan({ cls: 'sgb-pill-text sgb-date-pill-text' });
			textWrapper.createSpan({ cls: 'sgb-date-number sgb-date-unset-dash', text: '-' });

			setCssProps(capsuleEl, {
				'--sgb-date-fill-color': color,
				'--sgb-fill-pct': '0%',
			});
			return;
		}

		const remaining = dateInfo.remainingDays;
		const remainingHours = dateInfo.remainingHours;
		const percentage = dateInfo.percentage;
		const color = getDateProgressColor(dateInfo, this.settings);
		const daysUnit = this.settings.dateUnitDays ?? '';
		const hoursUnit = this.settings.dateUnitHours ?? '';
		const isOverdue = !!dateInfo.isOverdue || (remaining !== undefined && remaining < 0) || (remaining === 0 && remainingHours !== undefined && remainingHours < 0);
		const label = isOverdue
			? (this.settings.dateOverdueLabel ?? '')
			: (this.settings.dateLabel ?? '');

		const stateKey = `${dateInfo.currentCycleTarget ?? ''}|${dateInfo.currentCycleStart ?? ''}|${remaining}|${remainingHours}|${percentage}|${this.settings.showDateIcon}|${label}|${this.settings.showDateProgressBar}|${this.settings.showDateHoursAlways}|${daysUnit}|${hoursUnit}|${color}|${isOverdue}`;

		if (this.datePillEl.dataset.sgbState === stateKey) {
			return;
		}
		this.datePillEl.dataset.sgbState = stateKey;
		this.datePillEl.empty();

		const targetDisplay = dateInfo.currentCycleTarget || dateInfo.targetDate || '';
		this.datePillEl.title = t('BADGE_TOOLTIP_DATE', { date: targetDisplay });

		const capsuleEl = this.datePillEl.createDiv({ cls: 'sgb-pill sgb-date-pill-capsule' });
		capsuleEl.classList.toggle('is-progress-bar', !!this.settings.showDateProgressBar);

		// Icon
		if (this.settings.showDateIcon) {
			const iconEl = capsuleEl.createSpan({ cls: 'sgb-pill-icon' });
			setIcon(iconEl, 'calendar');
		}

		// Days/Hours text with label, numbers, and units separated for fine typography
		if (remaining !== undefined) {
			const textWrapper = capsuleEl.createSpan({ cls: 'sgb-pill-text sgb-date-pill-text' });
			if (label && label.length > 0) {
				textWrapper.createSpan({ cls: 'sgb-date-label', text: label });
			}

			const absDays = Math.abs(remaining);
			const absHours = remainingHours !== undefined ? Math.abs(remainingHours) : undefined;

			// When under 24 hours (absDays is 0), show remaining hours
			if (absDays === 0 && absHours !== undefined) {
				textWrapper.createSpan({ cls: 'sgb-date-number', text: String(absHours) });
				if (hoursUnit && hoursUnit.length > 0) {
					textWrapper.createSpan({ cls: 'sgb-date-unit', text: hoursUnit });
				}
			} else {
				// 1 day or more (or overdue by 1 day or more)
				textWrapper.createSpan({ cls: 'sgb-date-number', text: String(absDays) });
				if (daysUnit && daysUnit.length > 0) {
					textWrapper.createSpan({ cls: 'sgb-date-unit', text: daysUnit });
				}
				// If showDateHoursAlways option is enabled, also append remaining hours
				if (this.settings.showDateHoursAlways && absHours !== undefined) {
					textWrapper.createSpan({ cls: 'sgb-date-number sgb-date-sub-number', text: String(absHours) });
					if (hoursUnit && hoursUnit.length > 0) {
						textWrapper.createSpan({ cls: 'sgb-date-unit sgb-date-sub-unit', text: hoursUnit });
					}
				}
			}
		}

		// Color & Progress Gauge
		setCssProps(capsuleEl, {
			'--sgb-date-fill-color': color,
		});

		if (percentage !== undefined && this.settings.showDateProgressBar) {
			const clampedPct = Math.min(100, Math.max(0, percentage));
			setCssProps(capsuleEl, {
				'--sgb-fill-pct': `${clampedPct}%`,
			});
			capsuleEl.addClass('is-progress-bar');
			capsuleEl.addClass('sgb-date-progress');
		} else {
			setCssProps(capsuleEl, {
				'--sgb-fill-pct': '0%',
			});
			capsuleEl.removeClass('is-progress-bar');
			if (dateInfo.isOverdue) {
				capsuleEl.addClass('sgb-date-overdue');
			}
		}
	}

	private renderSectionPill(progress: WritingProgress): void {
		const enabledLevels: number[] = [];
		if (this.settings.showHeadingLevel1) enabledLevels.push(1);
		if (this.settings.showHeadingLevel2) enabledLevels.push(2);
		if (this.settings.showHeadingLevel3) enabledLevels.push(3);
		if (this.settings.showHeadingLevel4) enabledLevels.push(4);
		if (this.settings.showHeadingLevel5) enabledLevels.push(5);
		if (this.settings.showHeadingLevel6) enabledLevels.push(6);

		// If no heading level toggles are enabled, fallback to classic single section display
		if (enabledLevels.length === 0) {
			this.sectionPillEl.removeClass('sgb-section-pill-multiline');
			if (!progress.currentSection) {
				this.sectionPillEl.addClass('sgb-hidden');
				return;
			}
			this.sectionPillEl.removeClass('sgb-hidden');
			this.renderPill(
				this.sectionPillEl,
				this.settings.sectionLabel !== undefined ? this.settings.sectionLabel : 'Sec:',
				progress.currentSection.current,
				progress.currentSection.goal,
				progress.currentSection.percentage,
				this.settings.showSectionCurrent ?? true,
				this.settings.showSectionPercentage,
				this.settings.showSectionGoal,
				'hash',
				this.settings.showSectionIcon,
				t('BADGE_TOOLTIP_SECTION', { heading: progress.currentSection.heading }),
				this.settings.showSectionProgressBar,
				this.settings.showSectionOverflowBar,
			);
			return;
		}

		// Filter active levels matching enabled levels
		const activeItems = (progress.sectionLevels || []).filter((item) => enabledLevels.includes(item.level));

		if (activeItems.length === 0) {
			this.sectionPillEl.addClass('sgb-hidden');
			return;
		}

		this.sectionPillEl.removeClass('sgb-hidden');
		this.sectionPillEl.addClass('sgb-section-pill-multiline');

		const baseLabel = this.settings.sectionLabel !== undefined ? this.settings.sectionLabel : 'Sec:';
		const styleKey = this.getStyleStateKey();
		const stateKey =
			'multiline|' +
			activeItems
				.map((it) => `${it.level}:${it.current}:${it.goal ?? ''}:${it.percentage ?? ''}:${it.heading}`)
				.join(';') +
			`|${baseLabel}|${this.settings.showSectionIcon}|${this.settings.showSectionCurrent ?? true}|${this.settings.showSectionPercentage}|${this.settings.showSectionGoal}|${this.settings.showSectionProgressBar}|${this.settings.showSectionOverflowBar}|${styleKey}`;

		if (this.sectionPillEl.dataset.sgbState === stateKey) {
			return;
		}
		this.sectionPillEl.dataset.sgbState = stateKey;
		this.sectionPillEl.empty();

		// Overall tooltip using the deepest active heading
		// Clear progress class from outer pill in multiline mode to keep uniform background
		this.sectionPillEl.className = this.sectionPillEl.className.replace(/\bis-progress-\w+/g, '');
		const deepestItem = activeItems[activeItems.length - 1];
		if (deepestItem) {
			this.sectionPillEl.title = t('BADGE_TOOLTIP_SECTION', { heading: deepestItem.heading });
		}

		// Render each level as a row inside the section pill
		for (const item of activeItems) {
			const rowWrapperEl = this.sectionPillEl.createDiv({ cls: 'sgb-section-row-wrapper' });
			rowWrapperEl.title = t('BADGE_TOOLTIP_SECTION', { heading: item.heading });

			const rowEl = rowWrapperEl.createDiv({ cls: 'sgb-section-row' });
			rowEl.classList.toggle('is-progress-bar', !!this.settings.showSectionProgressBar);

			// Icon
			if (this.settings.showSectionIcon) {
				const iconEl = rowEl.createSpan({ cls: 'sgb-pill-icon' });
				setIcon(iconEl, `heading-${item.level}`);
			}

			// Prefix text (e.g. "1" or "Sec:1")
			if (!this.settings.showSectionIcon || (baseLabel && baseLabel.trim().length > 0)) {
				let prefix = baseLabel.trim();
				if (prefix.length === 0) {
					prefix = `${item.level}`;
				} else if (prefix.endsWith(':')) {
					prefix = `${prefix.slice(0, -1)}:${item.level}`;
				} else {
					prefix = `${prefix}:${item.level}`;
				}
				rowEl.createSpan({ cls: 'sgb-pill-prefix', text: prefix });
			}

			// Count text
			const showCurrent = this.settings.showSectionCurrent ?? true;
			const showGoal = this.settings.showSectionGoal;
			const showPercent = this.settings.showSectionPercentage;

			let countText = '';
			if (showCurrent && showGoal && item.goal !== undefined && item.goal > 0) {
				countText = `${item.current.toLocaleString()} / ${item.goal.toLocaleString()}`;
			} else if (showCurrent) {
				countText = item.current.toLocaleString();
			} else if (showGoal && item.goal !== undefined && item.goal > 0) {
				countText = `/ ${item.goal.toLocaleString()}`;
			}

			let text = '';
			if (showPercent) {
				const percentLabel = item.percentage !== undefined ? `${item.percentage}%` : '-';
				if (countText.length > 0) {
					text = `${percentLabel} (${countText})`;
				} else {
					text = percentLabel;
				}
			} else {
				text = countText;
			}

			if (text.length > 0) {
				rowEl.createSpan({ cls: 'sgb-pill-text', text });
			}

			// Apply color individually per row
			if (item.percentage !== undefined) {
				this.applyProgressClass(rowEl, item.percentage);
				if (this.settings.showSectionProgressBar && this.settings.showSectionOverflowBar) {
					const segments = calculateOverflowSegments(item.percentage);
					if (segments.length > 0) {
						const overflowBarEl = rowWrapperEl.createDiv({ cls: 'sgb-pill-overflow-bar' });
						for (const segFill of segments) {
							const segEl = overflowBarEl.createDiv({ cls: 'sgb-pill-overflow-segment' });
							const fill = segEl.createDiv({ cls: 'sgb-pill-overflow-fill' });
							fill.style.width = `${segFill}%`;
						}
					}
				}
			} else {
				rowEl.className = rowEl.className.replace(/\bis-progress-\w+/g, '');
				setCssProps(rowEl, {
					'--sgb-fill-pct': '0%',
					'--sgb-progress-ratio': '0',
				});
			}
		}
	}

	private renderPill(
		wrapperEl: HTMLElement,
		prefix: string,
		current: number,
		goal: number | undefined,
		percentage: number | undefined,
		showCurrent: boolean,
		showPercent: boolean,
		showGoal: boolean,
		iconName?: string,
		showIcon?: boolean,
		titleTooltip?: string,
		isProgressBar?: boolean,
		isOverflowBar?: boolean,
	): void {
		const styleKey = this.getStyleStateKey();
		const stateKey = `${prefix}|${current}|${goal ?? ''}|${percentage ?? ''}|${showCurrent}|${showPercent}|${showGoal}|${showIcon}|${iconName ?? ''}|${titleTooltip ?? ''}|${isProgressBar ?? false}|${isOverflowBar ?? false}|${styleKey}`;
		if (wrapperEl.dataset.sgbState === stateKey) {
			return;
		}
		wrapperEl.dataset.sgbState = stateKey;

		wrapperEl.empty();
		if (titleTooltip) {
			wrapperEl.title = titleTooltip;
		}

		// Capsule element (main pill)
		const capsuleEl = wrapperEl.createDiv({ cls: 'sgb-pill' });
		capsuleEl.classList.toggle('is-progress-bar', !!isProgressBar);

		// Render Lucide Icon if enabled
		if (showIcon && iconName) {
			const iconEl = capsuleEl.createSpan({ cls: 'sgb-pill-icon' });
			setIcon(iconEl, iconName);
		}

		// Render Prefix Text if configured
		if (prefix && prefix.trim().length > 0) {
			capsuleEl.createSpan({ cls: 'sgb-pill-prefix', text: prefix });
		}

		// Format count text
		let countText = '';
		if (showCurrent && showGoal && goal !== undefined && goal > 0) {
			countText = `${current.toLocaleString()} / ${goal.toLocaleString()}`;
		} else if (showCurrent) {
			countText = current.toLocaleString();
		} else if (showGoal && goal !== undefined && goal > 0) {
			countText = `/ ${goal.toLocaleString()}`;
		}

		// Format final text with percentage
		let text = '';
		if (showPercent) {
			const percentLabel = percentage !== undefined ? `${percentage}%` : '-';
			if (countText.length > 0) {
				text = `${percentLabel} (${countText})`;
			} else {
				text = percentLabel;
			}
		} else {
			text = countText;
		}

		if (text.length > 0) {
			capsuleEl.createSpan({ cls: 'sgb-pill-text', text });
		}

		if (percentage !== undefined) {
			this.applyProgressClass(capsuleEl, percentage);
			if (isProgressBar && isOverflowBar) {
				const segments = calculateOverflowSegments(percentage);
				if (segments.length > 0) {
					const overflowBarEl = wrapperEl.createDiv({ cls: 'sgb-pill-overflow-bar' });
					for (const segFill of segments) {
						const segEl = overflowBarEl.createDiv({ cls: 'sgb-pill-overflow-segment' });
						const fill = segEl.createDiv({ cls: 'sgb-pill-overflow-fill' });
						fill.style.width = `${segFill}%`;
					}
				}
			}
		} else {
			capsuleEl.className = capsuleEl.className.replace(/\bis-progress-\w+/g, '');
			setCssProps(capsuleEl, {
				'--sgb-fill-pct': '0%',
				'--sgb-progress-ratio': '0',
			});
		}
	}

	private applyProgressClass(el: HTMLElement, percentage: number): void {
		el.removeClass('is-progress-default');
		el.removeClass('is-progress-warn');
		el.removeClass('is-progress-good');
		el.removeClass('is-progress-done');
		el.removeClass('is-progress-gradient');

		const style = this.currentColorStyle;
		if (style?.type === 'gradient') {
			el.addClass('is-progress-gradient');
			const currentColor = getProgressColor(style, percentage, {
				warn: this.settings.colorThresholdWarn,
				good: this.settings.colorThresholdGood,
				done: this.settings.colorThresholdDone,
			});
			setCssProps(el, {
				'--sgb-color-current': currentColor,
			});
		} else {
			if (percentage >= this.settings.colorThresholdDone) {
				el.addClass('is-progress-done');
			} else if (percentage >= this.settings.colorThresholdGood) {
				el.addClass('is-progress-good');
			} else if (percentage >= this.settings.colorThresholdWarn) {
				el.addClass('is-progress-warn');
			} else {
				el.addClass('is-progress-default');
			}
		}

		const clampedPct = Math.min(100, Math.max(0, percentage));
		setCssProps(el, {
			'--sgb-fill-pct': `${clampedPct}%`,
			'--sgb-progress-ratio': `${clampedPct / 100}`,
		});
	}

	public applyPosition(): void {
		if (this.customPosition) {
			const isBottom = this.currentParentEl
				? this.customPosition.y > this.currentParentEl.offsetHeight / 2
				: true;
			const isRight = this.currentParentEl
				? this.customPosition.x > this.currentParentEl.offsetWidth / 2
				: true;
			this.containerEl.classList.toggle('is-pos-bottom', isBottom);
			this.containerEl.classList.toggle('is-pos-top', !isBottom);
			this.containerEl.classList.toggle('is-pos-right', isRight);
			this.containerEl.classList.toggle('is-pos-left', !isRight);

			setCssProps(this.containerEl, {
				'--sgb-badge-left': `${this.customPosition.x}px`,
				'--sgb-badge-top': `${this.customPosition.y}px`,
				'--sgb-badge-right': 'auto',
				'--sgb-badge-bottom': 'auto',
				'--sgb-badge-opacity': `${this.settings.badgeOpacity}`,
				'--sgb-badge-font-size': `${this.settings.fontSize || DEFAULT_FONT_SIZE_PX}px`,
			});
		} else {
			const { badgePosition, offsetX, offsetY } = this.settings;
			const { bottomOffset } = ViewportTracker.getViewportOffset();
			const isBottom = badgePosition.includes('bottom');
			const isRight = badgePosition.includes('right');

			const searchShift = !isBottom ? this.searchTracker.getSearchShiftOffset(offsetY) : 0;

			this.containerEl.classList.toggle('is-pos-bottom', isBottom);
			this.containerEl.classList.toggle('is-pos-top', !isBottom);
			this.containerEl.classList.toggle('is-pos-right', isRight);
			this.containerEl.classList.toggle('is-pos-left', !isRight);

			setCssProps(this.containerEl, {
				'--sgb-badge-left': isRight ? 'auto' : `${offsetX}px`,
				'--sgb-badge-right': isRight ? `${offsetX}px` : 'auto',
				'--sgb-badge-top': isBottom ? 'auto' : `${offsetY + searchShift}px`,
				'--sgb-badge-bottom': isBottom ? `${offsetY + bottomOffset}px` : 'auto',
				'--sgb-badge-opacity': `${this.settings.badgeOpacity}`,
				'--sgb-badge-font-size': `${this.settings.fontSize || DEFAULT_FONT_SIZE_PX}px`,
			});
		}

		this.applyDatePosition();
	}

	public applyDatePosition(): void {
		if (this.customDatePosition) {
			const isBottom = this.currentParentEl
				? this.customDatePosition.y > this.currentParentEl.offsetHeight / 2
				: true;
			const isRight = this.currentParentEl
				? this.customDatePosition.x > this.currentParentEl.offsetWidth / 2
				: true;
			this.dateContainerEl.classList.toggle('is-pos-bottom', isBottom);
			this.dateContainerEl.classList.toggle('is-pos-top', !isBottom);
			this.dateContainerEl.classList.toggle('is-pos-right', isRight);
			this.dateContainerEl.classList.toggle('is-pos-left', !isRight);

			setCssProps(this.dateContainerEl, {
				'--sgb-date-badge-left': `${this.customDatePosition.x}px`,
				'--sgb-date-badge-top': `${this.customDatePosition.y}px`,
				'--sgb-date-badge-right': 'auto',
				'--sgb-date-badge-bottom': 'auto',
				'--sgb-date-badge-font-size': `${this.settings.dateFontSize || DEFAULT_FONT_SIZE_PX}px`,
				'--sgb-badge-font-size': `${this.settings.dateFontSize || DEFAULT_FONT_SIZE_PX}px`,
				'--sgb-badge-opacity': `${this.settings.dateBadgeOpacity ?? this.settings.badgeOpacity}`,
			});
		} else {
			const dateBadgePosition = this.settings.dateBadgePosition || 'top-left';
			const offsetX = this.settings.dateOffsetX ?? 20;
			const offsetY = this.settings.dateOffsetY ?? 40;
			const { bottomOffset } = ViewportTracker.getViewportOffset();
			const isBottom = dateBadgePosition.includes('bottom');
			const isRight = dateBadgePosition.includes('right');

			const searchShift = !isBottom ? this.searchTracker.getSearchShiftOffset(offsetY) : 0;

			this.dateContainerEl.classList.toggle('is-pos-bottom', isBottom);
			this.dateContainerEl.classList.toggle('is-pos-top', !isBottom);
			this.dateContainerEl.classList.toggle('is-pos-right', isRight);
			this.dateContainerEl.classList.toggle('is-pos-left', !isRight);

			setCssProps(this.dateContainerEl, {
				'--sgb-date-badge-left': isRight ? 'auto' : `${offsetX}px`,
				'--sgb-date-badge-right': isRight ? `${offsetX}px` : 'auto',
				'--sgb-date-badge-top': isBottom ? 'auto' : `${offsetY + searchShift}px`,
				'--sgb-date-badge-bottom': isBottom ? `${offsetY + bottomOffset}px` : 'auto',
				'--sgb-date-badge-font-size': `${this.settings.dateFontSize || DEFAULT_FONT_SIZE_PX}px`,
				'--sgb-badge-font-size': `${this.settings.dateFontSize || DEFAULT_FONT_SIZE_PX}px`,
				'--sgb-badge-opacity': `${this.settings.dateBadgeOpacity ?? this.settings.badgeOpacity}`,
			});
		}
	}

	public show(): void {
		this.containerEl.removeClass('sgb-hidden');
		if (this.settings.datePositionMode === 'custom' && !this.datePillEl.classList.contains('sgb-hidden')) {
			this.dateContainerEl.removeClass('sgb-hidden');
		}
	}

	public hide(): void {
		this.containerEl.addClass('sgb-hidden');
		this.dateContainerEl.addClass('sgb-hidden');
	}

	public destroy(): void {
		if (this.pressTimer !== null) {
			window.clearTimeout(this.pressTimer);
			this.pressTimer = null;
		}
		this.searchTracker.destroy();
		this.containerEl.remove();
		this.dateContainerEl.remove();
	}
}
