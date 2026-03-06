import { App, TFolder, TFile, TAbstractFile } from 'obsidian';

function buildTree(folder: TFolder, indent = 0): string {
	const prefix = '  '.repeat(indent);
	let lines = '';

	const sorted = [...folder.children].sort((a, b) => {
		// Folders first, then files
		const aIsFolder = a instanceof TFolder;
		const bIsFolder = b instanceof TFolder;
		if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
		return a.name.localeCompare(b.name);
	});

	for (const child of sorted) {
		if (child instanceof TFolder) {
			lines += `${prefix}- **${child.name}/**\n`;
			lines += buildTree(child, indent + 1);
		} else if (child instanceof TFile) {
			if (child.name === 'Overview.md') continue;
			lines += `${prefix}- ${child.name}\n`;
		}
	}

	return lines;
}

export function buildOverviewContent(app: App, folderPath: string): string {
	const folder = app.vault.getAbstractFileByPath(folderPath);
	if (!(folder instanceof TFolder)) return '';

	const tree = buildTree(folder);
	return `# Overview\n\n## Structure\n\n${tree}`;
}

export async function updateOverview(app: App, folderPath: string): Promise<void> {
	const overviewPath = `${folderPath}/Overview.md`;
	const content = buildOverviewContent(app, folderPath);
	const existing = app.vault.getAbstractFileByPath(overviewPath);

	if (existing instanceof TFile) {
		await app.vault.modify(existing, content);
	}
}
