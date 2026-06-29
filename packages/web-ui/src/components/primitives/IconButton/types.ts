export type IconButtonTone = 'default' | 'primary' | 'danger';

export type IconButtonVariant = 'surface' | 'ghost' | 'outline';

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  title: string;
  children: React.ReactNode;
  isActive?: boolean;
  loading?: boolean;
  tone?: IconButtonTone;
  variant?: IconButtonVariant;
}
