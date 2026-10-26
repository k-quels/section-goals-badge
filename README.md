# Section Goals Badge

English | [日本語](README_ja.md)

[![Obsidian Downloads](https://img.shields.io/badge/Obsidian-Community%20Plugin-7C3AED?logo=obsidian&logoColor=white)](https://obsidian.md/plugins?id=section-goals-badge)
[![GitHub release](https://img.shields.io/github/v/release/k-quels/section-goals-badge?include_prereleases&color=blue)](https://github.com/k-quels/section-goals-badge/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A floating character/word counter and target date tracker per heading for Obsidian, designed for novel writers and long-form document creators.

Display floating badges on your editor to keep track of word/character counts, progress rates, and target dates for the active heading (section) or entire note in real time.

▼ Desktop<br>
<img src="./doc/images/badges-en.png" width="450">

▼ Mobile (with date badge hidden)<br>
<img src="./doc/images/badges-mobile-en.jpg" width="300">

---

## Key Features

- 🎯 **Goal Tracking per Section (Heading)**: Set target counts per folder, per note, or for each chapter and section.

- 📅 **Target Dates & Deadline Tracking**: Set target dates, start dates, and recurring schedules per note or section.

- 📛 **Unobtrusive Floating Badge**: Position at any corner of the editor, with drag-and-drop movement and opacity adjustments.

- 🚥 **3 Configurable Progress Badges**:
  - **Progress to Cursor**: Counts characters from note top (or section top) up to cursor position.
  - **Active Section Progress**: Counts characters within the current heading block.
  - **Note Total Progress**: Counts characters for the entire note.

- 🎨 **Dynamic Badge Colors**: Define custom color styles and visually track progress rates at a glance.

- 📱 **Mobile-Friendly**: Works smoothly on smartphones even with massive documents.

- 🔢 **Character & Word Counting**: Switch between Character count and Word count freely.

- ✂️ **Exclusion Rules**: Exclude whitespace, Japanese novel ruby notation, and custom user-specified symbols.

- ⚡ **Fast & Battery Efficient (1M+ characters)**: Optimized to minimize typing latency and reduce mobile battery drain even in long-form writing.

---

## Usage

### 1. Open Goal Management Window

- Tap or click the badge on the editor to open the goal management window.<br>
  *Note: Tapping the date badge opens the modal directly in Target Dates mode.*
  - Tips: Change to "Long press to open" in settings to avoid accidental taps.
  - Tips: Click a section name to close the modal and jump directly to that heading.

### 2. Set Target Counts & Dates

Enter target goals for each item (automatically saved to Frontmatter).<br>
*Note: To configure goals per folder, add folder definitions in the plugin settings.*

- Word / Character Count Goals<br>
  <img src="./doc/images/goal-modal-en.png" width="450">
  - **Note Total Goal**: Target count for the entire note being edited.
  - **Section Goal**: Default target count applied to headings without individual goals.
  - **Heading Level Goals**: Set default target counts for each heading level (H1–H6).
  - **Individual Section Goals**: Enter specific target counts for each row in the heading list.
- Target Date Goals<br>
  <img src="./doc/images/goal-modal-date-en.png" width="450">
  - **Note Total Goal**: Target date and time for the entire note.
  - **Default Section Goals**
    - **Reference**: Inherit recurring schedules or deadlines from note total or parent sections.
    - **Recurring Schedule**: Automatically calculate deadlines by adding duration (days, weeks, months, etc.) to the preceding section.
  - **Individual Section Goals**: Set individual target dates/times or custom recurring schedules for each heading.

### 3. Adjust Badge Position & Appearance

- **Drag and drop** the badge to place it anywhere on your editor.
  - You can also specify exact values in the settings tab (synced with drag-and-drop values).

---

## Settings

The following features and options can be customized:

### 1. Badge Display Customization (Cursor / Section / Total / Target Date)

- **Toggle Visibility**: Enable or disable the 3 progress badges independently.
  - ▼ e.g., Hide note total badge:<br>
  <img src="doc/images/badge-hide-all.png" width="200">
- **Heading Level Progress (H1–H6)**: Display progress for specific heading levels (H1–H6) in the section progress badge.
  - ▼ e.g., When H1 and H2 are enabled, you can monitor H1 progress while editing H2:<br>
  <img src="doc/images/badge-headings.png" width="250">
- **Display Content**: Toggle current count, target goal, and progress percentage.
  - ▼ e.g., Show only count for cursor position, full details for section:<br>
  <img src="doc/images/badge-hide-all.png" width="200">
- **Icon / Label**: Toggle prefix icons and text labels.
  - ▼ e.g., Hide both for cursor, icon only for section, full for total:<br>
  <img src="doc/images/badge-icon-label.png" width="250">

- **Display as Progress Bar**: Display the progress percentage using the badge background color as a gauge.
  - ▼ e.g., Using cursor position and section badges as progress bars:<br>
  <img src="doc/images/badge-color-gauge.png" width="250">

- **Independent Date Badge**: The target date badge can be separated into an independent badge.
  - ▼ e.g., Setting position to "Independent", customizing its position, font size, and opacity separately:<br>
  <img src="doc/images/badge-date-separate-en.png" width="400">

### 2. Counting Rules

- **Counting Method**: Switch between Character count and Word count.
- **Exclusion Settings**: Exclude whitespace, Japanese novel ruby notation, and custom specified characters.

### 3. Appearance & Position

- Configure badge position preset, opacity, and font size.

### 4. Color Styles

- In the plugin settings under **Color styles**, freely define and customize color schemes (up to 20 styles).
  - Two color modes available: **Threshold** (step-based) and **Gradient** (smooth transitions).<br>
    <img src="./doc/images/color-styles.png" width="400">
  - Progress thresholds for threshold-type styles (default: 50% / 80% / 100%) can be customized in settings.
  
- Default Presets:
  - **① Limit Goal Style**: Best for strict word/character caps (Gray → Yellow → Orange → Red)<br>
  　<img src="./doc/images/colorsample-style1.png" width="80">
  
  - **② Target Achievement Style**: Best for aiming to reach a target count (Gray → Orange → Green → Blue)<br>
  　<img src="./doc/images/colorsample-style2.png" width="80">

- In the Goal Management modal, **select your preferred style per note** from the "Color style" dropdown.

### 5. Date Goals & Deadlines

- Configure date badge visibility, default start/target times, recurring schedules, and other date defaults.

### 6. Folder-Level Defaults

- Set default target goals, color styles, and date-related defaults for notes under specified folders.
  - *Note: Settings specified within individual notes take precedence.*

---

## Frontmatter Format

- Target goals and color style choices are stored in the note's YAML Frontmatter in the following format.
- You can manage goals via the Goal Management modal or edit them directly.
- Setting goals is completely optional.

```yaml
---
goal-file: 10000       # <- Target count for the entire note
goal-section: 2000     # <- Default target count for sections
goal-section-h1: 3000  # <- Default target count for H1 (H1–H6 supported)
goal-style: 2          # <- Color style ID (omitted for default style)
goal-target-date: 2026-10-31  # <- Target date for the note (optional)
goal-start-date: 2026-10-01   # <- Start date for the note (optional)
goal-cycle: 1w                # <- Recurring cycle (1d, 1w, 1m, etc., optional)
goals:
  - Chapter 1: 2500    # <- Target count for specific section (simple format)
  - heading: Chapter 2 # <- Unified section settings (word count, date, cycle)
    goal: 3000
    target-date: 2026-10-31
    start-date: 2026-10-15
    cycle: 1w
  - heading: Notes     # <- Use index (1-based) to identify duplicate headings
    index: 1
    goal: 500
    target-date: 2026-10-20
---
```

- **Tips**: If you want to clear all goals or target dates at once, simply delete these lines from the Frontmatter.

---

## Support & Donation

If you enjoy Section Goals Badge, your support is greatly appreciated!

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Donate-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/quels)

---

## License

This software is released under the [MIT License](LICENSE).
