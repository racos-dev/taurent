// Headless controller for LoginScreen orchestration.
//
// Platform-agnostic — does not import @tauri-apps/* or produce UI.
//
// Extracts server selection, deletion, and status derivation from the
// desktop/mobile LoginScreen routes into a reusable shared hook.
// UI rendering stays in the app route shell.
//
// Usage (mobile/desktop LoginScreen):
//   const controller = useLoginScreenController({
//     connect,
//     servers,
//     removeServer,
//     isConnecting,
//     connectedServerId,
//     onConnectSuccess: () => navigate('/'),
//     onConnectError: (msg) => navigate('/servers', { state: { error: msg } }),
//   });

import { useState, useCallback } from 'react';
import type { Server } from '@taurent/shared/types/server';
import { getErrorMessage } from '@taurent/shared/utils/error';
import type { ErrorCategory } from '@taurent/shared/utils/error';

// ─── Local type alias (avoids importing from web-ui in web-core) ──────────────

type ServerConnectionStatus = 'disconnected' | 'connecting' | 'connected';

// ─── Input types ─────────────────────────────────────────────────────────────

export interface LoginScreenControllerOptions {
  /** Connect to a server by id */
  connect: (serverId: string) => Promise<void>;
  /** Current server list */
  servers: Server[];
  /** Remove a server */
  removeServer: (serverId: string) => Promise<void>;
  /** Whether a connection attempt is in progress */
  isConnecting: boolean;
  /** Whether the session is currently connected */
  isConnected?: boolean;
  /** The currently connected server id, if any */
  connectedServerId: string | null;
  /** Atomic switch-server function (mobile) */
  switchServer?: (serverId: string) => Promise<void>;
  /** Called when connection succeeds */
  onConnectSuccess: () => void;
  /** Called when connection fails with error message and optional category */
  onConnectError: (message: string, category?: ErrorCategory) => void;
  /** Optional classifier to categorize connection errors */
  classifyError?: (error: unknown) => ErrorCategory;
}

// ─── Output types ────────────────────────────────────────────────────────────

export interface LoginScreenControllerResult {
  // ─── Server list actions ──────────────────────────────────
  handleSelectServer: (server: Server) => void;
  handleDeleteServer: (serverId: string, serverName: string) => void;
  deleteDialog: DeleteDialogState | null;
  dismissDeleteDialog: () => void;
  confirmDelete: () => Promise<void>;
  deletingServerId: string | null;

  // ─── Server status ────────────────────────────────────────
  getServerStatus: (server: Server) => ServerConnectionStatus;
}

// ─── Delete dialog state ─────────────────────────────────────────────────────

export interface DeleteDialogState {
  serverId: string;
  serverName: string;
  onConfirm: () => Promise<void>;
}

// ─── Implementation ─────────────────────────────────────────────────────────

export function useLoginScreenController({
  connect,
  removeServer,
  isConnecting,
  isConnected,
  connectedServerId,
  switchServer,
  onConnectSuccess,
  onConnectError,
  classifyError,
}: LoginScreenControllerOptions): LoginScreenControllerResult {
  // ─── Delete dialog state ─────────────────────────────────
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [deletingServerId, setDeletingServerId] = useState<string | null>(null);

  // ─── Server selection ─────────────────────────────────────
  const handleSelectServer = useCallback(
    async (server: Server) => {
      if (isConnecting) return;
      // If already connected to this server, just navigate back
      if (connectedServerId === server.id) {
        onConnectSuccess();
        return;
      }
      try {
        if (isConnected && switchServer) {
          await switchServer(server.id);
        } else {
          await connect(server.id);
        }
        onConnectSuccess();
      } catch (err) {
        const message = getErrorMessage(err);
        const category = classifyError?.(err);
        onConnectError(message, category);
      }
    },
    [isConnecting, isConnected, connectedServerId, connect, switchServer, onConnectSuccess, onConnectError, classifyError],
  );

  // ─── Delete flow ───────────────────────────────────────────
  const handleDeleteServer = useCallback(
    (serverId: string, serverName: string) => {
      setDeleteDialog({
        serverId,
        serverName,
        onConfirm: async () => {
          setDeletingServerId(serverId);
          try {
            await removeServer(serverId);
          } catch (err) {
            console.error('Failed to delete server:', err);
          } finally {
            setDeletingServerId(null);
            setDeleteDialog(null);
          }
        },
      });
    },
    [removeServer],
  );

  const dismissDeleteDialog = useCallback(() => {
    setDeleteDialog(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    await deleteDialog?.onConfirm();
  }, [deleteDialog]);

  // ─── Status derivation ─────────────────────────────────────
  const getServerStatus = useCallback(
    (server: Server): ServerConnectionStatus => {
      if (isConnecting && connectedServerId === server.id) return 'connecting';
      if (isConnected && connectedServerId === server.id) return 'connected';
      return 'disconnected';
    },
    [isConnecting, isConnected, connectedServerId],
  );

  return {
    handleSelectServer,
    handleDeleteServer,
    deleteDialog,
    dismissDeleteDialog,
    confirmDelete,
    deletingServerId,
    getServerStatus,
  };
}