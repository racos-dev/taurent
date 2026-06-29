export interface PluginInstallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: (sourceUrl: string) => void;
  isPending?: boolean;
}