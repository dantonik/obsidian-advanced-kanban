import { App, ItemView, TFile, TFolder, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import type AdvancedKanbanPlugin from '../main';
import { KanbanFolderConfig, loadFolderConfig } from '../utils/configUtils';

export const VIEW_TYPE_KANBAN_BOARD = 'advanced-kanban-board';

interface KanbanCard {
	display: string;
	linkPath: string | null;
	epic: string | null;
	assignee: string | null;
}

interface KanbanColumn {
	title: string;
	cards: KanbanCard[];
}

function addCardToColumn(content: string, columnTitle: string, cardText: string): string {
	const lines = content.split('\n');
	const headingIndex = lines.findIndex(l => l === `## ${columnTitle}`);
	if (headingIndex === -1) return content;

	let sectionEnd = lines.length;
	for (let i = headingIndex + 1; i < lines.length; i++) {
		if (lines[i]?.startsWith('## ')) { sectionEnd = i; break; }
	}

	let insertAfter = headingIndex;
	for (let i = headingIndex + 1; i < sectionEnd; i++) {
		if (lines[i]?.trim() !== '') insertAfter = i;
	}

	lines.splice(insertAfter + 1, 0, `- ${cardText}`);
	return lines.join('\n');
}

function parseCard(raw: string, app: App): KanbanCard {
	const fromCache = (linkPath: string) => {
		const cache = app.metadataCache.getCache(linkPath + '.md');
		return {
			epic: (cache?.frontmatter?.['epic'] as string) ?? null,
			assignee: (cache?.frontmatter?.['assignee'] as string) ?? null,
		};
	};

	const withLabel = raw.match(/^\[\[(.+?)\|(.+?)\]\]$/);
	if (withLabel?.[1] && withLabel?.[2]) {
		const { epic, assignee } = fromCache(withLabel[1]);
		return { display: withLabel[2], linkPath: withLabel[1], epic, assignee };
	}
	const plain = raw.match(/^\[\[(.+?)\]\]$/);
	if (plain?.[1]) {
		const parts = plain[1].split('/');
		const { epic, assignee } = fromCache(plain[1]);
		return { display: parts[parts.length - 1] ?? raw, linkPath: plain[1], epic, assignee };
	}
	return { display: raw, linkPath: null, epic: null, assignee: null };
}

function addColumnToBoard(content: string, columnTitle: string): string {
	return content.trimEnd() + `\n\n## ${columnTitle}\n`;
}

function renameColumnInBoard(content: string, oldTitle: string, newTitle: string): string {
	const lines = content.split('\n');
	const headingIndex = lines.findIndex(l => l === `## ${oldTitle}`);
	if (headingIndex === -1) return content;
	lines[headingIndex] = `## ${newTitle}`;
	return lines.join('\n');
}

function removeColumnFromBoard(content: string, columnTitle: string): string {
	const lines = content.split('\n');
	const headingIndex = lines.findIndex(l => l === `## ${columnTitle}`);
	if (headingIndex === -1) return content;

	let sectionEnd = lines.length;
	for (let i = headingIndex + 1; i < lines.length; i++) {
		if (lines[i]?.startsWith('## ')) { sectionEnd = i; break; }
	}

	lines.splice(headingIndex, sectionEnd - headingIndex);
	return lines.join('\n');
}

function addTaskToEpic(content: string, taskLink: string): string {
	const lines = content.split('\n');
	const headingIndex = lines.findIndex(l => l === '## Tasks');
	if (headingIndex === -1) return content;

	let sectionEnd = lines.length;
	for (let i = headingIndex + 1; i < lines.length; i++) {
		if (lines[i]?.startsWith('## ')) { sectionEnd = i; break; }
	}

	let insertAfter = headingIndex;
	for (let i = headingIndex + 1; i < sectionEnd; i++) {
		if (lines[i]?.trim() !== '') insertAfter = i;
	}

	lines.splice(insertAfter + 1, 0, `- ${taskLink}`);
	return lines.join('\n');
}

function parseBoardContent(content: string, app: App): KanbanColumn[] {
	const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n?/, '');
	const columns: KanbanColumn[] = [];
	let current: KanbanColumn | null = null;

	for (const line of withoutFrontmatter.split('\n')) {
		const h2 = line.match(/^## (.+)/);
		if (h2?.[1]) {
			current = { title: h2[1].trim(), cards: [] };
			columns.push(current);
		} else if (current && line.startsWith('- ')) {
			current.cards.push(parseCard(line.slice(2).trim(), app));
		}
	}

	return columns;
}

export class KanbanBoardView extends ItemView {
	filePath = '';
	folderConfig: KanbanFolderConfig | null = null;

	constructor(leaf: WorkspaceLeaf, _plugin: AdvancedKanbanPlugin) {
		super(leaf);
	}

	getViewType(): string { return VIEW_TYPE_KANBAN_BOARD; }
	getDisplayText(): string { return 'Kanban Board'; }
	getIcon(): string { return 'folder-kanban'; }

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		this.filePath = ((state as Record<string, unknown>)?.filePath as string) ?? '';
		await super.setState(state, result);
		await this.render();
	}

	getState(): Record<string, unknown> {
		return { filePath: this.filePath };
	}

	async onOpen() {
		this.registerEvent(this.app.vault.on('modify', (file) => {
			if (file.path === this.filePath) this.render();
		}));
		this.registerEvent(this.app.vault.on('create', (file) => {
			if (file.path === this.filePath) this.render();
		}));
	}

	async render() {
		const container = this.contentEl;
		container.empty();

		if (!this.filePath) return;

		const file = this.app.vault.getAbstractFileByPath(this.filePath);
		if (!(file instanceof TFile)) return;

		const parentPath = file.parent?.path;
		const folderPath = parentPath && parentPath !== '/' ? parentPath : '';
		const epicsFolder = folderPath ? `${folderPath}/1-Epics` : '1-Epics';
		const tasksFolder = folderPath ? `${folderPath}/2-Tasks` : '2-Tasks';

		this.folderConfig = folderPath ? loadFolderConfig(this.app, folderPath) : null;

		const content = await this.app.vault.read(file);
		const columns = parseBoardContent(content, this.app);

		// --- Menubar ---
		const menubar = container.createDiv({ cls: 'akb-menubar' });

		const addEpicBtn = menubar.createEl('button', { cls: 'akb-menubar-btn', text: '+ Add Epic' });
		const epicInputRow = menubar.createDiv({ cls: 'akb-menubar-input-row akb-input-row--hidden' });
		const epicNameInput = epicInputRow.createEl('input', { type: 'text', placeholder: 'Epic name…' });
		epicNameInput.addClass('akb-input');

		const submitEpic = async () => {
			const name = epicNameInput.value.trim();
			if (!name) { epicInputRow.addClass('akb-input-row--hidden'); return; }
			const epicFilePath = `${epicsFolder}/${name}.md`;
			if (this.app.vault.getAbstractFileByPath(epicFilePath)) {
				epicNameInput.value = '';
				epicInputRow.addClass('akb-input-row--hidden');
				return;
			}
			const today = new Date().toISOString().split('T')[0];
			await this.app.vault.create(
				epicFilePath,
				`---\nadvanced-kanban-plugin: epic\ncreated: ${today}\n---\n\n# ${name}\n\n## Tasks\n`
			);
			epicInputRow.addClass('akb-input-row--hidden');
		};

		addEpicBtn.addEventListener('click', () => {
			epicInputRow.removeClass('akb-input-row--hidden');
			epicNameInput.value = '';
			epicNameInput.focus();
		});

		epicNameInput.addEventListener('keydown', async (e) => {
			if (e.key === 'Enter') await submitEpic();
			if (e.key === 'Escape') epicInputRow.addClass('akb-input-row--hidden');
		});

		epicInputRow.addEventListener('focusout', (e) => {
			const related = e.relatedTarget as Node | null;
			if (!related || !epicInputRow.contains(related)) {
				epicInputRow.addClass('akb-input-row--hidden');
			}
		});

		const addColumnBtn = menubar.createEl('button', { cls: 'akb-menubar-btn', text: '+ Add Column' });
		const columnInputRow = menubar.createDiv({ cls: 'akb-menubar-input-row akb-input-row--hidden' });
		const columnNameInput = columnInputRow.createEl('input', { type: 'text', placeholder: 'Column name…' });
		columnNameInput.addClass('akb-input');

		const submitColumn = async () => {
			const name = columnNameInput.value.trim();
			if (!name) { columnInputRow.addClass('akb-input-row--hidden'); return; }
			const currentFile = this.app.vault.getAbstractFileByPath(this.filePath);
			if (!(currentFile instanceof TFile)) return;
			const currentContent = await this.app.vault.read(currentFile);
			await this.app.vault.modify(currentFile, addColumnToBoard(currentContent, name));
			columnInputRow.addClass('akb-input-row--hidden');
		};

		addColumnBtn.addEventListener('click', () => {
			columnInputRow.removeClass('akb-input-row--hidden');
			columnNameInput.value = '';
			columnNameInput.focus();
		});

		columnNameInput.addEventListener('keydown', async (e) => {
			if (e.key === 'Enter') await submitColumn();
			if (e.key === 'Escape') columnInputRow.addClass('akb-input-row--hidden');
		});

		columnInputRow.addEventListener('focusout', (e) => {
			const related = e.relatedTarget as Node | null;
			if (!related || !columnInputRow.contains(related)) {
				columnInputRow.addClass('akb-input-row--hidden');
			}
		});

		// --- Board ---
		const board = container.createDiv({ cls: 'akb-board' });
		for (const col of columns) {
			const colEl = board.createDiv({ cls: 'akb-column' });

			const header = colEl.createDiv({ cls: 'akb-column-header' });
			const titleEl = header.createDiv({ cls: 'akb-column-title', text: col.title });
			const actions = header.createDiv({ cls: 'akb-header-actions' });
			const addBtn = actions.createEl('button', { cls: 'akb-add-btn', text: '+' });
			const menuBtn = actions.createEl('button', { cls: 'akb-col-menu-btn', text: '⋯' });
			const menu = actions.createDiv({ cls: 'akb-col-menu akb-col-menu--hidden' });
			menu.createEl('button', { cls: 'akb-col-menu-item', text: 'Rename' }).addEventListener('click', () => {
				menu.addClass('akb-col-menu--hidden');
				titleEl.empty();
				const renameInput = titleEl.createEl('input', { type: 'text', value: col.title });
				renameInput.addClass('akb-col-rename-input');
				renameInput.select();
				renameInput.focus();
				let committed = false;
				const commit = async () => {
					if (committed) return;
					committed = true;
					const newName = renameInput.value.trim();
					if (newName && newName !== col.title) {
						const currentFile = this.app.vault.getAbstractFileByPath(this.filePath);
						if (!(currentFile instanceof TFile)) return;
						const currentContent = await this.app.vault.read(currentFile);
						await this.app.vault.modify(currentFile, renameColumnInBoard(currentContent, col.title, newName));
					} else {
						titleEl.empty();
						titleEl.setText(col.title);
					}
				};
				renameInput.addEventListener('keydown', async (e) => {
					if (e.key === 'Enter') await commit();
					if (e.key === 'Escape') { committed = true; titleEl.empty(); titleEl.setText(col.title); }
				});
				renameInput.addEventListener('blur', commit);
			});
			menu.createEl('button', { cls: 'akb-col-menu-item akb-col-menu-item--danger', text: 'Delete' }).addEventListener('click', async () => {
				menu.addClass('akb-col-menu--hidden');
				const cardCount = col.cards.length;
				const msg = cardCount > 0
					? `Delete column "${col.title}" and its ${cardCount} card${cardCount === 1 ? '' : 's'}? This cannot be undone.`
					: `Delete column "${col.title}"?`;
				if (!confirm(msg)) return;
				const currentFile = this.app.vault.getAbstractFileByPath(this.filePath);
				if (!(currentFile instanceof TFile)) return;
				const currentContent = await this.app.vault.read(currentFile);
				await this.app.vault.modify(currentFile, removeColumnFromBoard(currentContent, col.title));
			});
			menuBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				const isHidden = menu.hasClass('akb-col-menu--hidden');
				menu.toggleClass('akb-col-menu--hidden', !isHidden);
				if (isHidden) {
					const closeOnOutside = (ev: MouseEvent) => {
						if (!actions.contains(ev.target as Node)) {
							menu.addClass('akb-col-menu--hidden');
							document.removeEventListener('click', closeOnOutside, true);
						}
					};
					document.addEventListener('click', closeOnOutside, true);
				}
			});

			const cardsEl = colEl.createDiv({ cls: 'akb-cards' });
			for (const card of col.cards) {
				const cardEl = cardsEl.createDiv({ cls: 'akb-card' });
				cardEl.createDiv({ cls: 'akb-card-title', text: card.display });
				if (card.epic) {
					cardEl.createDiv({ cls: 'akb-card-epic', text: card.epic });
				}
				if (card.assignee && card.assignee !== 'Unassigned') {
					cardEl.createDiv({ cls: 'akb-card-assignee', text: card.assignee });
				}
				if (card.linkPath) {
					cardEl.addClass('akb-card--linked');
					cardEl.addEventListener('click', () => {
						this.app.workspace.openLinkText(card.linkPath!, this.filePath);
					});
				}
			}

			const inputRow = colEl.createDiv({ cls: 'akb-input-row akb-input-row--hidden' });
			const input = inputRow.createEl('input', { type: 'text', placeholder: 'Task name…' });
			input.addClass('akb-input');
			const epicSelect = inputRow.createEl('select', { cls: 'akb-epic-select' });
			const hasAssignees = (this.folderConfig?.assignees.length ?? 0) > 0;
			const assigneeSelect = hasAssignees
				? inputRow.createEl('select', { cls: 'akb-assignee-select' })
				: null;

			const submit = async () => {
				const text = input.value.trim();
				if (!text) { inputRow.addClass('akb-input-row--hidden'); return; }
				const currentFile = this.app.vault.getAbstractFileByPath(this.filePath);
				if (!(currentFile instanceof TFile)) return;

				const selectedEpic = epicSelect.value;
				const selectedAssignee = assigneeSelect?.value ?? 'Unassigned';
				const taskPath = `${tasksFolder}/${text}.md`;
				const today = new Date().toISOString().split('T')[0];
				const epicLine = selectedEpic ? `\nepic: ${selectedEpic}` : '';
				const assigneeLine = `\nassignee: ${selectedAssignee}`;
				const taskContent = `---\nadvanced-kanban-plugin: task\nstatus: ${col.title}\ncreated: ${today}${epicLine}${assigneeLine}\n---\n\n# ${text}\n`;

				if (!this.app.vault.getAbstractFileByPath(tasksFolder)) {
					await this.app.vault.createFolder(tasksFolder);
				}
				await this.app.vault.create(taskPath, taskContent);

				if (selectedEpic) {
					const epicFilePath = `${epicsFolder}/${selectedEpic}.md`;
					const epicFile = this.app.vault.getAbstractFileByPath(epicFilePath);
					if (epicFile instanceof TFile) {
						const epicContent = await this.app.vault.read(epicFile);
						const taskLink = `[[${tasksFolder}/${text}|${text}]]`;
						await this.app.vault.modify(epicFile, addTaskToEpic(epicContent, taskLink));
					}
				}

				const linkPath = `${tasksFolder}/${text}`;
				const currentContent = await this.app.vault.read(currentFile);
				await this.app.vault.modify(currentFile, addCardToColumn(currentContent, col.title, `[[${linkPath}|${text}]]`));
				await this.render();
			};

			addBtn.addEventListener('click', () => {
				epicSelect.empty();
				epicSelect.createEl('option', { value: '', text: '— no epic —' });
				const epicsNode = this.app.vault.getAbstractFileByPath(epicsFolder);
				if (epicsNode instanceof TFolder) {
					for (const child of epicsNode.children) {
						if (child instanceof TFile && child.extension === 'md') {
							epicSelect.createEl('option', { value: child.basename, text: child.basename });
						}
					}
				}
				epicSelect.value = 'Unrefined';

				if (assigneeSelect) {
					assigneeSelect.empty();
					assigneeSelect.createEl('option', { value: 'Unassigned', text: 'Unassigned' });
					for (const assignee of this.folderConfig?.assignees ?? []) {
						assigneeSelect.createEl('option', { value: assignee, text: assignee });
					}
				}

				inputRow.removeClass('akb-input-row--hidden');
				input.value = '';
				input.focus();
			});

			const onKeydown = async (e: KeyboardEvent) => {
				if (e.key === 'Enter') await submit();
				if (e.key === 'Escape') inputRow.addClass('akb-input-row--hidden');
			};
			input.addEventListener('keydown', onKeydown);
			epicSelect.addEventListener('keydown', onKeydown);
			assigneeSelect?.addEventListener('keydown', onKeydown);

			inputRow.addEventListener('focusout', (e) => {
				const related = e.relatedTarget as Node | null;
				if (!related || !inputRow.contains(related)) {
					inputRow.addClass('akb-input-row--hidden');
				}
			});
		}
	}

	async onClose() {}
}
