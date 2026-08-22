import { Upload } from '@taurent/shared';
import { cn } from '@taurent/shared';
import { useTaurentTranslation } from '@taurent/shared/i18n';

interface DragDropOverlayProps {
  isVisible: boolean;
  onClose?: () => void;
}

export function DragDropOverlay({ isVisible, onClose }: DragDropOverlayProps) {
  const { t } = useTaurentTranslation('desktop');
  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        'bg-primary/20 backdrop-blur-sm',
        'animate-in fade-in duration-200'
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-surface border-2 border-dashed border-primary rounded-md',
          'px-8 py-6 text-center shadow-lg',
          'animate-in zoom-in-95 duration-200'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-primary-20 flex items-center justify-center">
          <Upload className="w-5 h-5 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">
          {t('dragDrop.title')}
        </h3>
        <p className="text-xs text-text-secondary">
          {t('dragDrop.description')}
        </p>
      </div>
    </div>
  );
}
