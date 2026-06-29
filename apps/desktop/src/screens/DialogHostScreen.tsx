import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  cancelDialogHostIdleClose,
  scheduleDialogHostIdleClose,
} from '../windows/dialogs/dialogHostWindow';
import { DESKTOP_DIALOGS, DIALOG_HOST_KINDS, type DialogHostKind } from '../windows/dialogs/registry';

export function DialogHostScreen() {
  const [searchParams] = useSearchParams();
  const dialogParam = searchParams.get('dialog');
  const openId = searchParams.get('openId') ?? 'prebake';

  const dialog = (dialogParam && DIALOG_HOST_KINDS.includes(dialogParam as DialogHostKind))
    ? (dialogParam as DialogHostKind)
    : null;

  useEffect(() => {
    if (dialog) {
      cancelDialogHostIdleClose();
      return;
    }
    scheduleDialogHostIdleClose();
  }, [dialog, openId]);

  if (!dialog) return null;

  const key = `${dialog}:${openId}`;
  const Screen = DESKTOP_DIALOGS[dialog]?.Screen;

  if (!Screen) return null;

  return <Screen key={key} />;
}
