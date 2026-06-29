import React from 'react';
import { cn, Icon } from '@taurent/shared';
import type { ServerCardProps } from './types';
import { CredentialHealthIndicator } from '../CredentialHealthIndicator';
import { IconButton } from '../primitives/IconButton';
import { Spinner } from '../shared/Spinner';

export const ServerCard = React.memo<ServerCardProps>(({
  server,
  status = 'disconnected',
  onSelect,
  onEdit,
  onDelete,
  disabled = false,
  deletingServerId,
  variant = 'desktop',
}) => {
  const isDeleting = deletingServerId === server.id;
  const isMobile = variant === 'mobile';
  const actionPadding = isMobile
    ? onEdit && onDelete
      ? 'pr-28'
      : onEdit || onDelete
        ? 'pr-16'
        : ''
    : '';

  return (
    <div
      className={cn(
        'group relative bg-surface transition-all',
        isMobile
          ? cn(
              'border-l-2',
              status === 'connected' ? 'border-l-success' : 'border-l-transparent'
            )
          : 'rounded-sm border border-border p-2 hover:border-border-focus'
      )}
    >
      <button
        onClick={() => onSelect(server)}
        disabled={disabled}
        className={cn(
          'w-full text-left',
          isMobile && 'flex min-h-16 items-center gap-3 px-4 py-3 active:bg-surface-interactive'
        )}
      >
        {isMobile ? (
          <>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
              <Icon name="server" iconSize="lg" />
            </div>
            <div className={cn('min-w-0 flex-1', actionPadding)}>
              <div className="flex items-center gap-2">
                <div title={server.name} className="truncate text-base font-semibold text-text-primary">
                  {server.name}
                </div>
                {status === 'connected' ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-success/10 px-2 py-1 text-xs font-medium text-success">
                    <Icon name="check" iconSize="sm" />
                    Connected
                  </span>
                ) : null}
                {status === 'connecting' ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                    <Spinner variant="ring" size="sm" />
                    Connecting
                  </span>
                ) : null}
              </div>
              <div title={server.url} className="truncate text-sm text-text-secondary font-mono">
                {server.url}
              </div>
              {server.username ? (
                <div title={server.username} className="mt-1 truncate text-xs text-text-secondary">
                  {server.username}
                </div>
              ) : null}
              {server.credentialStatus ? (
                <CredentialHealthIndicator credentialStatus={server.credentialStatus} className="mt-1" />
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex items-start gap-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-sm bg-primary/15">
              <Icon name="server" className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div title={server.name} className={cn('text-text-primary truncate pr-2', isMobile ? 'font-semibold' : 'font-medium')}>
                {server.name}
              </div>
              <div title={server.url} className="text-xs text-text-secondary font-mono truncate pr-2">
                {server.url}
              </div>
              {server.username ? (
                <div title={server.username} className="text-xs text-text-secondary mt-1 truncate">
                  {server.username}
                </div>
              ) : null}
              {server.credentialStatus ? (
                <CredentialHealthIndicator credentialStatus={server.credentialStatus} className="mt-1" />
              ) : null}
            </div>
            <div className="flex-shrink-0">
              {status === 'connecting' ? (
                <Spinner variant="ring" size="md" />
              ) : null}
              {status === 'connected' ? (
                <Icon name="check-circle" className="h-4 w-4 text-success" />
              ) : null}
            </div>
          </div>
        )}
      </button>
      {onEdit || onDelete ? (
        <div
          className={cn(
            'absolute flex items-center gap-1 transition-all',
            isMobile
              ? 'right-3 top-1/2 -translate-y-1/2 opacity-100'
              : 'right-2 top-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100'
          )}
        >
          {onEdit ? (
            <IconButton
              onClick={() => onEdit(server)}
              disabled={disabled || isDeleting}
              title="Edit server"
              variant="ghost"
            >
              <Icon name="pencil" className="h-4 w-4" />
            </IconButton>
          ) : null}
          {onDelete ? (
            <IconButton
              onClick={() => onDelete(server.id, server.name)}
              loading={isDeleting}
              disabled={disabled || isDeleting}
              title="Delete server"
              tone="danger"
              variant="ghost"
            >
              <Icon name="trash" className="h-4 w-4" />
            </IconButton>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

ServerCard.displayName = 'ServerCard';
