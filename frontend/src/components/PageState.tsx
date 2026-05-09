import Skeleton from "./Skeleton";

export function LoadingState({
  title = "Loading data...",
}: {
  title?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-body">
        Loading
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-heading">{title}</h2>
      <div className="mt-4 max-w-2xl">
        <Skeleton className="h-4 w-full max-w-xl" />
        <Skeleton className="mt-2 h-4 w-4/5 max-w-lg" />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-md border border-border bg-[#fbfcfb] p-4"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-4 h-8 w-28" />
            <Skeleton className="mt-4 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-3/4" />
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-md border border-border bg-[#fbfcfb] p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-5 h-52 w-full rounded-md" />
        </div>
        <div className="rounded-md border border-border bg-[#fbfcfb] p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-5 h-5 w-20" />
          <Skeleton className="mt-5 h-20 w-full rounded-md" />
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}

export function ErrorState({
  title = "Could not load page data.",
  message,
  onRetry,
}: {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[#ffd8d5] bg-white p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-alert">
        Error
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-heading">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-body">
        {message ?? "The frontend did not receive the required API payload."}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-xl bg-emerald-dark px-4 py-2.5 text-sm font-semibold text-white"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-body">
        Empty
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-heading">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-body">{message}</p>
    </div>
  );
}
