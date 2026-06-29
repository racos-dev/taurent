import type { LucideProps } from 'lucide-react';

export function RatioIcon({ size = 20, width, height, className = 'h-5 w-5', ...props }: Omit<LucideProps, 'ref'>) {
  return (
    <svg
      width={width ?? size}
      height={height ?? size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

export function SeedsIcon({ size = 20, width, height, className = 'h-5 w-5', ...props }: Omit<LucideProps, 'ref'>) {
  return (
    <svg
      width={width ?? size}
      height={height ?? size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      {...props}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="M9 12s1.5 2 3 2 3-2 3-2" />
      <path d="M10 9h.01" />
      <path d="M14 9h.01" />
    </svg>
  );
}

export function SortIcon({ size = 20, width, height, className = 'h-5 w-5', ...props }: Omit<LucideProps, 'ref'>) {
  return (
    <svg
      width={width ?? size}
      height={height ?? size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      {...props}
    >
      <path d="M3 6h18" />
      <path d="M7 12h10" />
      <path d="M11 18h2" />
    </svg>
  );
}

export function ArrowUpDownIcon({ size = 20, width, height, className = 'h-5 w-5', ...props }: Omit<LucideProps, 'ref'>) {
  return (
    <svg
      width={width ?? size}
      height={height ?? size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      {...props}
    >
      <path d="M7 3v14" />
      <path d="m3 7 4-4 4 4" />
      <path d="M17 21V7" />
      <path d="m21 17-4 4-4-4" />
    </svg>
  );
}
