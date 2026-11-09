export function ReviewWarning({
  children = "Draft content for legal and company review. Do not treat as final approved policy.",
}: {
  children?: string;
}) {
  return (
    <aside
      role="note"
      className="mb-8 rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning-text)]"
    >
      <strong className="font-semibold">Review required: </strong>
      {children}
    </aside>
  );
}
