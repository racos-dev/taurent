import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQBClient } from '../connection';
import { useServerManager } from '../connection/ServerManager';
import {
  Button,
  ConfirmDialog,
  Input,
  StateCard,
  ServerCard,
  ScreenHeader,
  CredentialWarningBanner,
} from '@taurent/web-ui';
import { useLoginScreenController } from '@taurent/web-core';
import type { Server } from '@taurent/shared/types/server';
import { Icon } from '../ui/Icon';
import { classifyError } from '@taurent/shared/utils/error';
import { motion } from '@taurent/shared/theme';
import {
  mobileCenteredStateClassName,
  mobileScreenContentClassName,
  mobileScreenRootClassName,
} from '../ui/mobileScreenLayout';
import { useLocalizedErrorFormatter, useTaurentTranslation } from '@taurent/shared/i18n';

export function LoginScreen() {
  const { t } = useTaurentTranslation('auth');
  const { t: commonT } = useTaurentTranslation('common');
  const formatError = useLocalizedErrorFormatter();
  const navigate = useNavigate();
  const location = useLocation();
  const { connect, isConnecting, isConnected, isHydrated, error: connectError, serverId } = useQBClient();
  const { servers, loading, removeServer, switchServer, updateServer } = useServerManager();

  const locationState = location.state as { error?: string } | null;
  const locationError = locationState?.error ?? null;
  const rawError = locationError ?? connectError ?? null;

  const [dismissedWarning, setDismissedWarning] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingServerId, setSavingServerId] = useState<string | null>(null);
  const warningServer = servers.find((s) => s.credentialWarning);
  const credentialWarning = warningServer?.credentialWarning;

  const startEditServer = (server: Server) => {
    setEditingServerId(server.id);
    setEditName(server.name);
    setEditUrl(server.url);
    setEditUsername(server.username);
    setEditPassword('');
    setEditError(null);
  };

  const cancelEditServer = () => {
    setEditingServerId(null);
    setEditName('');
    setEditUrl('');
    setEditUsername('');
    setEditPassword('');
    setEditError(null);
  };

  const saveEditServer = async () => {
    if (!editingServerId) return;

    if (!editName.trim() || !editUrl.trim() || !editUsername.trim()) {
      setEditError(t('form.editRequired'));
      return;
    }

    setSavingServerId(editingServerId);
    setEditError(null);

    try {
      await updateServer(editingServerId, {
        name: editName.trim(),
        url: editUrl.trim(),
        username: editUsername.trim(),
        ...(editPassword.trim()
          ? { password: editPassword, rememberPassword: true }
          : {}),
      });
      cancelEditServer();
    } catch (error) {
      setEditError(formatError(error, 'settings-save'));
    } finally {
      setSavingServerId(null);
    }
  };

  // ─── Shared controller (select server + delete) ──
  const controller = useLoginScreenController({
    connect,
    servers,
    removeServer,
    isConnecting,
    isConnected,
    connectedServerId: serverId,
    switchServer,
    onConnectSuccess: () => navigate('/', { replace: true }),
    onConnectError: (msg, category) => {
      navigate('/servers', { replace: true, state: { error: msg, errorCategory: category } });
    },
    classifyError,
  });

  if (loading || !isHydrated) {
    return (
      <div className={mobileCenteredStateClassName()}>
        <StateCard
          title={t('loading.servers')}
          icon={<Icon name="server" iconSize="lg" />}
          className="max-w-sm"
        />
      </div>
    );
  }

  return (
    <div className={mobileScreenRootClassName({ className: 'flex flex-col' })}>
      <ScreenHeader title={t('server.title')} variant="mobile" onBack={() => navigate(-1)} />

      <main className={mobileScreenContentClassName({ bottomSpacing: 'content', className: 'flex-1' })}>
        <div>
          {/* Connection error banner */}
          {rawError && (
            <div className="mb-4 rounded-md border border-error/40 bg-error/15 p-3">
              <div className="flex items-start gap-2">
                <Icon name="alert" iconSize="md" className="mt-1 flex-shrink-0 text-error" />
                <div>
                  <p className="text-sm font-medium text-error">
                    {rawError && typeof rawError === 'string' && rawError.toLowerCase().includes('auth')
                      ? t('authenticationFailed')
                      : t('connectionFailed')}
                  </p>
                  <p className="mt-1 text-xs text-error/80">
                    {formatError(rawError, 'connection')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Credential Warning Banner */}
          {credentialWarning && !dismissedWarning && (
            <div className="mb-4">
              <CredentialWarningBanner
                warning={credentialWarning}
                credentialStatus={warningServer?.credentialStatus}
                onDismiss={() => setDismissedWarning(true)}
              />
            </div>
          )}

          {servers.length === 0 ? (
            <StateCard
              title={t('server.noneYet')}
              message={t('server.firstToManage')}
              icon={<Icon name="server" iconSize="lg" />}
              className="max-w-sm"
            />
          ) : (
            <div className="divide-y divide-border border-y border-border bg-surface">
              {servers.map((server) => (
                <div key={server.id}>
                  <ServerCard
                    server={server}
                    variant="mobile"
                    status={controller.getServerStatus(server)}
                    onSelect={(selectedServer) => {
                      if (editingServerId === selectedServer.id) return;
                      controller.handleSelectServer(selectedServer);
                    }}
                    onEdit={startEditServer}
                    onDelete={controller.handleDeleteServer}
                    disabled={isConnecting || savingServerId === server.id}
                    deletingServerId={controller.deletingServerId}
                  />
                  {editingServerId === server.id ? (
                    <ServerEditForm
                      name={editName}
                      url={editUrl}
                      username={editUsername}
                      password={editPassword}
                      error={editError}
                      isSaving={savingServerId === server.id}
                      onNameChange={setEditName}
                      onUrlChange={setEditUrl}
                      onUsernameChange={setEditUsername}
                      onPasswordChange={setEditPassword}
                      onSave={() => void saveEditServer()}
                      onCancel={cancelEditServer}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <Button
            variant="primary"
            size="md"
            leftIcon="+"
            onClick={() => navigate('/add-server')}
            className={`mt-4 w-full ${motion.scale.button}`}
          >
            {t('server.addNew')}
          </Button>
        </div>
      </main>

      {/* Confirm Delete Dialog */}
      {controller.deleteDialog && (
        <ConfirmDialog
          title={t('deleteServerTitle')}
          message={t('deleteServerMessage', { name: controller.deleteDialog.serverName })}
          confirmLabel={commonT('actions.delete')}
          onConfirm={() => {
            void controller.confirmDelete();
          }}
          onCancel={controller.dismissDeleteDialog}
          tone="danger"
        />
      )}
    </div>
  );
}

function ServerEditForm({
  name,
  url,
  username,
  password,
  error,
  isSaving,
  onNameChange,
  onUrlChange,
  onUsernameChange,
  onPasswordChange,
  onSave,
  onCancel,
}: {
  name: string;
  url: string;
  username: string;
  password: string;
  error: string | null;
  isSaving: boolean;
  onNameChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t } = useTaurentTranslation('auth');
  const { t: commonT } = useTaurentTranslation('common');
  return (
    <div className="space-y-3 border-t border-border bg-surface-elevated px-4 py-4">
      <Input
        id="server-edit-name"
        label={t('server.name')}
        value={name}
        onChange={onNameChange}
        autoComplete="off"
      />
      <Input
        id="server-edit-url"
        label={t('server.url')}
        type="url"
        value={url}
        onChange={onUrlChange}
        autoComplete="url"
      />
      <Input
        id="server-edit-username"
        label={t('server.username')}
        value={username}
        onChange={onUsernameChange}
        autoComplete="username"
      />
      <Input
        id="server-edit-password"
        label={t('server.password')}
        type="password"
        value={password}
        onChange={onPasswordChange}
        autoComplete="current-password"
        helperText={t('form.keepSavedPassword')}
      />
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="md" onClick={onCancel} disabled={isSaving}>
          {commonT('actions.cancel')}
        </Button>
        <Button variant="primary" size="md" onClick={onSave} loading={isSaving}>
          {commonT('actions.save')}
        </Button>
      </div>
    </div>
  );
}
