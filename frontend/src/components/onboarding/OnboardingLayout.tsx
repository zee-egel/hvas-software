import type { ReactNode } from "react";
import { motion } from "framer-motion";
import Logo from "../Logo";
import ProgressIndicator from "./ProgressIndicator";

export default function OnboardingLayout({
  step,
  totalSteps,
  canGoBack,
  onBack,
  children,
}: {
  step: number;
  totalSteps: number;
  canGoBack: boolean;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fbfcf8]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(121,171,146,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(23,52,43,0.1),transparent_26%),linear-gradient(180deg,#fbfcf8_0%,#f5f7f2_100%)]" />
      <div className="absolute left-[6%] top-[12%] h-56 w-56 rounded-full bg-[#d8e9df] opacity-60 blur-3xl" />
      <div className="absolute bottom-[10%] right-[10%] h-72 w-72 rounded-full bg-[#edf5ef] opacity-90 blur-3xl" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-[rgba(23,52,43,0.08)] bg-white shadow-[0_6px_16px_rgba(15,23,42,0.05)]">
              <Logo className="rounded-md object-contain" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[-0.02em] text-heading">
                HVAS
              </p>
              <p className="text-xs uppercase tracking-[0.18em] text-body">
                Workspace setup
              </p>
            </div>
          </div>

          <div className="w-full max-w-xs">
            <ProgressIndicator currentStep={step} totalSteps={totalSteps} />
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-6 pb-10 pt-4 sm:px-8 lg:px-12">
          <motion.div
            layout
            className="w-full max-w-4xl rounded-[36px] border border-[rgba(23,52,43,0.08)] bg-[rgba(255,255,255,0.8)] px-6 py-6 shadow-[0_30px_120px_rgba(18,39,32,0.09)] backdrop-blur-xl sm:px-8 sm:py-8 lg:px-10 lg:py-10"
          >
            {children}
          </motion.div>
        </main>

        {canGoBack ? (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 hidden -translate-y-1/2 justify-between px-6 lg:flex">
            <button
              type="button"
              onClick={onBack}
              className="pointer-events-auto rounded-full border border-[rgba(23,52,43,0.1)] bg-white/90 px-4 py-2 text-sm font-medium text-heading shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur"
            >
              Back
            </button>
            <div />
          </div>
        ) : null}
      </div>
    </div>
  );
}
