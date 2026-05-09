import { Play, Square } from "./Icons";

interface ModelSelectorProps {
  currentModel: string;
  onModelChange: (model: string) => void;
  onStart: () => void;
  onStop: () => void;
  running: boolean;
}

const MODELS = [
  { value: "sk_sarima", label: "SK-SARIMA" },
  { value: "holt_winters", label: "Holt-Winters" },
  { value: "auto_sarima", label: "Auto-SARIMA" },
];

export default function ModelSelector({
  currentModel,
  onModelChange,
  onStart,
  onStop,
  running,
}: ModelSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <select
        value={currentModel}
        onChange={(e) => onModelChange(e.target.value)}
        className="bg-card border border-border/15 rounded-md px-4 py-2.5 text-sm text-heading font-medium focus:outline-none focus:ring-2 focus:ring-emerald/30"
      >
        {MODELS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      {running ? (
        <button
          onClick={onStop}
          className="inline-flex items-center gap-2 bg-linear-to-r from-alert to-red-700 text-white px-5 py-2.5 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Square className="w-4 h-4" />
          Stop Simulation
        </button>
      ) : (
        <button
          onClick={onStart}
          className="inline-flex items-center gap-2 bg-linear-to-r from-emerald to-emerald-dark text-white px-5 py-2.5 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Play className="w-4 h-4" />
          Start Simulation
        </button>
      )}
    </div>
  );
}
