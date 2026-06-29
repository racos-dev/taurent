import { Icon } from '@taurent/shared';
import { formatUserMessage } from '@taurent/shared/utils/error';

export interface MutationErrorBannerProps {
  error: string | Error | null;
}

export function MutationErrorBanner({ error }: MutationErrorBannerProps) {
  if (!error) return null;
  const message = formatUserMessage(error);
  return (
    <div className="flex items-start gap-2 rounded-sm bg-error/10 px-3 py-2">
      <Icon name="alert" className="h-4 w-4 shrink-0 text-error" />
      <p className="text-xs text-error">{message}</p>
    </div>
  );
}
