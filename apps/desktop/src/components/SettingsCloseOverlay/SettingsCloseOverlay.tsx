import { AlertCircle, ICON_SIZES } from '@taurent/shared';
import { DialogActions } from '@taurent/web-ui';
import { OverlayPrompt } from '../OverlayPrompt';
import { useTaurentTranslation } from '@taurent/shared/i18n';

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
  const { t } = useTaurentTranslation('settings');
  const description = dirtyLabels.length > 0
    ? t('closeOverlay.sections', { sections: dirtyLabels.map((label) => `• ${label}`).join('\n') })
    : t('closeOverlay.generic');

  return (
    <OverlayPrompt
      icon={<AlertCircle size={ICON_SIZES.md} />}
      title={t('closeOverlay.title')}
      description={description}
      error={saveError}
    >
      <DialogActions
        actions={[
          { label: t('closeOverlay.stay'), onClick: onStay, disabled: isSaving },
          { label: t('closeOverlay.discard'), onClick: onDiscard, variant: 'danger', disabled: isSaving },
          {
            label: isSaving ? t('closeOverlay.saving') : t('closeOverlay.save'),
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
