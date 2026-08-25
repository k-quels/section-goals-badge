export interface HeadingGoalItem {
	[heading: string]: number;
}

export interface GoalFrontmatter {
	'goal-file'?: number;
	'goal-section'?: number;
	goals?: Array<HeadingGoalItem | { heading: string; goal: number }>;
}

export interface SectionNode {
	heading: string;
	level: number;
	line: number;
	startOffset: number;
	endOffset: number;
	charCount: number;
	goalCount?: number;
	isDefaultGoal?: boolean;
	children: SectionNode[];
}

export interface WritingProgress {
	currentSection: {
		heading: string;
		current: number;
		goal?: number;
		percentage?: number;
	} | null;
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
}

export type BadgePositionPreset = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type CumulativeCountMode = 'from-top' | 'from-section';

export interface PluginSettings {
	// Section Progress options
	showSectionProgress: boolean;
	showSectionCurrent: boolean;
	showSectionPercentage: boolean;
	showSectionGoal: boolean;
	showSectionIcon: boolean;
	sectionLabel: string;

	// Cumulative Progress options
	showCumulativeProgress: boolean;
	showCumulativeCurrent: boolean;
	showCumulativePercentage: boolean;
	showCumulativeGoal: boolean;
	showCumulativeIcon: boolean;
	cumulativeLabel: string;
	cumulativeMode: CumulativeCountMode;

	// Total Progress options
	showTotalProgress: boolean;
	showTotalCurrent: boolean;
	showTotalPercentage: boolean;
	showTotalGoal: boolean;
	showTotalIcon: boolean;
	totalLabel: string;

	// Badge position and appearance
	badgePosition: BadgePositionPreset;
	offsetX: number;
	offsetY: number;
	badgeOpacity: number;
	fontSize: number;

	// Thresholds for dynamic coloring (in percentage)
	colorThresholdWarn: number; // e.g. 50%
	colorThresholdGood: number; // e.g. 80%
	colorThresholdDone: number; // e.g. 100%

	// Counter options
	excludeWhitespace: boolean;
	excludeRuby: boolean;
	excludeCharacters: string;

	// Interaction
	longPressToOpenModal: boolean;
}
