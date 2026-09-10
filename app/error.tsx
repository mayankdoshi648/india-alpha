"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-foreground">
      <p className="text-lg font-medium">The desk failed to start.</p>
      <p className="max-w-md text-center text-sm text-muted-foreground">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-sky-400 px-3 py-2 text-sm font-medium text-slate-950"
      >
        Try again
      </button>
    </div>
  );
}
