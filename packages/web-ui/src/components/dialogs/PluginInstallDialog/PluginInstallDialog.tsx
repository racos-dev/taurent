import React, { useState } from 'react';
import { Dialog } from '../Dialog';
import { DialogActions } from '../DialogActions';
import { Input } from '../../primitives/Input';
import type { PluginInstallDialogProps } from './types';
import { useTaurentTranslation } from '@taurent/shared/i18n';

export const PluginInstallDialog = React.memo<PluginInstallDialogProps>(({
  isOpen,
  onClose,
  onInstall,
  isPending = false,
}) => {
  const { t } = useTaurentTranslation('dialogs');
  const { t: tCommon } = useTaurentTranslation('common');
  const [url, setUrl] = useState('');

  const handleClose = () => {
    setUrl('');
    onClose();
  };

  const handleInstall = () => {
    if (url.trim()) {
      onInstall(url.trim());
      setUrl('');
      onClose();
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title={t('pluginInstall.title')}
      description={t('pluginInstall.description')}
      maxWidth="sm"
      footer={
        <DialogActions
          actions={[
            { label: tCommon('actions.cancel'), onClick: handleClose, disabled: isPending },
            { label: tCommon('actions.install'), onClick: handleInstall, variant: 'primary', disabled: !url.trim() || isPending },
          ]}
        />
      }
    >
      <div className="py-2">
        <Input
          value={url}
          onChange={setUrl}
          placeholder={
            // i18n-audit-ignore: protocol URL example is intentionally verbatim
            'https://example.com/plugin.tar.gz'
          }
          autoFocus
        />
      </div>
    </Dialog>
  );
});

PluginInstallDialog.displayName = 'PluginInstallDialog';
