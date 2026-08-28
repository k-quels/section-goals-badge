export type CountType = 'character' | 'word';

export interface HeadingGoalItem {
	[heading: string]: number;
}

export interface GoalColorStyle {
	id: number;
	name: string;
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
	goals?: Array<HeadingGoalItem | { heading: string; goal: number }>;
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
}

export interface PluginSettings {
	// Section Progress options
	showSectionProgress: boolean;
	showSectionCurrent: boolean;
	showSectionPercentage: boolean;
	showSectionGoal: boolean;
	showSectionProgressBar: boolean;
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
	showCumulativeIcon: boolean;
	cumulativeLabel: string;
	cumulativeMode: CumulativeCountMode;

	// Total Progress options
	showTotalProgress: boolean;
	showTotalCurrent: boolean;
	showTotalPercentage: boolean;
	showTotalGoal: boolean;
	showTotalProgressBar: boolean;
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
