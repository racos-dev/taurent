export interface SettingsRowProps {
  title: string;
  description?: string;
  value?: string | React.ReactNode;
  onPress?: () => void;
  right?: React.ReactNode;
  disabled?: boolean;
  /** Visual tone for the row label and hover state. */
  tone?: 'default' | 'danger';
}
