import type { EnglishCatalogs } from '../en';
import type { CatalogShape } from '../shape';

export const romanianDialogs = {
  categorySelection: {
    title: 'Setează categoria', description_one: 'Alege o categorie pentru torrentul selectat.',
    description_few: 'Alege o categorie pentru torrentele selectate.',
    description_other: 'Alege o categorie pentru torrentele selectate.', noCategory: 'Fără categorie',
  },
  tagSelection: {
    title: 'Gestionează etichetele',
    description_one: 'Alege etichetele de adăugat sau eliminat de la torrentul selectat.',
    description_few: 'Alege etichetele de adăugat sau eliminat de la torrentele selectate.',
    description_other: 'Alege etichetele de adăugat sau eliminat de la torrentele selectate.',
    add: 'Adaugă', remove: 'Elimină', noTags: 'Nu există etichete disponibile', assigned: 'atribuită',
  },
  filePriority: {
    title: 'Prioritatea fișierului', skip: 'Nu descărca', normal: 'Normală', high: 'Ridicată', maximal: 'Maximă',
  },
  pluginInstall: {
    title: 'Instalează extensia de căutare', description: 'Introdu adresa URL sau calea sursei extensiei',
  },
  speedLimits: {
    title: 'Limite de viteză', download: 'Descărcare', upload: 'Încărcare',
    unlimitedHint: 'Folosește 0 pentru nelimitat',
  },
  desktop: {
    selectCategory_one: 'Alege categoria pentru {{count}} torrent',
    selectCategory_few: 'Alege categoria pentru {{count}} torrente',
    selectCategory_other: 'Alege categoria pentru {{count}} de torrente',
    resetCategory: '(Niciuna) — Resetează categoria', noCategories: 'Nu este definită nicio categorie',
    unnamedCategory: '(Categorie fără nume)',
    selectTags_one: 'Alege etichetele de adăugat sau eliminat de la {{count}} torrent',
    selectTags_few: 'Alege etichetele de adăugat sau eliminat de la {{count}} torrente',
    selectTags_other: 'Alege etichetele de adăugat sau eliminat de la {{count}} de torrente',
    assigned: 'atribuită', noTags: 'Nu este definită nicio etichetă', addTags: 'Adaugă etichete',
    adding: 'Se adaugă…', removeTags: 'Elimină etichete', removing: 'Se elimină…',
    deleteNamed: 'Ștergi „{{name}}”?',
    categoryDeleteMessage: 'Torrentele din „{{name}}” vor rămâne fără categorie.',
    tagDeleteMessage: '„{{name}}” va fi eliminată din toate torrentele.', deleting: 'Se șterge…',
    duplicateCategory: 'Există deja o categorie cu acest nume', duplicateTag: 'Există deja o etichetă cu acest nume',
    creating: 'Se creează…', createAssign: 'Creează și atribuie', createAdd: 'Creează și adaugă', create: 'Creează',
    categoryName: 'Numele categoriei', tagName: 'Numele etichetei', savePath: 'Cale de salvare',
    defaultSavePath: 'Calea implicită de salvare',
    zeroUnlimited: '0 = nelimitat', downloadLimit: 'Limită de descărcare', uploadLimit: 'Limită de încărcare',
  },
} satisfies CatalogShape<EnglishCatalogs['dialogs']>;
