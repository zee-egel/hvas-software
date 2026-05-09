import type { TodayAction } from "../../api/client";
import { euro } from "./utils";

export default function TodaysActions({
  actions,
}: {
  actions: TodayAction[];
}) {
  return (
    <section className="rounded-3xl border border-border/10 bg-card p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-dark">
        Today&apos;s actions
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-heading">
        Dit heeft nu de meeste impact
      </h2>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {actions.map((action) => (
          <article
            key={action.id}
            className="rounded-3xl border border-border bg-bg p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-medium text-subtitle">
                {action.status}
              </span>
              <span className="text-sm font-medium text-heading">
                {euro(action.impact)}
              </span>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-heading">
              {action.title}
            </h3>
            <p className="mt-2 text-sm text-subtitle">{action.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
