import { AbstractInputSuggest, App, TFolder } from 'obsidian';

/**
 * Autocomplete suggest for folder paths in Vault.
 */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	constructor(
		app: App,
		private textInput: HTMLInputElement,
	) {
		super(app, textInput);
	}

	getSuggestions(inputStr: string): TFolder[] {
		const lowerQuery = inputStr.toLowerCase().trim();
		const allFiles = this.app.vault.getAllLoadedFiles();
		const folders = allFiles.filter((f): f is TFolder => f instanceof TFolder && f.path !== '/');

		if (!lowerQuery) {
			return folders.slice(0, 100);
		}

		return folders
			.filter((folder) => folder.path.toLowerCase().includes(lowerQuery))
			.slice(0, 100);
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path);
	}

	selectSuggestion(folder: TFolder): void {
		this.textInput.value = folder.path;
		this.textInput.dispatchEvent(new Event('input'));
		this.textInput.dispatchEvent(new Event('change'));
		this.close();
	}
}
