import { motion } from "framer-motion";

export default function ProgressIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  const progress = Math.max(0, Math.min(100, (currentStep / totalSteps) * 100));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-body">
        <span>Progress</span>
        <span>
          {currentStep}/{totalSteps}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#e7ece8]">
        <motion.div
          className="h-full rounded-full bg-emerald-dark"
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}
