import { App, Modal, Notice } from 'obsidian';
import { buildOverviewContent } from '../utils/overviewUtils';
import { buildConfigContent } from '../utils/configUtils';
import type AdvancedKanbanPlugin from '../main';

export class CreateKanbanFolderModal extends Modal {
	private plugin: AdvancedKanbanPlugin;

	constructor(app: App, plugin: AdvancedKanbanPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'Create Kanban Folder' });

		const input = contentEl.createEl('input', { type: 'text', value: 'Kanban' });
		input.style.width = '100%';
		input.style.marginBottom = '1em';

		const button = contentEl.createEl('button', { text: 'Create' });
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') button.click();
		});
		button.addEventListener('click', async () => {
			const folderName = input.value.trim();
			if (!folderName) {
				new Notice('Please enter a folder name.');
				return;
			}
			if (this.app.vault.getAbstractFileByPath(folderName)) {
				new Notice(`"${folderName}" already exists.`);
				return;
			}

			await this.app.vault.createFolder(folderName);
			await this.app.vault.createFolder(`${folderName}/1-Epics`);
			await this.app.vault.createFolder(`${folderName}/2-Tasks`);
			await this.app.vault.createFolder(`${folderName}/3-Archive`);
			const today = new Date().toISOString().split('T')[0];
			await this.app.vault.create(
				`${folderName}/1-Epics/Unrefined.md`,
				`---\nadvanced-kanban-plugin: epic\ncreated: ${today}\n---\n\n# Unrefined\n\nCatch-all epic for items that have not yet been groomed or assigned to a specific epic.\n\n## Tasks\n`
			);
			const boardContent = `---\nadvanced-kanban-plugin: board\n---\n\n## Backlog\n\n## Todo\n\n## In Progress\n\n## Review\n\n## Done\n`;
			await this.app.vault.create(`${folderName}/Board.md`, boardContent);
			await this.app.vault.create(`${folderName}/Config.md`, buildConfigContent());
			await this.app.vault.create(`${folderName}/Overview.md`, buildOverviewContent(this.app, folderName));

			this.plugin.settings.kanbanFolders.push(folderName);
			await this.plugin.saveSettings();

			new Notice(`Kanban folder "${folderName}" created.`);
			this.close();
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}
