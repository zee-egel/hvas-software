import type { ReactNode } from "react";
import { motion } from "framer-motion";

export default function OptionCard({
  label,
  description,
  selected,
  onClick,
  icon,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      animate={{
        scale: selected ? 1.01 : 1,
        borderColor: selected ? "rgba(23,52,43,0.3)" : "rgba(23,52,43,0.08)",
        backgroundColor: selected ? "rgba(236,244,239,0.92)" : "rgba(255,255,255,0.84)",
      }}
      transition={{ type: "spring", stiffness: 240, damping: 20 }}
      className="rounded-[26px] border px-5 py-5 text-left shadow-[0_8px_24px_rgba(15,23,42,0.03)]"
    >
      <div className="flex items-start gap-3">
        {icon ? (
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-emerald-dark">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-lg font-semibold tracking-[-0.03em] text-heading">
            {label}
          </p>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-body">{description}</p>
          ) : null}
        </div>
      </div>
    </motion.button>
  );
}
