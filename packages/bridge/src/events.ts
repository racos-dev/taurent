// Normalized event payload types for Tauri bridge events

import type { SessionStatus, MaindataSyncChangedEvent } from './types';
import type { ThemePalette, ThemeVariant } from '@taurent/shared/theme/types';

export interface SessionChangedEvent {
  session_generation: number;
  server_id: string | null;
  status: SessionStatus;
  last_error: string | null;
}

export interface ResourceInvalidatedEvent {
  session_generation: number;
  server_id: string | null;
  resource: string;
}

export interface OperationFailedEvent {
  session_generation: number;
  server_id: string | null;
  operation: string;
  error: string;
}

export interface ThemeChangedEvent {
  theme_class: string;
  mode?: 'system' | 'manual';
  system_palette?: ThemePalette;
  manual_palette?: ThemePalette;
  manual_variant?: ThemeVariant;
  accent?: string | null;
}

export type BridgeEvent =
  | { event: 'session-changed'; payload: SessionChangedEvent }
  | { event: 'resource-invalidated'; payload: ResourceInvalidatedEvent }
  | { event: 'operation-failed'; payload: OperationFailedEvent }
  | { event: 'theme-changed'; payload: ThemeChangedEvent }
  | { event: 'maindata-sync-changed'; payload: MaindataSyncChangedEvent };
