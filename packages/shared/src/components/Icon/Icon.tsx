import { useMemo } from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import {
  iconMap,
  CUSTOM_ICONS,
  isCustomIcon,
  type AppIconName,
} from '../../icons/iconMap';
import { ICON_SIZES, type IconSize } from '../../icons/sizes';

export { type AppIconName } from '../../icons/iconMap';

interface IconProps extends Omit<LucideProps, 'ref'> {
  name: AppIconName;
  size?: number;
  iconSize?: IconSize;
  strokeWidth?: number;
  className?: string;
}

export function Icon({ name, size, iconSize, strokeWidth = 2, className = '', ...props }: IconProps) {
  const resolvedSize = iconSize != null ? ICON_SIZES[iconSize] : size ?? 20;

  const IconComponent = useMemo(() => {
    const icon = iconMap[name];
    if (isCustomIcon(icon)) {
      return CUSTOM_ICONS[icon] as LucideIcon;
    }
    return icon;
  }, [name]) as LucideIcon;

  return (
    <IconComponent
      size={resolvedSize}
      strokeWidth={strokeWidth}
      className={className}
      {...props}
    />
  );
}
