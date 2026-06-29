import { AlertCircle, ICON_SIZES } from '@taurent/shared';
import { DialogActions } from '@taurent/web-ui';
import { OverlayPrompt } from '../OverlayPrompt';

interface SettingsCloseOverlayProps {
  dirtyLabels: string[];
  isSaving: boolean;
  saveError: string | null;
  onStay: () => void;
  onDiscard: () => void;
  onSave: () => void;
}

/**
 * Overlay prompt shown when closing the settings screen with unsaved changes.
 */
export function SettingsCloseOverlay({
  dirtyLabels,
  isSaving,
  saveError,
  onStay,
  onDiscard,
  onSave,
}: SettingsCloseOverlayProps) {
  const description = dirtyLabels.length > 0
    ? `The following sections have unsaved changes:\n${dirtyLabels.map((l) => `• ${l}`).join('\n')}`
    : 'You have unsaved changes.';

  return (
    <OverlayPrompt
      icon={<AlertCircle size={ICON_SIZES.md} />}
      title="Unsaved Changes"
      description={description}
      error={saveError}
    >
      <DialogActions
        actions={[
          { label: 'Stay', onClick: onStay, disabled: isSaving },
          { label: 'Discard & Close', onClick: onDiscard, variant: 'danger', disabled: isSaving },
          {
            label: isSaving ? 'Saving…' : 'Save & Close',
            onClick: onSave,
            variant: 'primary',
            loading: isSaving,
            disabled: isSaving,
          },
        ]}
      />
    </OverlayPrompt>
  );
}