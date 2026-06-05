import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Minus,
  Package,
  Plus,
  Search,
  TrendingUp,
  Truck,
  X,
  Zap,
} from "../components/Icons";

const navigation = [
  { label: "Platform", href: "#platform" },
  { label: "Workflow", href: "#workflow" },
  { label: "FAQs", href: "#faqs" },
];

const signals = [
  "Dutch hospitality workflow",
  "Stockout and waste visibility",
  "Forecasts tied to real ordering",
];

const metrics = [
  {
    label: "Focus every morning",
    value: "1 clear queue",
    detail: "See what needs action before the next order window.",
  },
  {
    label: "Ordering rhythm",
    value: "Daily or weekly",
    detail:
      "Fits restaurants that buy fresh often and cannot afford guesswork.",
  },
  {
    label: "Data inputs",
    value: "Invoices to forecasts",
    detail: "Bring products, history, and current stock into one calmer flow.",
  },
];

const features = [
  {
    title: "A calmer purchasing view",
    body: "HVAS turns noisy inventory inputs into one operating surface for shortage risk, waste exposure, and upcoming orders.",
    icon: Search,
  },
  {
    title: "Forecasts that stay practical",
    body: "Demand signals are translated into order decisions, not buried in dashboards that still leave teams guessing.",
    icon: TrendingUp,
  },
  {
    title: "Built around restaurant reality",
    body: "Supplier cadence, prep pressure, local demand context, and product volatility all shape the daily recommendation flow.",
    icon: Truck,
  },
];

const steps = [
  {
    eyebrow: "1. Establish the base",
    title: "Import products, invoices, and stock context.",
    body: "Start with the purchasing history you already have. HVAS builds the product base and identifies where forecasts can become reliable fastest.",
    icon: Package,
  },
  {
    eyebrow: "2. Surface the right actions",
    title: "See what will run low, what may overstock, and what to order next.",
    body: "The system prioritizes risk and highlights the next order decisions so teams do not waste time scanning spreadsheets or WhatsApp threads.",
    icon: AlertTriangle,
  },
  {
    eyebrow: "3. Order with more confidence",
    title: "Review draft orders before service pressure hits.",
    body: "HVAS keeps the final decision with the team while giving a cleaner recommendation window and better reasoning behind it.",
    icon: Check,
  },
];

const faqs = [
  {
    question: "Who is HVAS designed for?",
    answer:
      "HVAS fits restaurant operators and purchasing teams that need tighter control over fresh inventory without adding another heavy system to the day.",
  },
  {
    question: "What does it cost?",
    answer: "WIP",
  },
  {
    question: "How do I get started?",
    answer:
      "Create an account, then follow the onboarding flow to connect your first data source. We recommend starting with recent supplier invoices for the fastest path to useful forecasts.",
  },
];

function PrimaryLink({
  to,
  children,
  className = "",
}: {
  to: string;
  children: string;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 rounded-full bg-[#17342b] px-5 py-3 text-sm font-semibold shadow-[0_18px_40px_rgba(23,52,43,0.18)] transition-transform hover:-translate-y-0.5 ${className}`}
    >
      {children}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

export default function MarketingLandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#fbfaf7] text-[#17211d]">
      <div className="absolute inset-x-0 top-0 -z-10 h-[40rem] bg-[radial-gradient(circle_at_top,rgba(217,235,227,0.95),rgba(251,250,247,0)_58%)]" />
      <div className="absolute inset-x-0 top-24 -z-10 h-[32rem] bg-[radial-gradient(circle_at_right,rgba(117,183,157,0.18),rgba(251,250,247,0)_45%)]" />

      <header className="sticky top-0 z-40 border-b border-[rgba(23,52,43,0.08)] bg-[#fbfaf7]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(23,52,43,0.08)] bg-white shadow-sm">
              <Logo className="h-12 w-12 object-contain rounded-md" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[-0.02em] text-[#17342b]">
                HVAS
              </p>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#71807a]">
                Inventory intelligence
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-[#5f6a65] transition-colors hover:text-[#17342b]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <Link
              to="/login"
              className="rounded-full px-4 py-2.5 text-sm font-medium text-[#17342b] transition-colors hover:bg-white"
            >
              Log in
            </Link>
            <PrimaryLink className="text-white" to="/signup">
              Start with HVAS
            </PrimaryLink>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(23,52,43,0.1)] bg-white text-[#17342b] lg:hidden"
            aria-label="Open navigation"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </header>

      <Dialog
        open={mobileMenuOpen}
        onClose={setMobileMenuOpen}
        className="relative z-50 lg:hidden"
      >
        <DialogBackdrop className="fixed inset-0 bg-[#0d1311]/36 backdrop-blur-sm" />
        <div className="fixed inset-0 flex justify-end">
          <DialogPanel className="flex h-full w-full max-w-sm flex-col bg-[#fbfaf7] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[rgba(23,52,43,0.08)] bg-white">
                  <Logo className="h-9 w-9 object-contain" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#17342b]">HVAS</p>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[#71807a]">
                    Inventory intelligence
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(23,52,43,0.1)] bg-white text-[#17342b]"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-10 space-y-3">
              {navigation.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-2xl bg-white px-4 py-4 text-base font-medium text-[#17342b] shadow-sm"
                >
                  {item.label}
                </a>
              ))}
            </div>

            <div className="mt-auto space-y-3">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-full border border-[rgba(23,52,43,0.12)] px-4 py-3 text-center text-sm font-medium text-[#17342b]"
              >
                Log in
              </Link>
              <PrimaryLink to="/signup" className="w-full justify-center">
                Start with HVAS
              </PrimaryLink>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      <main>
        <section className="mx-auto max-w-7xl px-5 pb-18 pt-14 sm:px-6 lg:px-8 lg:pb-24 lg:pt-18">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(23,52,43,0.08)] bg-white/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5f6a65] shadow-sm">
                <Zap className="h-3.5 w-3.5 text-[#4f8a73]" />
                Built for focused restaurant ordering
              </div>

              <h1 className="mt-6 max-w-3xl text-[2.9rem] font-semibold leading-[0.95] tracking-[-0.06em] text-[#17342b] sm:text-[4.4rem]">
                Smarter inventory decisions without the spreadsheet fog.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5e6a65]">
                HVAS helps hospitality teams forecast demand, spot waste risk,
                and prepare better orders from one calm interface that fits the
                current product design.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <PrimaryLink className="text-white" to="/signup">
                  Create your workspace
                </PrimaryLink>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(23,52,43,0.12)] bg-white px-5 py-3 text-sm font-semibold text-[#17342b] shadow-sm transition-transform hover:-translate-y-0.5"
                >
                  View the product
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                {signals.map((signal) => (
                  <div
                    key={signal}
                    className="inline-flex items-center gap-2 rounded-full bg-[#eef4f1] px-3 py-2 text-sm text-[#26463b]"
                  >
                    <Check className="h-4 w-4 text-[#4f8a73]" />
                    {signal}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-8 top-10 hidden h-28 w-28 rounded-full bg-[#cfe5da] blur-3xl lg:block" />
              <div className="absolute -right-6 bottom-12 hidden h-36 w-36 rounded-full bg-[#e7efe3] blur-3xl lg:block" />

              <div className="relative overflow-hidden rounded-[2rem] border border-[rgba(23,52,43,0.08)] bg-[#17342b] p-4 shadow-[0_40px_100px_rgba(18,40,33,0.18)]">
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0))]" />
                <div className="relative rounded-[1.5rem] border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
                  <img
                    src="/hvas-dashboard.png"
                    alt="HVAS dashboard preview"
                    className="w-full rounded-[1.2rem] border border-white/12 object-cover shadow-[0_24px_60px_rgba(7,20,16,0.24)]"
                  />
                </div>

                <div className="relative mt-4 grid gap-3 sm:grid-cols-3">
                  {metrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-[1.35rem] border border-white/10 bg-white/10 px-4 py-4 text-white backdrop-blur-sm"
                    >
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#c5d9d1]">
                        {metric.label}
                      </p>
                      <p className="mt-2 text-xl font-semibold tracking-[-0.03em]">
                        {metric.value}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#d4e2dc]">
                        {metric.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="platform"
          className="border-y border-[rgba(23,52,43,0.08)] bg-white/70"
        >
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#809089]">
                Why the flow works
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#17342b] sm:text-4xl">
                The page moves in the same order operators think.
              </h2>
              <p className="mt-4 text-base leading-7 text-[#61706a]">
                First establish trust, then show the product, explain the
                workflow, answer objections, and end with a clean call to
                action. That keeps the story aligned with how HVAS already feels
                inside the app.
              </p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="rounded-[1.75rem] border border-[rgba(23,52,43,0.08)] bg-[#fbfaf7] p-6 shadow-[0_18px_40px_rgba(18,40,33,0.05)]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e9f2ed] text-[#17342b]">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-[#17342b]">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[#61706a]">
                    {feature.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8 lg:py-22">
          <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-[2rem] bg-[#17342b] p-8 text-white shadow-[0_28px_80px_rgba(18,40,33,0.16)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#aecdbe]">
                Product posture
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
                Calm on the outside, operationally sharp underneath.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#d4e2dc]">
                The landing page should not feel louder than the app. This
                version keeps the same rounded geometry, layered neutrals, and
                emerald depth while making the marketing narrative more
                deliberate.
              </p>
              <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/8 p-5">
                <div className="flex items-center justify-between rounded-[1.2rem] bg-white/95 px-4 py-3 text-[#17342b]">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#809089]">
                      Shortage signal
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      Tomatoes and salmon need review before the next supplier
                      cut-off.
                    </p>
                  </div>
                  <div className="rounded-full bg-[#eef4f1] px-3 py-1 text-xs font-semibold">
                    Next action
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.2rem] bg-white/8 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[#aecdbe]">
                      Waste watch
                    </p>
                    <p className="mt-2 text-sm text-[#eef4f1]">
                      See where over-ordering may happen before margin
                      disappears.
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] bg-white/8 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[#aecdbe]">
                      Draft orders
                    </p>
                    <p className="mt-2 text-sm text-[#eef4f1]">
                      Review supplier-ready drafts instead of building them from
                      scratch.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-[rgba(23,52,43,0.08)] bg-white p-4 shadow-[0_22px_70px_rgba(18,40,33,0.08)]">
              <img
                src="/hvas-dashboard.png"
                alt="HVAS forecasting and ordering interface"
                className="h-full w-full rounded-[1.5rem] object-cover"
              />
            </div>
          </div>
        </section>

        <section
          id="workflow"
          className="border-y border-[rgba(23,52,43,0.08)] bg-[#f5f6f2]"
        >
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#809089]">
                Workflow
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#17342b] sm:text-4xl">
                A landing page order that matches the product journey.
              </h2>
              <p className="mt-4 text-base leading-7 text-[#61706a]">
                The sections move from promise to proof to process. That gives
                visitors the same sense of structure the application tries to
                create for purchasing teams.
              </p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {steps.map((step) => (
                <article
                  key={step.title}
                  className="rounded-[1.75rem] border border-[rgba(23,52,43,0.08)] bg-white p-6 shadow-[0_16px_40px_rgba(18,40,33,0.05)]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef4f1] text-[#17342b]">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#809089]">
                    {step.eyebrow}
                  </p>
                  <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[#17342b]">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[#61706a]">
                    {step.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="faqs"
          className="mx-auto max-w-4xl px-5 py-16 sm:px-6 lg:px-8 lg:py-22"
        >
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#809089]">
              FAQs
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#17342b] sm:text-4xl">
              Frequently asked questions
            </h2>
          </div>

          <div className="mt-10 space-y-4">
            {faqs.map((item) => (
              <Disclosure key={item.question} as="div">
                {({ open }) => (
                  <div className="rounded-[1.5rem] border border-[rgba(23,52,43,0.08)] bg-white px-5 py-2 shadow-[0_10px_30px_rgba(18,40,33,0.04)]">
                    <DisclosureButton className="flex w-full items-center justify-between gap-4 py-4 text-left">
                      <span className="text-base font-semibold text-[#17342b]">
                        {item.question}
                      </span>
                      {open ? (
                        <Minus className="h-4 w-4 shrink-0 text-[#5f6a65]" />
                      ) : (
                        <Plus className="h-4 w-4 shrink-0 text-[#5f6a65]" />
                      )}
                    </DisclosureButton>
                    <DisclosurePanel className="pb-4 text-sm leading-7 text-[#61706a]">
                      {item.answer}
                    </DisclosurePanel>
                  </div>
                )}
              </Disclosure>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-[2.25rem] bg-[#17342b] px-6 py-10 text-white shadow-[0_30px_90px_rgba(18,40,33,0.18)] sm:px-10 lg:px-14">
            <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#aecdbe]">
                  Start here
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                  The landing page is in place. Supporting pages can follow the
                  same system.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[#d4e2dc]">
                  This first page establishes the visual direction, the section
                  order, and the interaction model. Next pages should inherit
                  the same spacing, card language, and conversion rhythm.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <PrimaryLink
                  to="/signup"
                  className="justify-center bg-white text-emerald-dark shadow-none"
                >
                  Start with HVAS
                </PrimaryLink>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-full border border-white/18 px-5 py-3 text-sm font-semibold text-white"
                >
                  Log in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
