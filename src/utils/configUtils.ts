import { App, TFile } from 'obsidian';

export interface KanbanFolderConfig {
	// Board structure
	doneColumn: string;
	wipLimits: Record<string, number>;

	// Team
	assignees: string[];
	defaultAssignee: string;

	// Epics
	defaultEpic: string;
	requireEpic: boolean;

	// Scrum
	sprintDuration: number;
	storyPoints: boolean;
	storyPointScale: number[];
	velocity: number | null;

	// Display
	cardFields: string[];
	showCardCount: boolean;
	columnWidth: number;

	// Priority
	priorityLevels: string[];
	defaultPriority: string;

	// Archiving
	autoArchiveDone: boolean;
	archiveAfterDays: number;

	// Dates & Tags
	dateFormat: string;
	showDueDates: boolean;
	tags: string[];
}

export const DEFAULT_FOLDER_CONFIG: KanbanFolderConfig = {
	doneColumn: 'Done',
	wipLimits: {},
	assignees: [],
	defaultAssignee: 'Unassigned',
	defaultEpic: 'Unrefined',
	requireEpic: false,
	sprintDuration: 14,
	storyPoints: false,
	storyPointScale: [1, 2, 3, 5, 8, 13, 21],
	velocity: null,
	cardFields: ['assignee', 'epic', 'priority'],
	showCardCount: true,
	columnWidth: 220,
	priorityLevels: ['Low', 'Medium', 'High', 'Critical'],
	defaultPriority: 'Medium',
	autoArchiveDone: false,
	archiveAfterDays: 7,
	dateFormat: 'YYYY-MM-DD',
	showDueDates: false,
	tags: [],
};

export function loadFolderConfig(app: App, folderPath: string): KanbanFolderConfig {
	const configPath = `${folderPath}/Config.md`;
	const fm = app.metadataCache.getCache(configPath)?.frontmatter ?? {};

	return {
		doneColumn: (fm['done-column'] as string | undefined) ?? DEFAULT_FOLDER_CONFIG.doneColumn,
		wipLimits: (fm['wip-limits'] as Record<string, number> | undefined) ?? DEFAULT_FOLDER_CONFIG.wipLimits,
		assignees: (fm['assignees'] as string[] | undefined) ?? DEFAULT_FOLDER_CONFIG.assignees,
		defaultAssignee: (fm['default-assignee'] as string | undefined) ?? DEFAULT_FOLDER_CONFIG.defaultAssignee,
		defaultEpic: (fm['default-epic'] as string | undefined) ?? DEFAULT_FOLDER_CONFIG.defaultEpic,
		requireEpic: (fm['require-epic'] as boolean | undefined) ?? DEFAULT_FOLDER_CONFIG.requireEpic,
		sprintDuration: (fm['sprint-duration'] as number | undefined) ?? DEFAULT_FOLDER_CONFIG.sprintDuration,
		storyPoints: (fm['story-points'] as boolean | undefined) ?? DEFAULT_FOLDER_CONFIG.storyPoints,
		storyPointScale: (fm['story-point-scale'] as number[] | undefined) ?? DEFAULT_FOLDER_CONFIG.storyPointScale,
		velocity: (fm['velocity'] as number | null | undefined) ?? DEFAULT_FOLDER_CONFIG.velocity,
		cardFields: (fm['card-fields'] as string[] | undefined) ?? DEFAULT_FOLDER_CONFIG.cardFields,
		showCardCount: (fm['show-card-count'] as boolean | undefined) ?? DEFAULT_FOLDER_CONFIG.showCardCount,
		columnWidth: (fm['column-width'] as number | undefined) ?? DEFAULT_FOLDER_CONFIG.columnWidth,
		priorityLevels: (fm['priority-levels'] as string[] | undefined) ?? DEFAULT_FOLDER_CONFIG.priorityLevels,
		defaultPriority: (fm['default-priority'] as string | undefined) ?? DEFAULT_FOLDER_CONFIG.defaultPriority,
		autoArchiveDone: (fm['auto-archive-done'] as boolean | undefined) ?? DEFAULT_FOLDER_CONFIG.autoArchiveDone,
		archiveAfterDays: (fm['archive-after-days'] as number | undefined) ?? DEFAULT_FOLDER_CONFIG.archiveAfterDays,
		dateFormat: (fm['date-format'] as string | undefined) ?? DEFAULT_FOLDER_CONFIG.dateFormat,
		showDueDates: (fm['show-due-dates'] as boolean | undefined) ?? DEFAULT_FOLDER_CONFIG.showDueDates,
		tags: (fm['tags'] as string[] | undefined) ?? DEFAULT_FOLDER_CONFIG.tags,
	};
}

export async function resetFolderConfig(app: App, folderPath: string): Promise<void> {
	const configPath = `${folderPath}/Config.md`;
	const file = app.vault.getAbstractFileByPath(configPath);
	if (file instanceof TFile) {
		await app.vault.modify(file, buildConfigContent());
	} else {
		await app.vault.create(configPath, buildConfigContent());
	}
}

export function buildConfigContent(): string {
	return `---
advanced-kanban-plugin: config

# Board structure — columns are defined by the ## headings in Board.md
done-column: Done
wip-limits:
  In Progress: 3
  Review: 2

# Team
assignees: []
default-assignee: Unassigned

# Epics
default-epic: Unrefined
require-epic: false

# Scrum
sprint-duration: 14
story-points: false
story-point-scale: [1, 2, 3, 5, 8, 13, 21]
velocity: null

# Display — card-fields options: assignee, epic, priority, due-date, tags, story-points
card-fields: [assignee, epic, priority]
show-card-count: true
column-width: 220

# Priority
priority-levels: [Low, Medium, High, Critical]
default-priority: Medium

# Archiving
auto-archive-done: false
archive-after-days: 7

# Dates & Tags
date-format: YYYY-MM-DD
show-due-dates: false
tags: []
---

# Config

\`\`\`akb-reset-config
\`\`\`

Edit the frontmatter above to configure your Kanban board.

| Key | Default | Description |
|-----|---------|-------------|
| \`done-column\` | \`Done\` | Column that counts as completed for progress tracking |
| \`wip-limits\` | \`{}\` | Max cards allowed per column (leave out a column for no limit) |
| \`assignees\` | \`[]\` | Team members available for assignment |
| \`default-assignee\` | \`Unassigned\` | Pre-selected assignee when creating tasks |
| \`default-epic\` | \`Unrefined\` | Pre-selected epic when creating tasks |
| \`require-epic\` | \`false\` | Whether tasks must be assigned to an epic |
| \`sprint-duration\` | \`14\` | Sprint length in days |
| \`story-points\` | \`false\` | Enable story point fields on tasks |
| \`story-point-scale\` | Fibonacci | Values available for story point estimation |
| \`velocity\` | \`null\` | Target story points per sprint |
| \`card-fields\` | see above | Fields displayed on each card |
| \`show-card-count\` | \`true\` | Show number of cards in column headers |
| \`column-width\` | \`220\` | Column width in pixels |
| \`priority-levels\` | see above | Available priority levels |
| \`default-priority\` | \`Medium\` | Default priority for new tasks |
| \`auto-archive-done\` | \`false\` | Automatically move done cards to 3-Archive |
| \`archive-after-days\` | \`7\` | Days to wait before auto-archiving done cards |
| \`date-format\` | \`YYYY-MM-DD\` | Format for dates written into task files |
| \`show-due-dates\` | \`false\` | Show due dates on cards |
| \`tags\` | \`[]\` | Predefined tags available when creating tasks |
`;
}
