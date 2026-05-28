import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function OnboardingStep({
  stepKey,
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  stepKey: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.section
        key={stepKey}
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.99 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="mx-auto flex min-h-[32rem] max-w-3xl flex-col justify-between"
      >
        <div>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-dark">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-3 max-w-2xl text-[2.2rem] font-semibold tracking-[-0.05em] text-heading sm:text-[2.8rem]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-4 max-w-2xl text-base leading-8 text-body sm:text-lg">
              {subtitle}
            </p>
          ) : null}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.24 }}
          className="mt-10"
        >
          {children}
        </motion.div>

        {footer ? <div className="mt-10">{footer}</div> : null}
      </motion.section>
    </AnimatePresence>
  );
}
