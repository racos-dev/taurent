export interface Step {
  label: string;
  /** Whether this step is currently active */
  active: boolean;
  /** Whether this step has been completed */
  completed: boolean;
}

export interface StepIndicatorProps {
  steps: Step[];
  /** Optional className for the container */
  className?: string;
}