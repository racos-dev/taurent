import type { EnglishCatalogs } from '../en';
import type { CatalogShape } from '../shape';

export const romanianStatistics = {
  title: 'Statistici', subtitle: 'Statisticile serverului qBittorrent',
  notConnected: 'Neconectat', connectMessage: 'Conectează-te la un server qBittorrent pentru a vedea statisticile.',
  loading: 'Se încarcă statisticile', loadingMessage: 'Se preiau cele mai recente statistici de pe serverul qBittorrent.',
  unavailable: 'Statisticile nu sunt disponibile', unavailableMessage: 'Datele statistice nu sunt disponibile momentan.',
  user: 'Statistici utilizator', allTimeUpload: 'Încărcat în total', allTimeDownload: 'Descărcat în total',
  allTimeRatio: 'Raport total de partajare', sessionWaste: 'Date irosite în sesiune',
  connectedPeers: 'Parteneri conectați', cache: 'Statistici cache',
  readCacheHits: 'Regăsiri reușite în cache-ul de citire', totalBufferSize: 'Dimensiunea totală a memoriei tampon',
  performance: 'Statistici de performanță', writeCacheOverload: 'Supraîncărcarea cache-ului de scriere',
  readCacheOverload: 'Supraîncărcarea cache-ului de citire', queuedIoJobs: 'Operațiuni I/O în coadă',
  averageQueueTime: 'Timp mediu în coadă', totalQueuedSize: 'Dimensiunea totală din coadă', seconds: '{{value}} s',
} satisfies CatalogShape<EnglishCatalogs['statistics']>;
