import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { SimulationProvider } from "./SimulationContext";
import { useAuth } from "./AuthContext";
import AccountPage from "./components/AccountPage";
import Dashboard from "./components/Dashboard";
import DataSetupPage from "./components/DataSetupPage";
import {
  ChevronRight,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  Sliders,
  Truck,
  X,
  Zap,
} from "./components/Icons";
import SettingsPage from "./components/SettingsPage";
import SmartOrderingPage from "./components/SmartOrderingPage";
import Logo from "./components/Logo";
import LoginPage from "./components/auth/LoginPage";
import SignupPage from "./components/auth/SignupPage";
import OnboardingPage from "./components/onboarding/OnboardingPage";
import { AboutPage, MarketingLandingPage } from "./pages";
import { useSimulation } from "./useSimulation";

type NavigationItem = {
  to: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  section: "core" | "system";
};

const navigation: NavigationItem[] = [
  {
    to: "/overview",
    label: "Overview",
    shortLabel: "Overview",
    description: "What needs attention next",
    icon: LayoutDashboard,
    section: "core",
  },
  {
    to: "/ordering",
    label: "Smart Ordering",
    shortLabel: "Ordering",
    description: "Forecast, review, and approve orders",
    icon: Truck,
    section: "core",
  },
  {
    to: "/data-setup",
    label: "Data Setup",
    shortLabel: "Data",
    description: "Improve the digital twin over time",
    icon: Zap,
    section: "system",
  },
  {
    to: "/account",
    label: "Account",
    shortLabel: "Account",
    description: "Profile and security settings",
    icon: Settings,
    section: "system",
  },
  {
    to: "/settings",
    label: "Settings",
    shortLabel: "Settings",
    description: "Data sources, products, and workspace rules",
    icon: Settings,
    section: "system",
  },
];

const pageMeta = Object.fromEntries(
  navigation.map((item) => [item.to, item]),
) as Record<string, NavigationItem>;

function formatDateLabel() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

function CommandPalette({
  open,
  onClose,
  onNavigate,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState("");

  const commandItems = useMemo(() => {
    const actionItems = [
      {
        id: "refresh",
        label: "Refresh workspace data",
        description: "Sync forecasts, orders, and workspace data",
        action: () => onRefresh(),
      },
    ];

    const pageItems = navigation.map((item) => ({
      id: item.to,
      label: item.label,
      description: item.description,
      action: () => onNavigate(item.to),
    }));

    const items = [...pageItems, ...actionItems];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;

    return items.filter((item) =>
      `${item.label} ${item.description}`.toLowerCase().includes(normalized),
    );
  }, [onNavigate, onRefresh, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0d1311]/28 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative mx-auto mt-16 w-11/12 max-w-2xl overflow-hidden rounded-3xl border border-[#dfe6e2] bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-progress-track px-4 py-4">
          <Search className="h-4 w-4 text-[#7e8a85]" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages or run a command"
            className="w-full bg-transparent text-sm text-[#1c2622] outline-none placeholder:text-[#8f9995]"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-[#7e8a85] transition-colors hover:bg-[#f4f6f4] hover:text-[#1c2622]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {commandItems.length === 0 ? (
            <div className="rounded-xl px-4 py-8 text-center text-sm text-[#7e8a85]">
              No matching commands.
            </div>
          ) : (
            commandItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  item.action();
                  onClose();
                }}
                className="flex w-full items-start justify-between rounded-xl px-4 py-3 text-left transition-colors hover:bg-[#f5f7f5]"
              >
                <div>
                  <p className="text-sm font-medium text-[#17211d]">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs text-[#7e8a85]">
                    {item.description}
                  </p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 text-[#a0aaa5]" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function WorkspaceRouteFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-screen-2xl">{children}</div>;
}

function ProtectedAppShell() {
  const { user, logout } = useAuth();
  const { refresh } = useSimulation();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const currentPage =
    pageMeta[location.pathname] ?? pageMeta["/overview"] ?? navigation[0];

  const recentPages = useMemo(
    () =>
      [
        currentPage,
        ...navigation.filter(
          (item) => item.to !== currentPage.to && item.section === "core",
        ),
      ].slice(0, 3),
    [currentPage],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setMobileSidebarOpen(false);
        setLogoutConfirmOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const coreItems = navigation.filter((item) => item.section === "core");
  const systemItems = navigation.filter((item) => item.section === "system");

  return (
    <div className="min-h-screen bg-bg text-heading">
      <CommandPalette
        key={commandOpen ? "command-open" : "command-closed"}
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        onNavigate={(path) => navigate(path)}
        onRefresh={() => void refresh()}
      />

      {logoutConfirmOpen ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-[#0d1311]/28 px-4 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close sign out confirmation"
            className="absolute inset-0"
            onClick={() => setLogoutConfirmOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-3xl border border-[rgba(17,24,21,0.08)] bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#98a09d]">
              Sign out
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#18231f]">
              Do you really want to sign out?
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#66716d]">
              You’ll need to sign in again to return to this workspace.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setLogoutConfirmOpen(false)}
                className="rounded-full border border-[rgba(17,24,21,0.1)] bg-white px-4 py-2.5 text-sm font-medium text-[#18231f]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-full bg-[#17342b] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mobileSidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-[#0d1311]/24 lg:hidden"
        />
      ) : null}

      <div className="min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-[rgba(17,24,21,0.06)] bg-[#f7f8f7] px-3 py-4 transition-transform duration-200 lg:translate-x-0 ${
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } ${sidebarCollapsed ? "lg:w-24" : ""}`}
        >
          <div className="flex items-center justify-between gap-2 px-2">
            <button
              type="button"
              onClick={() => navigate("/overview")}
              className="flex min-w-0 items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                <Logo className="rounded-md object-contain" />
              </div>
              {!sidebarCollapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#18231f]">
                    HVAS
                  </p>
                  <p className="truncate text-xs text-[#7e8a85]">
                    Restaurant workspace
                  </p>
                </div>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => setSidebarCollapsed((current) => !current)}
              className="hidden rounded-full p-2 text-[#7e8a85] transition-colors hover:bg-white hover:text-[#18231f] lg:inline-flex"
            >
              <ChevronRight
                className={`h-4 w-4 transition-transform ${
                  sidebarCollapsed ? "" : "rotate-180"
                }`}
              />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="mt-5 flex items-center gap-3 rounded-xl border border-[rgba(17,24,21,0.06)] bg-white px-3 py-3 text-left shadow-sm transition-colors hover:border-[rgba(17,24,21,0.1)]"
          >
            <Search className="h-4 w-4 shrink-0 text-[#7e8a85]" />
            {!sidebarCollapsed ? (
              <>
                <span className="flex-1 text-sm text-[#6c7672]">
                  Search or jump
                </span>
                <span className="rounded-md border border-[#e5e9e7] px-1.5 py-0.5 text-xs text-[#97a09c]">
                  ⌘K
                </span>
              </>
            ) : null}
          </button>

          <div className="mt-6 space-y-5 overflow-y-auto pb-6">
            <div>
              {!sidebarCollapsed ? (
                <p className="px-3 text-xs font-semibold uppercase tracking-widest text-[#98a09d]">
                  Workspace
                </p>
              ) : null}
              <nav className="mt-2 space-y-1">
                {coreItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all ${
                        isActive
                          ? "bg-white text-[#17211d] shadow-sm"
                          : "text-[#5f6a65] hover:bg-white/75 hover:text-[#17211d]"
                      }`
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed ? (
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.label}</p>
                        <p className="truncate text-xs text-[#8b9590]">
                          {item.description}
                        </p>
                      </div>
                    ) : null}
                  </NavLink>
                ))}
              </nav>
            </div>

            <div>
              {!sidebarCollapsed ? (
                <p className="px-3 text-xs font-semibold uppercase tracking-widest text-[#98a09d]">
                  System
                </p>
              ) : null}
              <nav className="mt-2 space-y-1">
                {systemItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all ${
                        isActive
                          ? "bg-white text-[#17211d] shadow-sm"
                          : "text-[#5f6a65] hover:bg-white/75 hover:text-[#17211d]"
                      }`
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed ? (
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.label}</p>
                      </div>
                    ) : null}
                  </NavLink>
                ))}
              </nav>
            </div>

            {!sidebarCollapsed ? (
              <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#98a09d]">
                  Recent
                </p>
                <div className="mt-3 space-y-2">
                  {recentPages.map((item) => (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => navigate(item.to)}
                      className="flex w-full items-center justify-between rounded-2xl px-2 py-2 text-left transition-colors hover:bg-[#f5f7f5]"
                    >
                      <span className="text-sm text-[#22302a]">
                        {item.label}
                      </span>
                      <ChevronRight className="h-4 w-4 text-[#a0aaa5]" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-auto space-y-2 px-1">
            <button
              type="button"
              onClick={() => setLogoutConfirmOpen(true)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-[#5f6a65] transition-colors hover:bg-white hover:text-[#17211d]"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed ? "Log out" : null}
            </button>
          </div>
        </aside>

        <div
          className={`min-w-0 transition-[padding] duration-200 ${
            sidebarCollapsed ? "lg:pl-24" : "lg:pl-72"
          }`}
        >
          <header className="sticky top-0 z-20 border-b border-[rgba(17,24,21,0.06)] bg-white/80 backdrop-blur-xl">
            <div className="mx-auto flex max-w-screen-2xl items-center gap-4 px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(17,24,21,0.08)] bg-white text-[#51605a] lg:hidden"
              >
                <Sliders className="h-4 w-4" />
              </button>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wider text-[#99a29d]">
                  {formatDateLabel()}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <h1 className="truncate text-2xl font-semibold tracking-tight text-[#18231f] sm:text-3xl">
                    {currentPage.label}
                  </h1>
                  <span className="hidden rounded-full bg-[#eef2ef] px-2.5 py-1 text-xs text-[#6f7b76] md:inline-flex">
                    {currentPage.description}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="hidden min-w-56 items-center justify-between rounded-full border border-[rgba(17,24,21,0.08)] bg-white px-4 py-2.5 text-sm text-[#6d7773] shadow-sm md:flex"
              >
                <span className="inline-flex items-center gap-2">
                  <Search className="h-4 w-4 text-[#8d9792]" />
                  Find anything
                </span>
                <span className="rounded-md border border-[#e5e9e7] px-1.5 py-0.5 text-xs text-[#97a09c]">
                  ⌘K
                </span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(17,24,21,0.08)] bg-white text-[#51605a] transition-colors hover:text-[#18231f]"
                  title="Refresh workspace"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/account")}
                  className="hidden items-center gap-3 rounded-full border border-[rgba(17,24,21,0.08)] bg-white px-2 py-1.5 shadow-sm sm:inline-flex"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ecf2ee] text-sm font-semibold text-[#17342b]">
                    {user?.initials ?? "HV"}
                  </div>
                  <div className="pr-2 text-left">
                    <p className="text-sm font-medium text-[#18231f]">
                      {user?.fullName ?? "HVAS User"}
                    </p>
                    <p className="text-xs text-[#7e8a85]">
                      {user?.companyName ?? "HVAS"}
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </header>

          <main className="px-4 py-5 sm:px-6 lg:px-8">
            <WorkspaceRouteFrame>
              <Routes>
                <Route path="/ordering" element={<SmartOrderingPage />} />
                <Route path="/overview" element={<Dashboard />} />
                <Route
                  path="/inventory"
                  element={<Navigate to="/ordering" replace />}
                />
                <Route path="/data-setup" element={<DataSetupPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route
                  path="/simulation"
                  element={<Navigate to="/overview" replace />}
                />
                <Route
                  path="/purchasing"
                  element={<Navigate to="/ordering" replace />}
                />
                <Route
                  path="/intelligence"
                  element={<Navigate to="/overview" replace />}
                />
                <Route path="*" element={<Navigate to="/overview" replace />} />
              </Routes>
            </WorkspaceRouteFrame>
          </main>
        </div>
      </div>
    </div>
  );
}

function ProtectedApp() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg px-5 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-border bg-white px-5 py-4 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-body">
              Workspace
            </p>
            <p className="mt-2 text-sm font-medium text-heading">
              Restoring your session...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!user.onboardingCompleted && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  if (user.onboardingCompleted && location.pathname === "/onboarding") {
    return <Navigate to="/overview" replace />;
  }

  if (location.pathname === "/onboarding") {
    return <OnboardingPage />;
  }

  return (
    <SimulationProvider>
      <ProtectedAppShell />
    </SimulationProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MarketingLandingPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/onboarding" element={<ProtectedApp />} />
      <Route path="*" element={<ProtectedApp />} />
    </Routes>
  );
}
