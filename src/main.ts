import {App, MarkdownView, Modal, Notice, Plugin, TFile} from 'obsidian';
import {DEFAULT_SETTINGS, AdvancedKanbanSettings, AdvancedKanbanSettingTab} from "./settings";
import {CreateKanbanFolderModal} from "./modals/CreateKanbanFolderModal";
import {updateOverview} from "./utils/overviewUtils";
import {resetFolderConfig} from "./utils/configUtils";
import {KanbanBoardView, VIEW_TYPE_KANBAN_BOARD} from "./views/KanbanBoardView";


export default class AdvancedKanbanPlugin extends Plugin {
	settings: AdvancedKanbanSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_KANBAN_BOARD, (leaf) => new KanbanBoardView(leaf, this));

		this.registerEvent(this.app.workspace.on('file-open', async (file) => {
			if (!(file instanceof TFile)) return;
			const content = await this.app.vault.read(file);
			if (!/^---[\s\S]*?advanced-kanban-plugin:\s*board[\s\S]*?---/.test(content)) return;

			const existingLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_KANBAN_BOARD)
				.find(l => (l.view as KanbanBoardView).filePath === file.path);
			const mdLeaf = this.app.workspace.getLeavesOfType('markdown')
				.find(l => (l.view as MarkdownView).file?.path === file.path);

			if (existingLeaf) {
				if (mdLeaf) mdLeaf.detach();
				this.app.workspace.revealLeaf(existingLeaf);
			} else if (mdLeaf) {
				await mdLeaf.setViewState({ type: VIEW_TYPE_KANBAN_BOARD, state: { filePath: file.path } });
			}
		}));

		this.addRibbonIcon('folder-kanban', 'Advanced Kanban', (evt: MouseEvent) => {
			new CreateKanbanFolderModal(this.app, this).open();
		});

		const getKanbanFolder = (path: string) =>
			this.settings.kanbanFolders.find(f => path.startsWith(f + '/') || path === f);

		this.registerEvent(this.app.vault.on('create', (file) => {
			const folder = getKanbanFolder(file.path);
			if (folder) updateOverview(this.app, folder);
		}));

		this.registerEvent(this.app.vault.on('delete', (file) => {
			const folder = getKanbanFolder(file.path);
			if (folder) updateOverview(this.app, folder);
		}));

		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
			const folder = getKanbanFolder(file.path) ?? getKanbanFolder(oldPath);
			if (folder) updateOverview(this.app, folder);
		}));

		this.registerMarkdownCodeBlockProcessor('akb-reset-config', (_source, el, ctx) => {
			const btn = el.createEl('button', { text: 'Reset Config to Defaults', cls: 'mod-warning' });
			btn.addEventListener('click', async () => {
				const folder = getKanbanFolder(ctx.sourcePath);
				if (!folder) {
					new Notice('This file is not in a registered Kanban folder.');
					return;
				}
				if (!confirm('Reset Config.md to defaults? All your current settings will be overwritten.')) return;
				await resetFolderConfig(this.app, folder);
				new Notice(`Config for "${folder}" reset to defaults.`);
			});
		});

		this.addCommand({
			id: 'reset-kanban-config',
			name: 'Reset Kanban Config to defaults',
			callback: async () => {
				const file = this.app.workspace.getActiveFile();
				if (!file) { new Notice('No active file.'); return; }
				const folder = getKanbanFolder(file.path);
				if (!folder) {
					new Notice('The active file is not in a Kanban folder.');
					return;
				}
				if (!confirm('Reset Config.md to defaults? All your current settings will be overwritten.')) return;
				await resetFolderConfig(this.app, folder);
				new Notice(`Config for "${folder}" reset to defaults.`);
			}
		});

		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Kanban progress: 0%');

		this.addCommand({
			id: 'create-kanban',
			name: 'Create Kanban Board',
			callback: () => {
				new AdvancedKanbanModal(this.app).open();
			}
		});

		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-modal-complex',
			name: 'Open modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new AdvancedKanbanModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
				return false;
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AdvancedKanbanSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	new Notice("Click");
		// });

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<AdvancedKanbanSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}


class AdvancedKanbanModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let {contentEl} = this;
		contentEl.setText('Kanban progress: 0%');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}
