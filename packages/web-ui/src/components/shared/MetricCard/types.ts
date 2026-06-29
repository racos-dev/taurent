export type MetricCardTone = 'neutral' | 'success' | 'warning' | 'error';

export interface MetricCardProps {
  label: string;
  value: string;
  /** Optional secondary value / context line. */
  subValue?: string;
  tone?: MetricCardTone;
  className?: string;
}
