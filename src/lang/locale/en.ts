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

	SETTINGS_CUMULATIVE_PROGRESS_BAR: 'Show as progress bar',
	SETTINGS_CUMULATIVE_PROGRESS_BAR_DESC: 'Display the badge background as a progress bar gauge based on completion rate.',

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

	SETTINGS_SECTION_PROGRESS_BAR: 'Show as progress bar',
	SETTINGS_SECTION_PROGRESS_BAR_DESC: 'Display the badge background as a progress bar gauge based on completion rate.',

	SETTINGS_SECTION_ICON: 'Show section icon',
	SETTINGS_SECTION_ICON_DESC: 'Display an icon at the beginning of the badge.',

	SETTINGS_SECTION_LABEL: 'Label',
	SETTINGS_SECTION_LABEL_DESC: 'Display a custom prefix string on the badge (e.g. Sec:).',

	SETTINGS_HEADING_LEVELS_ACCORDION: 'Heading level progress (H1–H6)',
	SETTINGS_HEADING_LEVELS_ACCORDION_DESC: 'Display progress for specific heading levels vertically on the badge.',

	SETTINGS_HEADING_LEVEL_1: 'Show H1 progress',
	SETTINGS_HEADING_LEVEL_1_DESC: 'Display progress for the active H1 heading.',
	SETTINGS_HEADING_LEVEL_2: 'Show H2 progress',
	SETTINGS_HEADING_LEVEL_2_DESC: 'Display progress for the active H2 heading.',
	SETTINGS_HEADING_LEVEL_3: 'Show H3 progress',
	SETTINGS_HEADING_LEVEL_3_DESC: 'Display progress for the active H3 heading.',
	SETTINGS_HEADING_LEVEL_4: 'Show H4 progress',
	SETTINGS_HEADING_LEVEL_4_DESC: 'Display progress for the active H4 heading.',
	SETTINGS_HEADING_LEVEL_5: 'Show H5 progress',
	SETTINGS_HEADING_LEVEL_5_DESC: 'Display progress for the active H5 heading.',
	SETTINGS_HEADING_LEVEL_6: 'Show H6 progress',
	SETTINGS_HEADING_LEVEL_6_DESC: 'Display progress for the active H6 heading.',

	// Settings - Total
	SETTINGS_TOTAL_SHOW: 'Show note total progress',
	SETTINGS_TOTAL_SHOW_DESC: 'Display the progress badge for the entire note.',

	SETTINGS_TOTAL_CURRENT: 'Show current count',
	SETTINGS_TOTAL_CURRENT_DESC: 'Display character count for the entire note.',

	SETTINGS_TOTAL_PERCENT: 'Show percentage (%)',
	SETTINGS_TOTAL_PERCENT_DESC: 'Display total note progress against the goal as a percentage.',

	SETTINGS_TOTAL_GOAL: 'Show target goal',
	SETTINGS_TOTAL_GOAL_DESC: 'Display "/ target goal".',

	SETTINGS_TOTAL_PROGRESS_BAR: 'Show as progress bar',
	SETTINGS_TOTAL_PROGRESS_BAR_DESC: 'Display the badge background as a progress bar gauge based on completion rate.',

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
	SETTINGS_RESET_DEFAULT: 'Reset to default',

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
	MODAL_HEADING_LEVEL_GOALS_TOGGLE: 'Set default goals by heading level',
	MODAL_HEADING_LEVEL_GOALS_DESC: 'Configure fallback goals for H1–H6 if specific section goals are empty.',
	MODAL_SECTIONS_HEADER: 'Section list',
	MODAL_NO_HEADINGS: 'No headings found in note',
	MODAL_GOAL_PLACEHOLDER: 'Goal',
	MODAL_SET_BUTTON: 'Set current count as all goals',
	MODAL_SET_CONFIRM_MSG: 'Set the target values for all sections to the currently written counts.\nAre you sure?',
	MODAL_CONFIRM_OK: 'Set goals',
	MODAL_CONFIRM_CANCEL: 'Cancel',
	MODAL_SCROLL_TO_TOP: 'Scroll to top',

	// Settings - Color Styles
	SETTINGS_HEADING_STYLES: 'Color styles',
	SETTINGS_DEFAULT_STYLE: 'Default color style',
	SETTINGS_DEFAULT_STYLE_DESC: 'Color style to use when not specified in note frontmatter.',
	SETTINGS_STYLE_ADD: 'Add style',
	SETTINGS_STYLE_RESET_ALL: 'Reset all color styles',
	SETTINGS_STYLE_RESET_ALL_CONFIRM: 'Reset all color styles to their default settings.\nAre you sure?',
	SETTINGS_STYLE_RESET_ITEM: 'Reset to default',
	SETTINGS_STYLE_DELETE: 'Delete',
	SETTINGS_STYLE_NAME_LABEL: 'Style name',
	SETTINGS_STYLE_NAME_PLACEHOLDER: 'Enter style name',
	SETTINGS_COLOR_DEFAULT: 'Initial',
	SETTINGS_COLOR_WARN: 'Medium',
	SETTINGS_COLOR_GOOD: 'High',
	SETTINGS_COLOR_DONE: 'Completed',
	PRESET_STYLE_LIMIT: 'Limit goal',
	PRESET_STYLE_TARGET: 'Target goal',

	// Modal Columns
	MODAL_COL_CURRENT: 'Current',
	MODAL_COL_GOAL: 'Goal',
	MODAL_COL_PROGRESS: 'Progress',

	// Modal Color Style
	MODAL_COLOR_STYLE_LABEL: 'Color style',
	MODAL_COLOR_STYLE_DESC: 'Color style applied to badges and bars for this note.',
	MODAL_FOLDER_DEFAULTS_HINT: 'Folder defaults can be defined in {link}.',
	MODAL_FOLDER_DEFAULTS_HINT_LINK: 'Plugin settings',

	// Settings - Folder Goals
	SETTINGS_HEADING_FOLDER_GOALS: 'Folder defaults',
	SETTINGS_FOLDER_GOALS_DESC: 'Set default goals and color styles for notes under specific folders.\nNote frontmatter takes precedence.',
	SETTINGS_FOLDER_GOAL_ADD: 'Add folder',
	SETTINGS_FOLDER_GOAL_DELETE: 'Delete',
	SETTINGS_FOLDER_PATH_LABEL: 'Target folder',
	SETTINGS_FOLDER_PATH_PLACEHOLDER: 'Folder path',
	SETTINGS_FOLDER_TOTAL_GOAL: 'Note total goal',
	SETTINGS_FOLDER_SECTION_GOAL: 'Section goal',
	SETTINGS_FOLDER_UNSET_PLACEHOLDER: 'Unset (inherit from parent)',
	SETTINGS_FOLDER_HEADING_GOALS_ACCORDION: 'Goals by heading level (H1–H6)',
	SETTINGS_FOLDER_STYLE_LABEL: 'Color style',
	SETTINGS_FOLDER_STYLE_INHERIT: 'Default (inherit from parent)',
	SETTINGS_FOLDER_SELECT_PLACEHOLDER: 'No folder selected',
	SETTINGS_FOLDER_EMPTY_LIST: 'No folder settings',
	SETTINGS_FOLDER_DUPLICATE_NOTICE: 'A setting for this folder already exists!',
};



