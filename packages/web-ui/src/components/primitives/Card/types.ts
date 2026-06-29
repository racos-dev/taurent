export type CardVariant = 'elevated' | 'outline' | 'flat';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface CardBaseProps {
  variant?: CardVariant;
  padding?: CardPadding;
  radius?: CardRadius;
}

export interface CardWebProps extends CardBaseProps {
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}

export interface CardNativeProps extends CardBaseProps {
  onPress?: () => void;
  className?: string;
  children: React.ReactNode;
}
