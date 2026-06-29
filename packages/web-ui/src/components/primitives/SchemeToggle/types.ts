export interface SchemeToggleProps {
  /** Current URL scheme */
  scheme: 'http' | 'https';
  /** Called when the user selects a different scheme */
  onChange: (scheme: 'http' | 'https') => void;
  /** Disable both buttons */
  disabled?: boolean;
  /** Optional className for the container */
  className?: string;
}
