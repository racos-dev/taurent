import type { EnglishCatalogs } from '../en';
import type { CatalogShape } from '../shape';

export const romanianCommon = {
    appName: 'Taurent',
    language: {
      title: 'Limbă',
      description: 'Alege limba folosită de Taurent.',
      system: 'Limba sistemului',
      english: 'English',
      romanian: 'Română',
      changing: 'Se schimbă limba…',
    },
    actions: {
      add: 'Adaugă', back: 'Înapoi', cancel: 'Anulează', close: 'Închide', confirm: 'Confirmă',
      create: 'Creează', delete: 'Șterge', discard: 'Renunță', dismiss: 'Ascunde', done: 'Gata',
      edit: 'Editează', install: 'Instalează', later: 'Mai târziu', remove: 'Elimină', retry: 'Reîncearcă', save: 'Salvează',
      saving: 'Se salvează…', set: 'Setează', update: 'Actualizează', working: 'Se procesează…',
    },
    accessibility: {
      clearInput: 'Golește câmpul', unit: 'Unitate', urlScheme: 'Schema adresei URL',
      loadingContent: 'Se încarcă {{content}}',
    },
    labels: {
      search: 'Caută', settings: 'setările', statistics: 'statisticile', dialog: 'dialogul',
      addTorrent: 'adăugarea torrentului', searchContent: 'căutarea', rss: 'RSS', appShell: 'aplicația',
      torrentList: 'lista de torrente', authentication: 'autentificarea', filters: 'filtrele',
    },
    values: {
      all: 'Toate', global: 'Global', high: 'Ridicată', maximum: 'Maximă', never: 'Niciodată', no: 'Nu', none: 'Niciuna',
      normal: 'Normală', notAvailable: 'Indisponibil', skip: 'Omite', unlimited: 'Nelimitat',
      unknown: 'Necunoscut', yes: 'Da',
    },
    units: { dayShort: 'z', hourShort: 'h', minuteShort: 'min', secondShort: 's', perSecond: '/s' },
    status: {
      downloading: 'Se descarcă', seeding: 'Se partajează', paused: 'Întrerupt', completed: 'Finalizat',
      error: 'Eroare', uploading: 'Se încarcă', connected: 'Conectat', disconnected: 'Deconectat',
      active: 'Activ', inactive: 'Inactiv', checking: 'Se verifică', moving: 'Se mută', working: 'Funcțional',
      disabled: 'Dezactivat', pending: 'În așteptare', updating: 'Se actualizează',
    },
  } satisfies CatalogShape<EnglishCatalogs['common']>;
