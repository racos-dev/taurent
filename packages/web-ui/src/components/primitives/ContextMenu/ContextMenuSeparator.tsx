interface ContextMenuSeparatorProps {
  /** Optional label rendered in uppercase small-caps above the separator. */
  label?: string;
}

/**
 * Separator line. When `label` is provided, renders an uppercase label row.
 * Otherwise renders a thin horizontal rule.
 */
export function ContextMenuSeparator({ label }: ContextMenuSeparatorProps) {
  if (label) {
    return (
      <div className="px-2 pt-2 pb-0">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      </div>
    );
  }

  return <div className="border-t border-border my-1" />;
}
