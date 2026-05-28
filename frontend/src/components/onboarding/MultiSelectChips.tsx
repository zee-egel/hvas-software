import { motion } from "framer-motion";
import { Plus, X } from "../Icons";

export default function MultiSelectChips({
  label,
  values,
  suggested,
  inputValue,
  inputPlaceholder,
  onInputChange,
  onAddCustom,
  onToggleValue,
  onRemoveValue,
}: {
  label: string;
  values: string[];
  suggested: string[];
  inputValue: string;
  inputPlaceholder: string;
  onInputChange: (value: string) => void;
  onAddCustom: () => void;
  onToggleValue: (value: string) => void;
  onRemoveValue: (value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-[26px] border border-[rgba(23,52,43,0.08)] bg-white/85 p-5">
        <p className="text-sm font-medium text-heading">{label}</p>
        <div className="mt-4 flex gap-3">
          <input
            type="text"
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAddCustom();
              }
            }}
            placeholder={inputPlaceholder}
            className="h-12 flex-1 rounded-2xl border border-border bg-[#fafbf8] px-4 text-sm text-heading outline-none transition focus:border-[#8ca894]"
          />
          <button
            type="button"
            onClick={onAddCustom}
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-emerald-dark px-4 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        {values.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {values.map((value) => (
              <motion.button
                key={value}
                type="button"
                layout
                onClick={() => onRemoveValue(value)}
                className="inline-flex items-center gap-2 rounded-full bg-[#edf4ef] px-3 py-2 text-sm font-medium text-heading"
              >
                {value}
                <X className="h-3.5 w-3.5 text-body" />
              </motion.button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        {suggested.map((value) => {
          const selected = values.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => onToggleValue(value)}
              className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
                selected
                  ? "bg-[#17342b] text-white shadow-[0_10px_24px_rgba(23,52,43,0.18)]"
                  : "border border-[rgba(23,52,43,0.08)] bg-white/88 text-heading hover:bg-[#f5f7f3]"
              }`}
            >
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}
