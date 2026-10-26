export type CountType = 'character' | 'word';

export interface HeadingGoalItem {
	[heading: string]: number;
}

export interface SectionGoalItem {
	heading: string;
	goal?: number;
	index?: number;
	occurrence?: number; // legacy alias for index
	'target-date'?: string;
	'start-date'?: string;
	target?: string; // legacy alias for target-date
	start?: string; // legacy alias for start-date
	cycle?: string;
}

export type ColorStyleType = 'discrete' | 'gradient';

export interface GoalColorStyle {
	id: number;
	name: string;
	type?: ColorStyleType;
	colorDefault: string;
	colorWarn: string;
	colorGood: string;
	colorDone: string;
	isPreset?: boolean;
}

export interface GoalFrontmatter {
	'goal-file'?: number;
	'goal-section'?: number;
	'goal-section-h1'?: number;
	'goal-section-h2'?: number;
	'goal-section-h3'?: number;
	'goal-section-h4'?: number;
	'goal-section-h5'?: number;
	'goal-section-h6'?: number;
	'goal-style'?: number;
	goals?: Array<HeadingGoalItem | SectionGoalItem>;
	'goal-target-date'?: string;
	'goal-start-date'?: string;
	'goal-cycle'?: string;
	'goal-date-reference'?: DateReferenceMode;
	'goal-dates'?: SectionGoalItem[]; // legacy fallback for backward compatibility
}

export type DateReferenceMode = 'parent' | 'note' | 'none';
export type DateCycleUnit = 'day' | 'week' | 'month' | 'year';
export type DateBadgePositionMode = 'left' | 'custom';

export interface DateCycle {
	value: number;
	unit: DateCycleUnit;
}

export type SectionDateGoalItem = SectionGoalItem;

export interface DateProgressInfo {
	targetDate?: string;
	startDate?: string;
	cycle?: string;
	remainingDays?: number;
	remainingHours?: number;
	percentage?: number;
	isOverdue: boolean;
	currentCycleStart?: string;
	currentCycleTarget?: string;
	isFallback?: boolean;
}


export interface SectionNode {
	heading: string;
	level: number;
	line: number;
	startOffset: number;
	endOffset: number;
	charCount: number;
	count?: number;
	goalCount?: number;
	isDefaultGoal?: boolean;
	children: SectionNode[];
}

export interface SectionProgressItem {
	level: number;
	heading: string;
	current: number;
	goal?: number;
	percentage?: number;
	index?: number;
}


export interface WritingProgress {
	currentSection: SectionProgressItem | null;
	sectionLevels?: SectionProgressItem[];
	cumulative: {
		current: number;
		goal?: number;
		percentage?: number;
	};
	total: {
		current: number;
		goal?: number;
		percentage?: number;
	};
	date?: DateProgressInfo | null;
}

export type BadgePositionPreset = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type CumulativeCountMode = 'from-top' | 'from-section';

export interface FolderGoalConfig {
	id: string;
	folderPath: string;
	fileGoal?: number;
	defaultSectionGoal?: number;
	headingLevelGoals?: Record<number, number>;
	styleId?: number;
	defaultDateReference?: DateReferenceMode;
	defaultCycle?: string;
	defaultStartTime?: string;
	defaultTargetTime?: string;
}

export interface PluginSettings {
	// Date Progress options
	showDateProgress: boolean;
	showDateWhenUnset: boolean;
	showDateProgressBar: boolean;
	showDateIcon: boolean;
	dateLabel: string;
	dateOverdueLabel: string;
	dateUnitDays: string;
	dateUnitHours: string;
	dateThresholdWarn: number;
	dateThresholdUrgent: number;
	dateThresholdOverdue: number;
	dateColorNormal: string;
	dateColorWarn: string;
	dateColorUrgent: string;
	dateColorOverdue: string;
	showDateHoursAlways: boolean;
	defaultStartTime: string;
	defaultTargetTime: string;
	defaultDateReference: DateReferenceMode;
	defaultDateCycle: string;
	datePositionMode: DateBadgePositionMode;
	dateBadgePosition: BadgePositionPreset;
	dateOffsetX: number;
	dateOffsetY: number;
	dateFontSize: number;
	dateBadgeOpacity: number;

	// Section Progress options
	showSectionProgress: boolean;
	showSectionCurrent: boolean;
	showSectionPercentage: boolean;
	showSectionGoal: boolean;
	showSectionProgressBar: boolean;
	showSectionOverflowBar: boolean;
	showSectionIcon: boolean;
	sectionLabel: string;
	showHeadingLevel1: boolean;
	showHeadingLevel2: boolean;
	showHeadingLevel3: boolean;
	showHeadingLevel4: boolean;
	showHeadingLevel5: boolean;
	showHeadingLevel6: boolean;

	// Cumulative Progress options
	showCumulativeProgress: boolean;
	showCumulativeCurrent: boolean;
	showCumulativePercentage: boolean;
	showCumulativeGoal: boolean;
	showCumulativeProgressBar: boolean;
	showCumulativeOverflowBar: boolean;
	showCumulativeIcon: boolean;
	cumulativeLabel: string;
	cumulativeMode: CumulativeCountMode;

	// Total Progress options
	showTotalProgress: boolean;
	showTotalCurrent: boolean;
	showTotalPercentage: boolean;
	showTotalGoal: boolean;
	showTotalProgressBar: boolean;
	showTotalOverflowBar: boolean;
	showTotalIcon: boolean;
	totalLabel: string;

	// Badge position and appearance
	badgePosition: BadgePositionPreset;
	offsetX: number;
	offsetY: number;
	badgeOpacity: number;
	fontSize: number;

	// Color Thresholds & Styles
	colorThresholdWarn: number; // e.g. 50%
	colorThresholdGood: number; // e.g. 80%
	colorThresholdDone: number; // e.g. 100%
	styles: GoalColorStyle[];
	defaultStyleId: number;

	// Folder Goals
	folderGoals: FolderGoalConfig[];

	// Counter options
	countType: CountType;
	excludeWhitespace: boolean;
	excludeRuby: boolean;
	excludeCharacters: string;

	// Interaction
	longPressToOpenModal: boolean;
}
