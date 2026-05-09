import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import Logo from "./components/Logo";
import {
  BarChart3,
  Bell,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  Truck,
  Zap,
} from "./components/Icons";
import Dashboard from "./components/Dashboard";
import IntelligencePage from "./components/IntelligencePage";
import LiveSimulationPage from "./components/LiveSimulationPage";
import PurchasingPage from "./components/PurchasingPage";
import SettingsPage from "./components/SettingsPage";

const navigation = [
  { to: "/overview", label: "Executive Summary", icon: LayoutDashboard },
  { to: "/simulation", label: "Live Simulation", icon: Zap },
  { to: "/purchasing", label: "Purchasing", icon: Truck },
  { to: "/intelligence", label: "Intelligence", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

function AppShell() {
  return (
    <div className="min-h-screen bg-[#fbfcfb] text-heading">
      <div className="grid min-h-screen grid-cols-[160px_1fr]">
        <aside className="flex min-h-screen flex-col border-r border-border bg-white">
          <div className="flex items-center gap-3 px-4 py-5">
            <Logo className="h-10 w-10 rounded-lg object-contain" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-heading">HVAS</p>
              <p className="text-[11px] text-body">Operational Excellence</p>
            </div>
          </div>

          <nav className="mt-4 flex flex-1 flex-col gap-1 px-3">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-sm px-3 py-3 text-[13px] font-medium transition-colors ${
                    isActive
                      ? "bg-emerald-dark text-white"
                      : "text-subtitle hover:bg-[#f4f7f5] hover:text-heading"
                  }`
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="px-3 pb-4">
            <button className="w-full rounded-sm bg-emerald-dark px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(13,90,67,0.18)] transition-opacity hover:opacity-90">
              Create Purchase Order
            </button>
            <div className="mt-5 border-t border-border pt-4">
              <button className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-[13px] text-subtitle transition-colors hover:bg-[#f4f7f5] hover:text-heading">
                <LifeBuoy className="h-4 w-4" />
                Help Center
              </button>
              <button className="mt-1 flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-[13px] text-subtitle transition-colors hover:bg-[#fff5f4] hover:text-alert">
                <LogOut className="h-4 w-4" />
                Log Out
              </button>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-white px-5">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
              <input
                type="search"
                placeholder="Search operations, orders, or stock..."
                className="h-10 w-full rounded-full border border-border bg-[#fbfcfb] pl-9 pr-4 text-sm text-heading outline-none transition-colors focus:border-[#bad7cd]"
              />
            </div>

            <div className="ml-6 flex items-center gap-4">
              <button className="rounded-full p-2 text-subtitle transition-colors hover:bg-[#f4f7f5] hover:text-heading">
                <Bell className="h-4 w-4" />
              </button>
              <button className="rounded-full p-2 text-subtitle transition-colors hover:bg-[#f4f7f5] hover:text-heading">
                <RefreshCw className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-3 border-l border-border pl-4">
                <div className="h-9 w-9 rounded-full bg-[#d7fff1] text-center text-sm font-semibold leading-9 text-emerald-dark">
                  CM
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-heading">
                    Chef Marcus
                  </p>
                  <p className="text-[11px] text-body">Central Kitchen</p>
                </div>
              </div>
            </div>
          </header>

          <main className="px-5 py-6">
            <div className="mx-auto max-w-310">
              <Routes>
                <Route path="/overview" element={<Dashboard />} />
                <Route path="/simulation" element={<LiveSimulationPage />} />
                <Route path="/purchasing" element={<PurchasingPage />} />
                <Route path="/intelligence" element={<IntelligencePage />} />
                <Route
                  path="/inventory"
                  element={<Navigate to="/intelligence" replace />}
                />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/overview" replace />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return <AppShell />;
}
