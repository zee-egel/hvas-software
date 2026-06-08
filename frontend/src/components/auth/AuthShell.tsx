import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Logo from "../Logo";
import { ArrowRight } from "../Icons";

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-heading">
      <div className="grid min-h-screen lg:grid-cols-[2fr_3fr]">
        <section className="flex min-h-screen items-center justify-center bg-[#fffdfa] px-6 py-10">
          <div className="w-full max-w-108">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-[#d9e2dd] bg-white px-4 py-2 text-sm font-medium text-emerald-dark transition-colors hover:border-[#cbd7d1] hover:bg-[#f8fbf9]"
            >
              <ArrowRight className="h-4 w-4 rotate-180" />
              Back to website
            </Link>

            <div className="mt-8 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#d9e2dd] bg-white">
                <Logo className="h-12 w-12 object-contain rounded-md" />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-[-0.03em] text-emerald-dark">
                  HVAS
                </p>
                <p className="text-xs tracking-[0.18em] uppercase text-[#7b8782]">
                  Inventory Intelligence
                </p>
              </div>
            </div>

            <div className="mt-10">
              <h2 className="text-[30px] font-semibold tracking-[-0.03em] text-emerald-dark">
                {title}
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-emerald-dark">
                {subtitle}
              </p>
            </div>

            <div className="mt-8">{children}</div>

            <div className="mt-6">{footer}</div>

            <div className="mt-8 border-t border-[#e3ebe6] pt-4 text-center text-xs text-[#7b8782]">
              <p>&copy; 2026 HVAS Systems BV</p>
              <div className="mt-2 flex items-center justify-center gap-5">
                <Link to="/login" className="hover:text-heading">
                  Privacy
                </Link>
                <Link to="/login" className="hover:text-heading">
                  Terms
                </Link>
                <Link to="/login" className="hover:text-heading">
                  Support
                </Link>
              </div>
            </div>
          </div>
        </section>

        <aside
          className="relative hidden overflow-hidden bg-[#123c31] lg:flex lg:min-h-screen lg:flex-col lg:items-center lg:justify-center"
          style={{
            backgroundImage: "url('/login-background.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,28,23,0.38)_0%,rgba(10,28,23,0.54)_52%,rgba(10,28,23,0.74)_100%)]" />
          <div className="absolute inset-0 opacity-12 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)]" />

          <div className="relative z-10 flex w-full flex-col items-center px-12 text-center text-white">
            <div className="aspect-16/10 w-full overflow-hidden rounded-4xl border border-white/15 bg-white/10 shadow-[0_36px_100px_rgba(8,24,19,0.28)] backdrop-blur-[2px]">
              <img
                src="/hvas-dashboard.png"
                alt="HVAS dashboard preview"
                className="h-full w-full object-cover object-center"
              />
            </div>

            <div className="mt-10 max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#b7d1c7]">
                Calm control for purchasing
              </p>
              <h3 className="mt-4 text-[2rem] font-semibold tracking-[-0.03em] text-white">
                Forecast, review, and order with less noise.
              </h3>
              <p className="mt-4 text-sm leading-7 text-[#d1e1da]">
                Built for teams that want cleaner inventory decisions and a more
                focused daily workflow.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
