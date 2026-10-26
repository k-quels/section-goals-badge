import { App, Modal } from 'obsidian';
import { t } from '../lang/helpers';

export interface ConfirmModalOptions {
	message: string;
	confirmText?: string;
	cancelText?: string;
	isWarning?: boolean;
	onConfirm: () => void;
}

/**
 * Reusable confirmation dialog modal for destructive or batch actions across the plugin.
 */
export class ConfirmModal extends Modal {
	private options: ConfirmModalOptions;

	constructor(app: App, options: ConfirmModalOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('sgb-confirm-modal');

		contentEl.createEl('p', { text: this.options.message });

		const buttonContainer = contentEl.createDiv({ cls: 'sgb-confirm-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: this.options.cancelText ?? t('MODAL_CONFIRM_CANCEL'),
		});
		cancelBtn.addEventListener('click', () => {
			this.close();
		});

		const confirmBtn = buttonContainer.createEl('button', {
			cls: this.options.isWarning ? 'mod-warning' : 'mod-cta',
			text: this.options.confirmText ?? t('MODAL_CONFIRM_OK'),
		});
		confirmBtn.addEventListener('click', () => {
			this.close();
			this.options.onConfirm();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
