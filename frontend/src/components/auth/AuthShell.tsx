import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Logo from "../Logo";

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
    <div className="min-h-screen bg-[#031d19] px-4 py-6 text-heading">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_12%,rgba(111,243,206,0.85),transparent_32%),radial-gradient(circle_at_8%_94%,rgba(198,220,121,0.72),transparent_28%),linear-gradient(140deg,#02100e_18%,#04372c_58%,#0b5d48_100%)]" />
      <div className="relative flex min-h-[calc(100vh-3rem)] items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border border-white/25 bg-white px-6 py-7 shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-white shadow-[0_6px_16px_rgba(17,38,31,0.08)]">
              <Logo className="h-10 w-10 object-contain" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-[-0.02em] text-emerald-darkest">
                HVAS
              </p>
              <p className="text-xs text-body">Operational Excellence</p>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-[26px] font-semibold tracking-[-0.02em] text-heading">
              {title}
            </h2>
            <p className="mt-1 text-sm text-body">{subtitle}</p>
          </div>

          <div className="mt-6">{children}</div>

          <div className="mt-5">{footer}</div>

          <div className="mt-6 border-t border-border pt-4 text-center text-xs text-body">
            <p>&copy; 2026 HVAS Systems Inc.</p>
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
      </div>
    </div>
  );
}
