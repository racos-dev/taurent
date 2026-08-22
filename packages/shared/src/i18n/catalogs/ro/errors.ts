import type { EnglishCatalogs } from '../en';
import type { CatalogShape } from '../shape';

export const romanianErrors = {
    unknown: 'Ceva nu a funcționat. Încearcă din nou.',
    auth: 'Autentificarea a eșuat. Verifică numele de utilizator și parola.',
    network: 'Serverul nu poate fi contactat. Verifică adresa și conexiunea la rețea.',
    http: 'Serverul a returnat o eroare. Încearcă din nou.', conflict: 'Acest element există deja.',
    response: 'Răspunsul serverului nu a putut fi citit. Încearcă din nou.',
    connection: 'Conectarea la server a eșuat. Încearcă din nou.',
    addServer: 'Serverul nu a putut fi adăugat. Încearcă din nou.',
    addTorrent: 'Torrentul nu a putut fi adăugat. Încearcă din nou.',
    appSettings: 'Setările aplicației nu au putut fi actualizate. Încearcă din nou.',
    filePicker: 'Fișierele torrent nu au putut fi selectate. Încearcă din nou.',
    pathMappings: 'Mapările de căi nu au putut fi actualizate. Încearcă din nou.',
    rss: 'Datele RSS nu au putut fi încărcate. Încearcă din nou.',
    search: 'Căutarea a eșuat. Încearcă din nou.',
    serverSwitch: 'Schimbarea serverului a eșuat. Încearcă din nou.', nativeMenu: 'Meniul aplicației nu a putut fi actualizat.',
    torrentAction: 'Acțiunea asupra torrentului a eșuat. Încearcă din nou.',
    settingsSave: 'Setările nu au putut fi salvate. Încearcă din nou.',
    settingsLoad: 'Setările nu au putut fi încărcate. Încearcă din nou.',
    speedLimits: 'Limitele de viteză nu au putut fi actualizate. Încearcă din nou.',
    healthCheck: 'Verificarea conexiunii a eșuat. Taurent va continua să încerce.',
    reconnect: 'Reconectarea la server a eșuat. Taurent va continua să încerce.',
    renderer: {
      title: 'Ceva nu a funcționat',
      message: 'Vizualizarea aplicației s-a oprit neașteptat. Reîncarcă pentru a încerca din nou sau închide fereastra.',
      reload: 'Reîncarcă', close: 'Închide',
    },
  } satisfies CatalogShape<EnglishCatalogs['errors']>;
