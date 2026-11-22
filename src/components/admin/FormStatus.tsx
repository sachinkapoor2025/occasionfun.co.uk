export function FormStatus({
  message,
  tone = "error",
}: {
  message: string | null;
  tone?: "error" | "success";
}) {
  if (!message) return null;
  const className =
    tone === "success"
      ? "mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-success"
      : "mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-error";
  return (
    <p role="alert" className={className}>
      {message}
    </p>
  );
}
