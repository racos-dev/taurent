export type PillTone = 'default' | 'primary' | 'info' | 'success' | 'warning' | 'danger';

export interface PillProps {
  children: React.ReactNode;
  tone?: PillTone;
  icon?: React.ReactNode;
  className?: string;
}
