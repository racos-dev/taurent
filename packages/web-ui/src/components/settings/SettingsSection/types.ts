export interface SettingsSectionProps {
  title: string;
  /** Uncontrolled: initial expand state. Ignored when `expanded` is provided. */
  defaultExpanded?: boolean;
  /** Controlled: external expand state. Must be paired with `onToggle`. */
  expanded?: boolean;
  /** Controlled: callback when the header is clicked. Required when `expanded` is provided. */
  onToggle?: () => void;
  /** Optional icon rendered to the left of the title. */
  icon?: React.ReactNode;
  /** Optional summary text shown below the title or beside it. */
  summary?: string;
  children: React.ReactNode;
}
