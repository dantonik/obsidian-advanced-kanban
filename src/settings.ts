import {App, PluginSettingTab} from "obsidian";
import AdvancedKanbanPlugin from "./main";

export interface AdvancedKanbanSettings {
	mySetting: string;
	kanbanFolders: string[];
}

export const DEFAULT_SETTINGS: AdvancedKanbanSettings = {
	mySetting: 'default',
	kanbanFolders: [],
}

export class AdvancedKanbanSettingTab extends PluginSettingTab {
	plugin: AdvancedKanbanPlugin;

	constructor(app: App, plugin: AdvancedKanbanPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		containerEl.createEl('p', {
			text: 'Assignees are configured per-folder in Config.md (the assignees: field).',
			cls: 'setting-item-description',
		});
	}
}
