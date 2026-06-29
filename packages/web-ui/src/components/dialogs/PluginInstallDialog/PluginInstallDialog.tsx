import React, { useState } from 'react';
import { Dialog } from '../Dialog';
import { DialogActions } from '../DialogActions';
import { Input } from '../../primitives/Input';
import type { PluginInstallDialogProps } from './types';

export const PluginInstallDialog = React.memo<PluginInstallDialogProps>(({
  isOpen,
  onClose,
  onInstall,
  isPending = false,
}) => {
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
      title="Install Search Plugin"
      description="Enter a plugin source URL or path"
      maxWidth="sm"
      footer={
        <DialogActions
          actions={[
            { label: 'Cancel', onClick: handleClose, disabled: isPending },
            { label: 'Install', onClick: handleInstall, variant: 'primary', disabled: !url.trim() || isPending },
          ]}
        />
      }
    >
      <div className="py-2">
        <Input
          value={url}
          onChange={setUrl}
          placeholder="https://example.com/plugin.tar.gz"
          autoFocus
        />
      </div>
    </Dialog>
  );
});

PluginInstallDialog.displayName = 'PluginInstallDialog';