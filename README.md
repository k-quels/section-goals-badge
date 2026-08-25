# Section Goals Badge

English | [日本語](README_ja.md)

[![Obsidian Downloads](https://img.shields.io/badge/Obsidian-Community%20Plugin-7C3AED?logo=obsidian&logoColor=white)](https://obsidian.md/plugins?id=section-goals-badge)
[![GitHub release](https://img.shields.io/github/v/release/k-quels/section-goals-badge?include_prereleases&color=blue)](https://github.com/k-quels/section-goals-badge/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A floating character counter and writing goal tracker per heading for Obsidian, designed for novel writers and long-form document creators.

Display floating badges on your editor to keep track of character counts and progress rates for the active heading (section) or entire note in real time.

▼ Desktop

<img src="./doc/images/badges.png" width="450">

▼ Mobile

<img src="./doc/images/badges-mobile.jpg" width="300">

---

## Key Features

- **Goal Tracking per Section (Heading)**: Set target counts for each chapter or section.
- **Unobtrusive Floating Badge**: Position at any corner of the editor, with drag-and-drop movement and opacity adjustments.
- **3 Configurable Progress Badges**:
  - **Progress to Cursor**: Counts characters from note top (or section top) up to cursor position.
  - **Active Section Progress**: Counts characters within the current heading block.
  - **Note Total Progress**: Counts characters for the entire note.
- **Dynamic Badge Colors**: Visual status updates as you write.
- **Mobile-Friendly**: Works smoothly on smartphones even with massive documents.
- **Character & Word Counting**: Switch between Character count and Word count freely.
- **Exclusion Rules**: Exclude whitespace, Japanese novel ruby notation, and custom user-specified symbols.
- **Fast & Battery Efficient (1M+ characters)**: Optimized to minimize typing latency and reduce mobile battery drain.
- **Self-Contained in Note**: Goal values are saved directly into the note's Frontmatter.

---

## Usage

### 1. Open Goal Management Window
- Tap or click the badge on the editor to open the goal management window.
  - *(Can be changed to "Long press to open" in settings to avoid accidental taps)*

<img src="./doc/images/goal-modal-ja.png" width="450">

### 2. Set Target Counts
Enter target counts directly in the modal (automatically saved to Frontmatter):
- **Note Total Goal**: Target count for the entire note.
- **Section Goal (Default)**: Default target applied to headings without individual goals.
- **Individual Section Goals**: Set specific targets per heading row in the list.
- **"Set current count as all goals" Button**: Batch-assigns written character counts as goals for all sections.

### 3. Adjust Badge Position & Appearance
- **Drag and drop** the badge to place it anywhere on your editor.
  - You can also specify exact offsets in the settings tab (synced with drag-and-drop values).

---

## Settings

The following features and options can be customized:

### 1. Badge Display Customization (Cursor / Section / Total)

- **Toggle Visibility**: Enable or disable the 3 progress badges independently.
  - e.g., Hide note total badge:
    - <img src="doc/images/badge-hide-all.png" width="200">
- **Display Content**: Toggle current count, target goal, and progress percentage.
  - e.g., Show only count for cursor position, full details for section:
    - <img src="doc/images/badge-hide-all.png" width="200">
- **Icon / Label**: Toggle prefix icons and text labels.
  - e.g., Hide both for cursor, icon only for section, full for total:
    - <img src="doc/images/badge-icon-label.png" width="250">

### 2. Counting Rules

- **Counting Method**: Switch between Character count and Word count.
- **Exclusion Settings**: Exclude whitespace, Japanese novel ruby notation, and custom specified characters.

### 3. Appearance & Position

- Configure badge position preset, opacity, and font size.

### 4. Customizing Progress Colors

- Customize percentage thresholds (default: 50% / 80% / 100%) that trigger dynamic badge and progress bar color changes.
- Colors can be configured visually with the **[Style Settings](https://github.com/mgmeyers/obsidian-style-settings)** plugin or via **CSS Snippets**.

#### CSS Snippet Color Customization

Add a custom CSS file to your vault (**Settings → Appearance → CSS snippets**):

```css
/* Section Goals Badge - Custom Colors */
body {
    /* Progress threshold colors */
    --sgb-color-default: #8c8c8c; /* Initial progress (< 50%) */
    --sgb-color-warn: #e2b93b;    /* Mid progress (>= 50%) */
    --sgb-color-good: #ff7843;    /* High progress (>= 80%) */
    --sgb-color-done: #ff4d4f;    /* Goal reached (>= 100%) */
}
```

#### Color Preset Samples

##### ① Limit Goal Style: When staying within a strict word/char limit

<img src="./doc/images/colorsample-style1.png" width="150">

```css
body {
    --sgb-color-default: #8c8c8c; /* Safe (< 50%): Gray */
    --sgb-color-warn: #e2b93b;    /* Halfway (>= 50%): Yellow */
    --sgb-color-good: #ff7843;    /* Approaching cap (>= 80%): Orange */
    --sgb-color-done: #ff4d4f;    /* Reached limit (>= 100%): Red */
}
```

##### ② Minimum Target Style: When meeting minimum target goals

<img src="./doc/images/colorsample-style2.png" width="150">

```css
body {
    --sgb-color-default: #8c8c8c; /* Starting (< 50%): Gray */
    --sgb-color-warn: #f09533;    /* In Progress (>= 50%): Orange */
    --sgb-color-good: #24b750;    /* Almost there (>= 80%): Green */
    --sgb-color-done: #207dff;    /* Completed (>= 100%): Blue */
}
```

---

## Frontmatter Format

- Target goals are stored in the note's YAML Frontmatter in the following format.
- You can manage goals via the Goal Management modal or edit them directly.
- Setting goals is completely optional.

```yaml
---
goal-file: 10000    # Target count for the entire note
goal-section: 2000  # Default target count for sections
goals:
  - Chapter 1: 2500 # Target count for specific section
  - Chapter 2: 3000
---
```

- **Tips**: If you want to clear all goals at once, simply delete these lines from the Frontmatter.

---

## Support & Donation

If you enjoy Section Goals Badge, your support is greatly appreciated!

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-%E3%81%8A%E3%81%AB%E3%81%98%E3%82%8A%E3%81%84%E3%81%A3%E3%81%93%E3%81%8A%E3%81%94%E3%82%8B-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/quels)

---

## License

This software is released under the [MIT License](LICENSE).
