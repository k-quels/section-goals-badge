import en from './en';

const ja: typeof en = {
	// Commands
	COMMAND_OPEN_MODAL: '目標管理ウインドウを開く',

	// Settings - Headings
	SETTINGS_HEADING_CUMULATIVE: 'カーソル位置までの進捗',
	SETTINGS_HEADING_SECTION: 'セクション進捗',
	SETTINGS_HEADING_TOTAL: 'ノート全体進捗',
	SETTINGS_HEADING_RULES: 'カウントルール',
	SETTINGS_HEADING_APPEARANCE: '外観と配置',
	SETTINGS_HEADING_THRESHOLDS: '進捗カラーの閾値',
	SETTINGS_HEADING_SUPPORT: 'サポート',

	// Settings - Support
	SETTINGS_DONATE: '寄付',
	SETTINGS_DONATE_DESC: 'このプラグインを気に入ったら、開発支援のための寄付を考えて頂けますと幸いです。',
	SETTINGS_DONATE_BUTTON: 'おにぎりいっこおごる',

	// Settings - Cumulative
	SETTINGS_CUMULATIVE_SHOW: 'カーソル位置までの進捗を表示',
	SETTINGS_CUMULATIVE_SHOW_DESC: 'カウントの開始位置からカーソル位置までの進捗バッジを表示します。',

	SETTINGS_CUMULATIVE_MODE: 'カウントの開始位置',
	SETTINGS_CUMULATIVE_MODE_DESC: 'どこからカウントするかを選択します。',
	CUMULATIVE_MODE_TOP: 'ノートの先頭から',
	CUMULATIVE_MODE_SECTION: '現在のセクションの先頭から',

	SETTINGS_CUMULATIVE_CURRENT: '現在の文字数を表示',
	SETTINGS_CUMULATIVE_CURRENT_DESC: 'カーソル位置までのカウントを表示します。',

	SETTINGS_CUMULATIVE_PERCENT: '進捗率（%）を表示',
	SETTINGS_CUMULATIVE_PERCENT_DESC: '目標値に対する現在の進捗をパーセント表記します。',

	SETTINGS_CUMULATIVE_GOAL: '目標値を表示',
	SETTINGS_CUMULATIVE_GOAL_DESC: '「/ 目標値」を表示します。',

	SETTINGS_CUMULATIVE_ICON: 'カーソルアイコンを表示',
	SETTINGS_CUMULATIVE_ICON_DESC: 'バッジの先頭にアイコンを表示します。',

	SETTINGS_CUMULATIVE_LABEL: 'ラベル',
	SETTINGS_CUMULATIVE_LABEL_DESC: 'バッジの先頭に指定文字列を表示します。（例: Cur:）',

	// Settings - Section
	SETTINGS_SECTION_SHOW: '現在のセクション進捗を表示',
	SETTINGS_SECTION_SHOW_DESC: 'カーソルがあるセクションの進捗バッジを表示します。',

	SETTINGS_SECTION_CURRENT: '現在の文字数を表示',
	SETTINGS_SECTION_CURRENT_DESC: 'カーソルがあるセクションのカウントを表示します。',

	SETTINGS_SECTION_PERCENT: '進捗率（%）を表示',
	SETTINGS_SECTION_PERCENT_DESC: '目標値に対する現在の進捗をパーセント表記します。',

	SETTINGS_SECTION_GOAL: '目標値を表示',
	SETTINGS_SECTION_GOAL_DESC: '「/ 目標値」を表示します。',

	SETTINGS_SECTION_ICON: 'セクションアイコンを表示',
	SETTINGS_SECTION_ICON_DESC: 'バッジの先頭にアイコンを表示します。',

	SETTINGS_SECTION_LABEL: 'ラベル',
	SETTINGS_SECTION_LABEL_DESC: 'バッジの先頭に指定文字列を表示します。（例: Sec:）',

	SETTINGS_HEADING_LEVELS_ACCORDION: '見出しレベルごとの進捗表示（H1〜H6）',
	SETTINGS_HEADING_LEVELS_ACCORDION_DESC: '指定した見出しレベルの進捗をバッジ内に縦並びで表示します。',

	SETTINGS_HEADING_LEVEL_1: 'H1 の進捗を表示',
	SETTINGS_HEADING_LEVEL_1_DESC: 'アクティブな H1 見出しの進捗を表示します。',
	SETTINGS_HEADING_LEVEL_2: 'H2 の進捗を表示',
	SETTINGS_HEADING_LEVEL_2_DESC: 'アクティブな H2 見出しの進捗を表示します。',
	SETTINGS_HEADING_LEVEL_3: 'H3 の進捗を表示',
	SETTINGS_HEADING_LEVEL_3_DESC: 'アクティブな H3 見出しの進捗を表示します。',
	SETTINGS_HEADING_LEVEL_4: 'H4 の進捗を表示',
	SETTINGS_HEADING_LEVEL_4_DESC: 'アクティブな H4 見出しの進捗を表示します。',
	SETTINGS_HEADING_LEVEL_5: 'H5 の進捗を表示',
	SETTINGS_HEADING_LEVEL_5_DESC: 'アクティブな H5 見出しの進捗を表示します。',
	SETTINGS_HEADING_LEVEL_6: 'H6 の進捗を表示',
	SETTINGS_HEADING_LEVEL_6_DESC: 'アクティブな H6 見出しの進捗を表示します。',

	// Settings - Total
	SETTINGS_TOTAL_SHOW: 'ノート全体の進捗を表示',
	SETTINGS_TOTAL_SHOW_DESC: 'ノート全体の進捗バッジを表示します。',

	SETTINGS_TOTAL_CURRENT: '現在の文字数を表示',
	SETTINGS_TOTAL_CURRENT_DESC: 'ノート全体のカウントを表示します。',

	SETTINGS_TOTAL_PERCENT: '進捗率（%）を表示',
	SETTINGS_TOTAL_PERCENT_DESC: '目標値に対する現在の進捗をパーセント表記します。',

	SETTINGS_TOTAL_GOAL: '目標値を表示',
	SETTINGS_TOTAL_GOAL_DESC: '「/ 目標値」を表示します。',

	SETTINGS_TOTAL_ICON: 'アイコンを表示',
	SETTINGS_TOTAL_ICON_DESC: 'バッジの先頭にアイコンを表示します。',

	SETTINGS_TOTAL_LABEL: 'ラベル',
	SETTINGS_TOTAL_LABEL_DESC: 'バッジの先頭に指定文字列を表示します。（例: All:）',

	// Settings - Rules & Appearance
	SETTINGS_COUNT_TYPE: 'カウント方式',
	SETTINGS_COUNT_TYPE_DESC: '文字数または単語数のどちらでカウントするかを選択します。',
	COUNT_TYPE_CHARACTER: '文字数',
	COUNT_TYPE_WORD: '単語数',
	SETTINGS_EXCLUDE_WHITESPACE: '空白文字を除外する',
	SETTINGS_EXCLUDE_WHITESPACE_DESC: '半角スペース、全角スペース、タブ文字をカウント対象外にします。',
	SETTINGS_EXCLUDE_RUBY: '日本語小説用ルビを除外する',
	SETTINGS_EXCLUDE_RUBY_DESC: '一般的な日本語小説のルビ記法（《...》および「|」「｜」）をカウント対象外にします。',
	SETTINGS_EXCLUDE_CHARACTERS: '特定の文字を除外する',
	SETTINGS_EXCLUDE_CHARACTERS_DESC: 'カウント対象外にしたい文字を入力します（例: 「」）。',
	SETTINGS_BADGE_POS: 'バッジの配置',
	SETTINGS_BADGE_POS_DESC: 'バッジの位置オフセットをどこから計算するか指定します。',
	SETTINGS_OFFSET_X: '横方向オフセット (px)',
	SETTINGS_OFFSET_X_DESC: 'バッジの配置位置からの水平方向の余白です。',
	SETTINGS_OFFSET_Y: '縦方向オフセット (px)',
	SETTINGS_OFFSET_Y_DESC: 'バッジの配置位置からの垂直方向の余白です。',
	SETTINGS_OPACITY: '不透明度',
	SETTINGS_OPACITY_DESC: 'バッジの背景透過レベルを指定します。',
	SETTINGS_FONT_SIZE: 'フォントサイズ (px)',
	SETTINGS_FONT_SIZE_DESC: 'バッジの文字サイズを指定します。（9 〜 20 px）',
	SETTINGS_RESET_DEFAULT: 'デフォルトに戻す',

	SETTINGS_THRESH_WARN: '中間カラーの閾値 (%)',
	SETTINGS_THRESH_WARN_DESC: '進捗カラーを中間色に切り替える進捗率です（例: 50%）。',
	SETTINGS_THRESH_GOOD: '高進捗カラーの閾値 (%)',
	SETTINGS_THRESH_GOOD_DESC: '進捗カラーを高進捗色に切り替える進捗率です（例: 80%）。',
	SETTINGS_THRESH_DONE: '達成カラーの閾値 (%)',
	SETTINGS_THRESH_DONE_DESC: '進捗カラーを達成色に切り替える進捗率です（例: 100%）。',

	SETTINGS_LONG_PRESS: '長押しで目標管理ウインドウを開く',
	SETTINGS_LONG_PRESS_DESC: '誤操作防止のため長押しでウインドウを開くようにします。',

	// Positions
	POS_BOTTOM_RIGHT: '右下',
	POS_BOTTOM_LEFT: '左下',
	POS_TOP_RIGHT: '右上',
	POS_TOP_LEFT: '左上',

	// Badge Tooltips
	BADGE_TOOLTIP_CUMULATIVE: 'カーソル位置',
	BADGE_TOOLTIP_SECTION: 'セクション: {heading}',
	BADGE_TOOLTIP_TOTAL: 'ノート全体',

	// Modal
	MODAL_TITLE: '執筆目標（文字数）',
	MODAL_TITLE_WORDS: '執筆目標（単語数）',
	MODAL_TOTAL_GOAL_NAME: 'ノート全体目標',
	MODAL_DEFAULT_SECTION_GOAL_NAME: 'セクション目標',
	MODAL_DEFAULT_SECTION_DESC: '個別目標が未設定の項目に適用',
	MODAL_HEADING_LEVEL_GOALS_TOGGLE: '見出しレベルごとの目標値を設定',
	MODAL_HEADING_LEVEL_GOALS_DESC: '個別目標が未設定の見出しに対して、レベル（H1〜H6）別のデフォルト目標を設定します。',
	MODAL_SECTIONS_HEADER: 'セクション一覧',
	MODAL_NO_HEADINGS: 'ノート内に見出しがありません',
	MODAL_GOAL_PLACEHOLDER: '目標',
	MODAL_SET_BUTTON: '現在値を全目標に設定',
	MODAL_SET_CONFIRM_MSG: '全セクションの目標値を現在執筆済みの数値に設定します。\nよろしいですか？',
	MODAL_CONFIRM_OK: '設定する',
	MODAL_CONFIRM_CANCEL: 'キャンセル',

	// Modal Columns
	MODAL_COL_CURRENT: '現在値',
	MODAL_COL_GOAL: '目標値',
	MODAL_COL_PROGRESS: '進捗率',
};

export default ja;
