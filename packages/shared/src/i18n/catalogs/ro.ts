import type { EnglishCatalogs } from './en';

type CatalogShape<T> = {
  [K in keyof T]: T[K] extends string ? string : CatalogShape<T[K]>;
};

export const romanianCatalogs = {
  common: {
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
      edit: 'Editează', later: 'Mai târziu', remove: 'Elimină', retry: 'Reîncearcă', save: 'Salvează',
      set: 'Setează', update: 'Actualizează',
    },
    values: {
      all: 'Toate', global: 'Global', high: 'Ridicată', maximum: 'Maximă', never: 'Niciodată', no: 'Nu', none: 'Niciuna',
      normal: 'Normală', notAvailable: 'Indisponibil', skip: 'Omite', unlimited: 'Nelimitat',
      unknown: 'Necunoscut', yes: 'Da',
    },
  },
  auth: {
    loading: { initializing: 'Se inițializează…', servers: 'Se încarcă serverele…', connecting: 'Se conectează…',
      appState: 'Se încarcă starea aplicației.', reachingServer: 'Se contactează serverul qBittorrent.' },
    server: {
      add: 'Adaugă server', addNew: 'Adaugă un server nou', connect: 'Conectare la server',
      manage: 'Gestionează serverele', name: 'Numele serverului', password: 'Parolă', saved: 'Servere salvate',
      title: 'Servere', url: 'Adresa serverului', username: 'Nume de utilizator', switch: 'Schimbă serverul',
    },
    form: {
      connectTitle: 'Conectare la qBittorrent', connect: 'Conectează', connecting: 'Se conectează…',
      corsTitle: 'A fost detectată o eroare CORS',
      browserHint: 'Aceasta poate apărea când Taurent rulează într-un browser în locul clientului desktop sau mobil.',
      serverNameRequired: 'Numele serverului *', serverNamePlaceholder: 'Serverul meu de acasă',
      serverUrlRequired: 'Adresa serverului *', serverUrlHelper: 'de ex., localhost:8080 sau https://server:8080',
      didYouMean: 'Ai vrut să scrii', username: 'Nume de utilizator',
      usernameRequired: 'Nume de utilizator *', password: 'Parolă', passwordPlaceholder: 'Introdu parola',
      apiKey: 'Cheie API', rememberPassword: 'Reține parola', useApiKey: 'Folosește cheia API',
      useApiKeyDescription: 'Autentifică-te cu o cheie API qBittorrent în locul numelui de utilizator și parolei',
      adding: 'Se adaugă…',
    },
    connectionProblem: 'Problemă de conexiune', notConnected: 'Neconectat',
    chooseServer: 'Alege un server pentru a gestiona torrentele.', goToLogin: 'Mergi la autentificare',
  },
  torrents: {
    title: 'Torrente', add: 'Adaugă torrent', addLink: 'Adaugă link torrent…', addFile: 'Adaugă fișier torrent…',
    delete: 'Șterge torrentul', empty: 'Nu există torrente', filterPlaceholder: 'Filtrează torrentele…',
    search: 'Caută torrente', selected_one: '{{count}} torrent selectat', selected_few: '{{count}} torrente selectate',
    selected_other: '{{count}} de torrente selectate',
    status: {
      allocating: 'Se alocă', checking: 'Se verifică', checkingResume: 'Se verifică datele de reluare',
      completed: 'Finalizat', downloading: 'Se descarcă', downloadingMetadata: 'Se descarcă metadatele',
      error: 'Eroare', forcedDownload: 'Descărcare forțată', forcedUpload: 'Încărcare forțată',
      missingFiles: 'Fișiere lipsă', moving: 'Se mută', paused: 'Întrerupt', queued: 'În așteptare',
      seeding: 'Se partajează', stalled: 'Blocat', unknown: 'Necunoscut',
    },
    fields: {
      availability: 'Disponibilitate', category: 'Categorie', completed: 'Finalizat', dateAdded: 'Data adăugării',
      downloadSpeed: 'Viteză de descărcare', downloaded: 'Descărcat', eta: 'Timp rămas', name: 'Nume',
      peers: 'Parteneri', priority: 'Prioritate', progress: 'Progres', ratio: 'Raport', remaining: 'Rămas',
      savePath: 'Cale de salvare', seeds: 'Surse', size: 'Dimensiune', state: 'Stare', tags: 'Etichete',
      tracker: 'Tracker', uploadSpeed: 'Viteză de încărcare', uploaded: 'Încărcat',
    },
  },
  settings: {
    title: 'Setări', appearance: 'Aspect', appBehavior: 'Comportamentul aplicației', about: 'Despre', language: 'Limbă',
    advanced: 'Avansate', bittorrent: 'BitTorrent', connection: 'Conexiune', downloads: 'Descărcări',
    pathMappings: 'Mapări de căi', servers: 'Servere', speed: 'Viteză', theme: 'Temă', webui: 'Interfață web',
  },
  errors: {
    unknown: 'Ceva nu a funcționat. Încearcă din nou.',
    auth: 'Autentificarea a eșuat. Verifică numele de utilizator și parola.',
    network: 'Serverul nu poate fi contactat. Verifică adresa și conexiunea la rețea.',
    http: 'Serverul a returnat o eroare. Încearcă din nou.', conflict: 'Acest element există deja.',
    response: 'Răspunsul serverului nu a putut fi citit. Încearcă din nou.',
    connection: 'Conectarea la server a eșuat. Încearcă din nou.',
    serverSwitch: 'Schimbarea serverului a eșuat. Încearcă din nou.', nativeMenu: 'Meniul aplicației nu a putut fi actualizat.',
    torrentAction: 'Acțiunea asupra torrentului a eșuat. Încearcă din nou.',
    settingsSave: 'Setările nu au putut fi salvate. Încearcă din nou.',
    speedLimits: 'Limitele de viteză nu au putut fi actualizate. Încearcă din nou.',
    healthCheck: 'Verificarea conexiunii a eșuat. Taurent va continua să încerce.',
    reconnect: 'Reconectarea la server a eșuat. Taurent va continua să încerce.',
  },
  desktop: {
    windows: {
      addTorrent: 'Adaugă torrent', altDownloadLimit: 'Limită alternativă de descărcare',
      altUploadLimit: 'Limită alternativă de încărcare', category: 'Selectează categoria', confirm: 'Confirmare', create: 'Creează',
      deleteServer: 'Șterge serverul', deleteTorrent: 'Șterge torrentul', dialog: 'Dialog',
      editCategory: 'Editează categoria', editCategoryNamed: 'Editează categoria — {{name}}',
      globalSpeedLimits: 'Limite globale de viteză', settings: 'Setări',
      shareLimits: 'Limite de partajare', limitShareRatio: 'Limitează raportul de partajare', statistics: 'Statistici', tags: 'Adaugă/elimină etichete',
      torrentDialog: 'Dialog torrent', torrentLimit: 'Limită torrent', transferLimit: 'Limită de transfer',
      downloadLimit: 'Limită de descărcare', uploadLimit: 'Limită de încărcare',
    },
    menu: {
      app: 'Taurent', about: 'Despre Taurent', addTorrent: 'Adaugă torrent…', copy: 'Copiază', cut: 'Taie',
      delete: 'Șterge', edit: 'Editare', file: 'Fișier', forceStart: 'Pornire forțată', help: 'Ajutor',
      hide: 'Ascunde Taurent', hideOthers: 'Ascunde celelalte', moveBottom: 'Mută la sfârșit',
      moveTop: 'Mută la început', paste: 'Lipește', pause: 'Întrerupe', queueDown: 'Coboară în coadă',
      queueUp: 'Urcă în coadă', quit: 'Închide Taurent', reannounce: 'Reanunță', recheck: 'Reverifică',
      redo: 'Refă', resume: 'Reia', rss: 'RSS…', search: 'Caută…', selectAll: 'Selectează tot',
      setCategory: 'Setează categoria…', setTags: 'Setează etichetele…', settings: 'Setări…',
      showAll: 'Afișează toate', showMenuBar: 'Afișează bara de meniu', statistics: 'Statistici…',
      toggleDetails: 'Comută panoul de detalii', toggleSidebar: 'Comută bara laterală', tools: 'Instrumente',
      torrent: 'Torrent', undo: 'Anulează', view: 'Vizualizare',
    },
    tray: {
      addTorrent: 'Adaugă fișier/link torrent…', alternativeSpeed: 'Limite alternative de viteză',
      globalSpeedLimits: 'Setează limitele globale de viteză…', hide: 'Ascunde', quit: 'Închide', show: 'Afișează',
    },
  },
  mobile: { navigation: { home: 'Torrente', rss: 'RSS', search: 'Căutare', settings: 'Setări' } },
} satisfies CatalogShape<EnglishCatalogs>;
