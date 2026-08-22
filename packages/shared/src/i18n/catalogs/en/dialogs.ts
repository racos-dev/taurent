export const englishDialogs = {
  categorySelection: {
    title: 'Set Category', description_one: 'Select a category for the selected torrent.',
    description_few: 'Select a category for the selected torrents.',
    description_other: 'Select a category for the selected torrents.', noCategory: 'No Category',
  },
  tagSelection: {
    title: 'Manage Tags', description_one: 'Select tags to add or remove from the selected torrent.',
    description_few: 'Select tags to add or remove from the selected torrents.',
    description_other: 'Select tags to add or remove from the selected torrents.',
    add: 'Add', remove: 'Remove', noTags: 'No tags available', assigned: 'assigned',
  },
  filePriority: {
    title: 'File Priority', skip: 'Do Not Download', normal: 'Normal', high: 'High', maximal: 'Maximal',
  },
  pluginInstall: {
    title: 'Install Search Plugin', description: 'Enter a plugin source URL or path',
  },
  speedLimits: {
    title: 'Speed Limits', download: 'Download', upload: 'Upload', unlimitedHint: 'Use 0 for unlimited',
  },
  desktop: {
    selectCategory_one: 'Select category for {{count}} torrent',
    selectCategory_few: 'Select category for {{count}} torrents',
    selectCategory_other: 'Select category for {{count}} torrents',
    resetCategory: '(None) — Reset category', noCategories: 'No categories defined',
    unnamedCategory: '(Unnamed category)',
    selectTags_one: 'Select tags to add or remove from {{count}} torrent',
    selectTags_few: 'Select tags to add or remove from {{count}} torrents',
    selectTags_other: 'Select tags to add or remove from {{count}} torrents',
    assigned: 'assigned', noTags: 'No tags defined', addTags: 'Add Tags', adding: 'Adding…',
    removeTags: 'Remove Tags', removing: 'Removing…', deleteNamed: 'Delete “{{name}}”?',
    categoryDeleteMessage: 'Torrents in “{{name}}” will become uncategorized.',
    tagDeleteMessage: '“{{name}}” will be removed from all torrents.', deleting: 'Deleting…',
    duplicateCategory: 'A category with this name already exists', duplicateTag: 'A tag with this name already exists',
    creating: 'Creating…', createAssign: 'Create & Assign', createAdd: 'Create & Add', create: 'Create',
    categoryName: 'Category name', tagName: 'Tag name', savePath: 'Save path', defaultSavePath: 'Default save path',
    zeroUnlimited: '0 = unlimited', downloadLimit: 'Download Limit', uploadLimit: 'Upload Limit',
  },
} as const;
