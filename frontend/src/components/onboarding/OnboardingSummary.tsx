import type { OnboardingData } from "../../api/client";

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] bg-[#f6f8f5] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-body">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-heading">{value}</p>
    </div>
  );
}

export default function OnboardingSummary({
  data,
}: {
  data: OnboardingData;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SummaryRow
        label="Restaurant type"
        value={data.restaurantType ?? "Not specified"}
      />
      <SummaryRow
        label="Ordering frequency"
        value={data.orderingFrequency ?? "Not specified"}
      />
      <SummaryRow
        label="Selected products"
        value={
          data.initialProducts.length > 0
            ? data.initialProducts.slice(0, 4).join(", ")
            : "Add products later"
        }
      />
      <SummaryRow
        label="Forecasting signals"
        value={data.forecastingSignals.slice(0, 4).join(", ")}
      />
      <div className="rounded-[22px] bg-[#17342b] px-4 py-5 text-white md:col-span-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b8d0c6]">
          First goal
        </p>
        <p className="mt-2 text-lg font-semibold">
          {data.primaryGoal ?? "Understand demand"}
        </p>
      </div>
    </div>
  );
}
