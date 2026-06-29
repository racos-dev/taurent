export type TestConnectionFeedbackState = 'idle' | 'testing' | 'success' | 'error';

export interface TestConnectionFeedbackProps {
  /** Current test state */
  state: TestConnectionFeedbackState;
  /** Error message to display when state is 'error' */
  errorMessage?: string | null;
  /** Actionable suggestion to display when state is 'error' */
  suggestion?: string | null;
  /** Optional className for the container */
  className?: string;
}
