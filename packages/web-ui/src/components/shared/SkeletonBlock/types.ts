export type SkeletonBlockRadius = 'none' | 'sm' | 'md' | 'lg' | 'full';

export interface SkeletonBlockProps {
  width?: string | number;
  height?: string | number;
  radius?: SkeletonBlockRadius;
  /** Background class. Defaults to 'bg-surface'. */
  background?: string;
  className?: string;
}
