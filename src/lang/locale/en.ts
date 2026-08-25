export default {
	// Commands
	COMMAND_OPEN_MODAL: 'Open goal management window',

	// Settings - Headings
	SETTINGS_HEADING_CUMULATIVE: 'Progress to cursor',
	SETTINGS_HEADING_SECTION: 'Section progress',
	SETTINGS_HEADING_TOTAL: 'Note total progress',
	SETTINGS_HEADING_RULES: 'Counting rules',
	SETTINGS_HEADING_APPEARANCE: 'Appearance and position',
	SETTINGS_HEADING_THRESHOLDS: 'Progress color thresholds',
	SETTINGS_HEADING_INTERACTIONS: 'Interactions',
	SETTINGS_HEADING_SUPPORT: 'Support',

	// Settings - Support
	SETTINGS_DONATE: 'Donate',
	SETTINGS_DONATE_DESC: 'If you like this plugin, please consider donating to support its continuous development.',
	SETTINGS_DONATE_BUTTON: 'Buy me an onigiri',

	// Settings - Cumulative
	SETTINGS_CUMULATIVE_SHOW: 'Show progress to cursor',
	SETTINGS_CUMULATIVE_SHOW_DESC: 'Display the progress badge from the count start position up to the cursor position.',

	SETTINGS_CUMULATIVE_MODE: 'Count starting point',
	SETTINGS_CUMULATIVE_MODE_DESC: 'Choose where to start counting from.',
	CUMULATIVE_MODE_TOP: 'From the top of the note',
	CUMULATIVE_MODE_SECTION: 'From the top of the active section',

	SETTINGS_CUMULATIVE_CURRENT: 'Show current count',
	SETTINGS_CUMULATIVE_CURRENT_DESC: 'Display character count up to the cursor position.',

	SETTINGS_CUMULATIVE_PERCENT: 'Show percentage (%)',
	SETTINGS_CUMULATIVE_PERCENT_DESC: 'Display current progress against the goal as a percentage.',

	SETTINGS_CUMULATIVE_GOAL: 'Show target goal',
	SETTINGS_CUMULATIVE_GOAL_DESC: 'Display "/ target goal".',

	SETTINGS_CUMULATIVE_ICON: 'Show cursor icon',
	SETTINGS_CUMULATIVE_ICON_DESC: 'Display an icon at the beginning of the badge.',

	SETTINGS_CUMULATIVE_LABEL: 'Label',
	SETTINGS_CUMULATIVE_LABEL_DESC: 'Display a custom prefix string on the badge (e.g. Cur:).',

	// Settings - Section
	SETTINGS_SECTION_SHOW: 'Show active section progress',
	SETTINGS_SECTION_SHOW_DESC: 'Display the progress badge for the section containing the cursor.',

	SETTINGS_SECTION_CURRENT: 'Show current count',
	SETTINGS_SECTION_CURRENT_DESC: 'Display character count for the active section.',

	SETTINGS_SECTION_PERCENT: 'Show percentage (%)',
	SETTINGS_SECTION_PERCENT_DESC: 'Display active section progress against the goal as a percentage.',

	SETTINGS_SECTION_GOAL: 'Show target goal',
	SETTINGS_SECTION_GOAL_DESC: 'Display "/ target goal".',

	SETTINGS_SECTION_ICON: 'Show section icon',
	SETTINGS_SECTION_ICON_DESC: 'Display an icon at the beginning of the badge.',

	SETTINGS_SECTION_LABEL: 'Label',
	SETTINGS_SECTION_LABEL_DESC: 'Display a custom prefix string on the badge (e.g. Sec:).',

	// Settings - Total
	SETTINGS_TOTAL_SHOW: 'Show note total progress',
	SETTINGS_TOTAL_SHOW_DESC: 'Display the progress badge for the entire note.',

	SETTINGS_TOTAL_CURRENT: 'Show current count',
	SETTINGS_TOTAL_CURRENT_DESC: 'Display character count for the entire note.',

	SETTINGS_TOTAL_PERCENT: 'Show percentage (%)',
	SETTINGS_TOTAL_PERCENT_DESC: 'Display total note progress against the goal as a percentage.',

	SETTINGS_TOTAL_GOAL: 'Show target goal',
	SETTINGS_TOTAL_GOAL_DESC: 'Display "/ target goal".',

	SETTINGS_TOTAL_ICON: 'Show icon',
	SETTINGS_TOTAL_ICON_DESC: 'Display an icon at the beginning of the badge.',

	SETTINGS_TOTAL_LABEL: 'Label',
	SETTINGS_TOTAL_LABEL_DESC: 'Display a custom prefix string on the badge (e.g. All:).',

	// Settings - Rules & Appearance
	SETTINGS_COUNT_TYPE: 'Counting method',
	SETTINGS_COUNT_TYPE_DESC: 'Choose whether to count characters or words.',
	COUNT_TYPE_CHARACTER: 'Characters',
	COUNT_TYPE_WORD: 'Words',
	SETTINGS_EXCLUDE_WHITESPACE: 'Exclude whitespace',
	SETTINGS_EXCLUDE_WHITESPACE_DESC: 'Exclude half-width spaces, full-width spaces, and tabs from the character count.',
	SETTINGS_EXCLUDE_RUBY: 'Exclude Japanese novel ruby',
	SETTINGS_EXCLUDE_RUBY_DESC: 'Exclude standard Japanese novel ruby notation (《...》, "|", and "｜") from the count.',
	SETTINGS_EXCLUDE_CHARACTERS: 'Exclude specific characters',
	SETTINGS_EXCLUDE_CHARACTERS_DESC: 'Enter characters to exclude from the count (e.g. 「」).',
	SETTINGS_BADGE_POS: 'Badge position',
	SETTINGS_BADGE_POS_DESC: 'Specify where the badge offset is calculated from.',
	SETTINGS_OFFSET_X: 'Horizontal offset (px)',
	SETTINGS_OFFSET_X_DESC: 'Horizontal spacing from the badge alignment corner.',
	SETTINGS_OFFSET_Y: 'Vertical offset (px)',
	SETTINGS_OFFSET_Y_DESC: 'Vertical spacing from the badge alignment corner.',
	SETTINGS_OPACITY: 'Opacity',
	SETTINGS_OPACITY_DESC: 'Specify the background opacity level of the badge.',
	SETTINGS_FONT_SIZE: 'Font size (px)',
	SETTINGS_FONT_SIZE_DESC: 'Specify the font size of the badge (9 - 20 px).',

	SETTINGS_THRESH_WARN: 'Medium color threshold (%)',
	SETTINGS_THRESH_WARN_DESC: 'Progress percentage to switch to the medium color (e.g. 50%).',
	SETTINGS_THRESH_GOOD: 'High color threshold (%)',
	SETTINGS_THRESH_GOOD_DESC: 'Progress percentage to switch to the high color (e.g. 80%).',
	SETTINGS_THRESH_DONE: 'Completion color threshold (%)',
	SETTINGS_THRESH_DONE_DESC: 'Progress percentage to switch to the completed color (e.g. 100%).',

	SETTINGS_LONG_PRESS: 'Long press to open goal management window',
	SETTINGS_LONG_PRESS_DESC: 'Open the window with a long press to prevent accidental opening.',

	// Positions
	POS_BOTTOM_RIGHT: 'Bottom right',
	POS_BOTTOM_LEFT: 'Bottom left',
	POS_TOP_RIGHT: 'Top right',
	POS_TOP_LEFT: 'Top left',

	// Badge Tooltips
	BADGE_TOOLTIP_CUMULATIVE: 'Cursor position',
	BADGE_TOOLTIP_SECTION: 'Section: {heading}',
	BADGE_TOOLTIP_TOTAL: 'Note total',

	// Modal
	MODAL_TITLE: 'Writing goals (character count)',
	MODAL_TITLE_WORDS: 'Writing goals (word count)',
	MODAL_TOTAL_GOAL_NAME: 'Note total goal',
	MODAL_DEFAULT_SECTION_GOAL_NAME: 'Section goal',
	MODAL_DEFAULT_SECTION_DESC: 'Used when individual section goals are not set.',
	MODAL_SECTIONS_HEADER: 'Section list',
	MODAL_NO_HEADINGS: 'No headings found in note',
	MODAL_GOAL_PLACEHOLDER: 'Goal',
	MODAL_SET_BUTTON: 'Set current count as all goals',
	MODAL_SET_CONFIRM_MSG: 'Set the target values for all sections to the currently written counts. Are you sure?',
	MODAL_CONFIRM_OK: 'Set goals',
	MODAL_CONFIRM_CANCEL: 'Cancel',

	// Modal Columns
	MODAL_COL_CURRENT: 'Current',
	MODAL_COL_GOAL: 'Goal',
	MODAL_COL_PROGRESS: 'Progress',
};
