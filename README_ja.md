# Section Goals Badge

[English](README.md) | 日本語


[![Obsidian Downloads](https://img.shields.io/badge/Obsidian-Community%20Plugin-7C3AED?logo=obsidian&logoColor=white)](https://obsidian.md/plugins?id=section-goals-badge)

[![GitHub release](https://img.shields.io/github/v/release/k-quels/section-goals-badge?include_prereleases&color=blue)](https://github.com/k-quels/section-goals-badge/releases)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Obsidian で小説や長編ドキュメントを執筆する人のための、**見出しごとの目標文字数管理＆進捗バッジ表示**プラグインです。

エディタ上にバッジを常時表示し、今書いているセクションやノート全体の文字数 / 進捗率をリアルタイムに把握できます。

▼ デスクトップ版<br>
<img src="./doc/images/badges.png" width="450">

▼ モバイル版<br>
<img src="./doc/images/badges-mobile.jpg" width="300">

---

 ## 主な特徴

- **セクション（見出し）ごとの目標管理**: 章や節ごとに目標数値を設定可能。

- **邪魔にならないフローティングバッジ**: エディタの四隅に配置でき、ドラッグ移動や不透明度調整にも対応。

-  **3つの進捗バッジを自由に組み合わせ可能**
  
     - **カーソル位置までの進捗**: ノート先頭（またはセクション先頭）からカーソル位置までをカウント。
  
     - **現在のセクション進捗**: カーソルがある見出しブロック内をカウント。

     - **ノート全体の進捗**: 1つのノート全体をカウント。

- **進捗率に応じたバッジのカラー設定**: 視覚的に進捗率を把握可能。

- **モバイル対応**: 巨大なドキュメントでもスマートフォンで快適に動作可能。

- **文字数 / 単語数のカウント切替**: 「文字数カウント」と「単語数カウント」を自由に切り替え可能。

- **カウント除外機能**: 空白文字や日本語小説用ルビ記号、その他ユーザー指定の記号を除外可能。

- **100万文字でも高速・省エネ設計**: 長編作品でもタイピングのラグやモバイルのバッテリー消費がなるべく減るよう配慮。

- **目標値は各ノートに保存**: 目標値はノート内のFrontmatterに保存し完結。


---

## 使い方

### 1. 目標管理ウインドウを開く

- エディタ上のバッジをタップ or クリックで、目標管理ウインドウが開きます。
    - ※誤操作を防ぎたい場合は、設定で「長押しで開く」に変更できます。


<img src="./doc/images/goal-modal-ja.png" width="450">
  
### 2. 目標文字数を設定する

モーダル上で各項目の目標数値を入力します（自動的にFrontmatterに保存されます）

- **ノート全体目標**: 編集中のノート全体の目標値。
- **セクション目標（デフォルト）**: 各見出し以下の目標値。個別の目標値が未設定の見出しに適用。
- **見出しレベルごとの目標値**: 見出しレベル（H1〜H6）別のデフォルト目標値を設定可能。
- **各セクションの目標**: 見出し一覧の各行に個別の目標値を入力可能。
- **「現在の文字数を全目標に設定」ボタン**: 執筆済み文字数を各セクションの目標値に一括設定可能。

### 3. バッジの位置 / 外観調整

- バッジを **ドラッグ＆ドロップ** してエディタ上の好きな位置へ移動できます。
    - 設定画面から値で指定することも可能です（ドラッグ＆ドロップでの指定値と連動します）

  
---
 
## 設定項目

  
主に以下のような項目をカスタマイズできます。

### 1. バッジ表示のカスタマイズ（カーソル位置 / セクション / ノート全体）

- **表示 / 非表示**: 3種の進捗バッジを個別に ON/OFF 可能。
  - ▼ 例: 全体進捗を非表示<br>
  <img src="doc/images/badge-hide-all.png" width="200">
- **見出しレベルごとの進捗表示（H1〜H6）**: セクション進捗バッジにH1〜H6の進捗を併記可能。
    - ▼ 例：H1とH2をONにすると、H2編集中にH1の進捗を同時に確認可能<br>
  <img src="doc/images/badge-headings.png" width="250">
- **表示内容**: 「現在の文字数」「目標値」「進捗率」の表示を個別に ON/OFF 可能。
  - ▼ 例: カーソル位置は現在の文字数のみ表示、セクションは全項目を表示<br>
  <img src="doc/images/badge-hide-all.png" width="200">
  
- **アイコン / ラベル**: バッジ先頭の「アイコン」「テキストラベル」の表示を切り替え可能。
  - ▼ 例: カーソル位置は両方非表示、セクションはアイコンのみ表示、全体は両方表示<br>
  <img src="doc/images/badge-icon-label.png" width="250">

### 2. カウントルール

- **カウント方式**: 「文字数」または「単語数」の切り替えが可能。
- **除外設定**: 空白文字、日本語小説用ルビ記号、その他特定の文字を指定してカウントから除外可能。

### 3. 外観と配置

- バッジの配置、不透明度、フォントサイズを変更可能。

### 4. 進捗カラーのカスタマイズ

- バッジやバーの色が切り替わる進捗率を変更可能（デフォルト: 50% / 80% / 100%）
- カラーは **[Style Settings](https://github.com/mgmeyers/obsidian-style-settings)** プラグインからGUIで変更できるほか、**CSSスニペット**でも変更可能。

#### CSSスニペットでのカラー設定

以下のCSSを`.obsidian/snippets/section-goals-badge.css`などに保存し、Obsidian本体の **設定 → 外観 → CSSスニペット** から有効化してください。

```css
/* Section Goals Badge - カスタムカラー設定 */
body {
    /* 進捗しきい値カラー */
    --sgb-color-default: #ababab; /* 初期カラー (< 50%) */
    --sgb-color-warn: #e2b93b;    /* 中間カラー (>= 50%) */
    --sgb-color-good: #ff7843;    /* 高進捗カラー (>= 80%) */
    --sgb-color-done: #ff4d4f;    /* 達成・完了カラー (>= 100%) */
}
```

#### カラー設定のサンプル

##### ① 制限目標スタイル: 指定文字数以内に収めたい場合

<img src="./doc/images/colorsample-style1.png" width="150">

```css
body {
    --sgb-color-default: #ababab; /* 余裕あり (< 50%)  : 灰 */
    --sgb-color-warn: #e2b93b;    /* 半分経過 (>= 50%) : 黄 */
    --sgb-color-good: #ff7843;    /* 上限間近 (>= 80%) : 橙 */
    --sgb-color-done: #ff4d4f;    /* 上限到達 (>= 100%): 赤 */
}
```

##### ② 達成目標スタイル: 指定文字数以上書きたい場合

<img src="./doc/images/colorsample-style2.png" width="150">

```css
body {
    --sgb-color-default: #ababab; /* 書き始め (< 50%)   : 灰 */
    --sgb-color-warn: #f09533;    /* 進行中 (>= 50%)    : 橙 */
    --sgb-color-good: #24b750;    /* あと一息 (>= 80%)  : 緑 */
    --sgb-color-done: #207dff;    /* 目標達成 (>= 100%) : 青 */
}
```


---
 

## Frontmatter 形式


- 設定した目標値は、ノート先頭の YAML Frontmatter に以下のような形式で保存されます。
- 通常は目標管理ウインドウからの設定のみで運用可能ですが、直接編集も可能です。
- ※目標値を設定しないことも可能です。

  
```yaml

---

goal-file: 10000    # <- ノート全体の目標値
goal-section: 2000　# <- セクションのデフォルト目標値
goals:
  - 第1章: 2500     # <- セクション個別の目標値
  - 第2章: 3000
---

```
  
- Tips: 全目標値を削除したい場合は、Frontmatterの上記項目群を丸ごと削除すればOKです。



---

  ## サポート & 開発支援

  
Section Goals Badge を気に入っていただけましたら、サポートを考えていただけますと幸いです。


[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-%E3%81%8A%E3%81%AB%E3%81%8E%E3%82%8A%E3%81%84%E3%81%A3%E3%81%93%E3%81%8A%E3%81%94%E3%82%8B-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/quels)

---
  
## ライセンス

本ソフトウェアは [MIT License](LICENSE) で提供されます。