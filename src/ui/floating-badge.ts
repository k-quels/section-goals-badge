import { setIcon } from 'obsidian';
import { t } from '../lang/helpers';
import { BadgePositionPreset, GoalColorStyle, PluginSettings, WritingProgress } from '../types';
import { setCssProps } from '../utils/dom';
import { ViewportTracker } from '../utils/viewport';

export class FloatingBadge {
	private containerEl: HTMLElement;
	private cumulativePillEl: HTMLElement;
	private sectionPillEl: HTMLElement;
	private totalPillEl: HTMLElement;

	private settings: PluginSettings;
	private onBadgeClick: () => void;
	private onPositionChanged: (pos: { badgePosition: BadgePositionPreset; offsetX: number; offsetY: number }) => void;
	private currentParentEl: HTMLElement | null = null;
	private currentProgress: WritingProgress | null = null;

	// Dragging state
	private isDragging = false;
	private dragStartX = 0;
	private dragStartY = 0;
	private initialLeft = 0;
	private initialTop = 0;
	private customPosition: { x: number; y: number } | null = null;

	// Long press timer
	private pressTimer: number | null = null;
	private isLongPress = false;

	constructor(
		settings: PluginSettings,
		onBadgeClick: () => void,
		onPositionChanged: (pos: { badgePosition: BadgePositionPreset; offsetX: number; offsetY: number }) => void,
	) {
		this.settings = settings;
		this.onBadgeClick = onBadgeClick;
		this.onPositionChanged = onPositionChanged;

		this.containerEl = createDiv({ cls: 'section-goals-badge' });
		setCssProps(this.containerEl, {
			'--sgb-badge-opacity': `${this.settings.badgeOpacity}`,
			'--sgb-badge-font-size': `${this.settings.fontSize || 11}px`,
		});

		// 1. Cumulative progress pill (Leftmost)
		this.cumulativePillEl = this.containerEl.createDiv({
			cls: 'sgb-pill sgb-cumulative-pill sgb-hidden',
		});

		// 2. Section progress pill (Center)
		this.sectionPillEl = this.containerEl.createDiv({
			cls: 'sgb-pill sgb-section-pill sgb-hidden',
		});

		// 3. Total progress pill (Right)
		this.totalPillEl = this.containerEl.createDiv({
			cls: 'sgb-pill sgb-total-pill sgb-hidden',
		});

		this.applyPosition();
		this.bindEvents();
	}

	/**
	 * Mounts the floating badge inside the specific editor container element,
	 * ensuring it never spills over sidebar panes (e.g. outline pane).
	 */
	public attachToEditor(parentEl: HTMLElement): void {
		if (this.currentParentEl !== parentEl) {
			this.currentParentEl = parentEl;
			parentEl.appendChild(this.containerEl);
			this.applyPosition();
		}
	}

	private triggerModalOpen(): void {
		// Small delay ensures touch/click event lifecycle completes before modal mounts
		window.setTimeout(() => {
			this.onBadgeClick();
		}, 60);
	}

	private bindEvents(): void {
		const startHandler = (clientX: number, clientY: number) => {
			this.isDragging = false;
			this.isLongPress = false;
			this.dragStartX = clientX;
			this.dragStartY = clientY;

			const rect = this.containerEl.getBoundingClientRect();
			const parentRect = this.currentParentEl
				? this.currentParentEl.getBoundingClientRect()
				: { left: 0, top: 0 };

			this.initialLeft = rect.left - parentRect.left;
			this.initialTop = rect.top - parentRect.top;

			if (this.settings.longPressToOpenModal) {
				this.pressTimer = window.setTimeout(() => {
					this.isLongPress = true;
					this.triggerModalOpen();
				}, 600);
			}
		};

		const moveHandler = (clientX: number, clientY: number) => {
			const dx = clientX - this.dragStartX;
			const dy = clientY - this.dragStartY;

			if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
				this.isDragging = true;
				if (this.pressTimer !== null) {
					window.clearTimeout(this.pressTimer);
					this.pressTimer = null;
				}

				const parentWidth = this.currentParentEl ? this.currentParentEl.offsetWidth : window.innerWidth;
				const parentHeight = this.currentParentEl ? this.currentParentEl.offsetHeight : window.innerHeight;

				const newX = Math.max(0, Math.min(parentWidth - this.containerEl.offsetWidth, this.initialLeft + dx));
				const newY = Math.max(0, Math.min(parentHeight - this.containerEl.offsetHeight, this.initialTop + dy));

				this.customPosition = { x: newX, y: newY };
				this.applyPosition();
			}
		};

		const endHandler = () => {
			if (this.pressTimer !== null) {
				window.clearTimeout(this.pressTimer);
				this.pressTimer = null;
			}

			if (this.isDragging && this.customPosition && this.currentParentEl) {
				// Persist dragged position to settings by finding nearest corner preset & offsets
				const parentWidth = this.currentParentEl.offsetWidth;
				const parentHeight = this.currentParentEl.offsetHeight;
				const badgeWidth = this.containerEl.offsetWidth;
				const badgeHeight = this.containerEl.offsetHeight;

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
				const offsetX = Math.max(4, Math.round(isRight ? rightDist : leftDist));
				const offsetY = Math.max(4, Math.round(isBottom ? bottomDist : topDist));

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
			} else if (!this.isDragging) {
				if (!this.settings.longPressToOpenModal || this.isLongPress) {
					this.triggerModalOpen();
				}
			}

			this.isDragging = false;
			this.isLongPress = false;
		};

		// Mouse Events
		this.containerEl.addEventListener('mousedown', (e: MouseEvent) => {
			if (e.button !== 0) return;
			startHandler(e.clientX, e.clientY);

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
		this.containerEl.addEventListener(
			'touchstart',
			(e: TouchEvent) => {
				e.stopPropagation();
				const touch = e.touches[0];
				if (touch) {
					startHandler(touch.clientX, touch.clientY);
				}
			},
			{ passive: true },
		);

		this.containerEl.addEventListener(
			'touchmove',
			(e: TouchEvent) => {
				const touch = e.touches[0];
				if (touch) {
					moveHandler(touch.clientX, touch.clientY);
				}
			},
			{ passive: true },
		);

		this.containerEl.addEventListener('touchend', (e: TouchEvent) => {
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
		this.applyPosition();
		if (this.currentColorStyle) {
			this.applyColorStyle(this.currentColorStyle);
		}
		if (this.currentProgress) {
			this.updateProgress(this.currentProgress);
		}
	}

	private currentColorStyle: GoalColorStyle | null = null;

	public applyColorStyle(style: GoalColorStyle): void {
		this.currentColorStyle = style;
		setCssProps(this.containerEl, {
			'--sgb-color-default': style.colorDefault,
			'--sgb-color-warn': style.colorWarn,
			'--sgb-color-good': style.colorGood,
			'--sgb-color-done': style.colorDone,
		});
	}

	public updateProgress(progress: WritingProgress): void {
		this.currentProgress = progress;

		// 1. Cumulative progress (Leftmost)
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
			);
		} else {
			this.totalPillEl.addClass('sgb-hidden');
		}

		// If all pills are hidden, hide the outer badge capsule as well
		const hasSectionPillVisible = !this.sectionPillEl.classList.contains('sgb-hidden');
		const hasVisiblePill =
			this.settings.showCumulativeProgress ||
			hasSectionPillVisible ||
			this.settings.showTotalProgress;

		if (!hasVisiblePill) {
			this.containerEl.addClass('sgb-hidden');
		} else {
			this.containerEl.removeClass('sgb-hidden');
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
		const stateKey =
			'multiline|' +
			activeItems
				.map((it) => `${it.level}:${it.current}:${it.goal ?? ''}:${it.percentage ?? ''}:${it.heading}`)
				.join(';') +
			`|${baseLabel}|${this.settings.showSectionIcon}|${this.settings.showSectionCurrent ?? true}|${this.settings.showSectionPercentage}|${this.settings.showSectionGoal}`;

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
			const rowEl = this.sectionPillEl.createDiv({ cls: 'sgb-section-row' });
			rowEl.title = t('BADGE_TOOLTIP_SECTION', { heading: item.heading });

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
			}
		}
	}

	private renderPill(
		el: HTMLElement,
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
	): void {
		const stateKey = `${prefix}|${current}|${goal ?? ''}|${percentage ?? ''}|${showCurrent}|${showPercent}|${showGoal}|${showIcon}|${iconName ?? ''}|${titleTooltip ?? ''}`;
		if (el.dataset.sgbState === stateKey) {
			return;
		}
		el.dataset.sgbState = stateKey;

		el.empty();
		if (titleTooltip) {
			el.title = titleTooltip;
		}

		// Render Lucide Icon if enabled
		if (showIcon && iconName) {
			const iconEl = el.createSpan({ cls: 'sgb-pill-icon' });
			setIcon(iconEl, iconName);
		}

		// Render Prefix Text if configured
		if (prefix && prefix.trim().length > 0) {
			el.createSpan({ cls: 'sgb-pill-prefix', text: prefix });
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
			el.createSpan({ cls: 'sgb-pill-text', text });
		}

		if (percentage !== undefined) {
			this.applyProgressClass(el, percentage);
		} else {
			el.className = el.className.replace(/\bis-progress-\w+/g, '');
		}
	}

	private applyProgressClass(el: HTMLElement, percentage: number): void {
		el.removeClass('is-progress-default');
		el.removeClass('is-progress-warn');
		el.removeClass('is-progress-good');
		el.removeClass('is-progress-done');

		if (percentage >= this.settings.colorThresholdDone) {
			el.addClass('is-progress-done');
		} else if (percentage >= this.settings.colorThresholdGood) {
			el.addClass('is-progress-good');
		} else if (percentage >= this.settings.colorThresholdWarn) {
			el.addClass('is-progress-warn');
		} else {
			el.addClass('is-progress-default');
		}

		setCssProps(el, {
			'--sgb-progress-ratio': `${Math.min(100, Math.max(0, percentage)) / 100}`,
		});
	}

	public applyPosition(): void {
		if (this.customPosition) {
			const isBottom = this.currentParentEl
				? this.customPosition.y > this.currentParentEl.offsetHeight / 2
				: true;
			this.containerEl.classList.toggle('is-pos-bottom', isBottom);
			this.containerEl.classList.toggle('is-pos-top', !isBottom);

			setCssProps(this.containerEl, {
				'--sgb-badge-left': `${this.customPosition.x}px`,
				'--sgb-badge-top': `${this.customPosition.y}px`,
				'--sgb-badge-right': 'auto',
				'--sgb-badge-bottom': 'auto',
				'--sgb-badge-opacity': `${this.settings.badgeOpacity}`,
				'--sgb-badge-font-size': `${this.settings.fontSize || 11}px`,
			});
		} else {
			const { badgePosition, offsetX, offsetY } = this.settings;
			const { bottomOffset } = ViewportTracker.getViewportOffset();

			const isBottom = badgePosition.includes('bottom');
			const isRight = badgePosition.includes('right');

			this.containerEl.classList.toggle('is-pos-bottom', isBottom);
			this.containerEl.classList.toggle('is-pos-top', !isBottom);

			setCssProps(this.containerEl, {
				'--sgb-badge-left': isRight ? 'auto' : `${offsetX}px`,
				'--sgb-badge-right': isRight ? `${offsetX}px` : 'auto',
				'--sgb-badge-top': isBottom ? 'auto' : `${offsetY}px`,
				'--sgb-badge-bottom': isBottom ? `${offsetY + bottomOffset}px` : 'auto',
				'--sgb-badge-opacity': `${this.settings.badgeOpacity}`,
				'--sgb-badge-font-size': `${this.settings.fontSize || 11}px`,
			});
		}
	}

	public show(): void {
		this.containerEl.removeClass('sgb-hidden');
	}

	public hide(): void {
		this.containerEl.addClass('sgb-hidden');
	}

	public destroy(): void {
		if (this.pressTimer !== null) {
			window.clearTimeout(this.pressTimer);
			this.pressTimer = null;
		}
		this.containerEl.remove();
	}
}
