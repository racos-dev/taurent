import type { Server } from '@taurent/shared/types/server';

export type ServerConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface ServerCardProps {
  server: Server;
  status?: ServerConnectionStatus;
  onSelect: (server: Server) => void;
  onEdit?: (server: Server) => void;
  onDelete?: (serverId: string, serverName: string) => void;
  disabled?: boolean;
  deletingServerId?: string | null;
  variant?: 'desktop' | 'mobile';
}
