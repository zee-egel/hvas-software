import { Link } from "react-router-dom";
import Logo from "../components/Logo";
import {
  ArrowRight,
  Check,
  Search,
  TrendingUp,
  Zap,
} from "../components/Icons";

const values = [
  {
    title: "Operational clarity",
    body: "We reduce scattered stock decisions into a smaller set of actions teams can trust before supplier cut-off times.",
    icon: Search,
  },
  {
    title: "Practical intelligence",
    body: "Forecasting only matters if it improves the actual order. We build from that constraint instead of chasing abstract analytics.",
    icon: TrendingUp,
  },
  {
    title: "Hospitality empathy",
    body: "Restaurants run on timing, pressure, and imperfect information. The product has to respect that reality.",
    icon: Zap,
  },
];

const team = [
  {
    name: "Reinout Meijer",
    role: "Software Engineer, co-founder",
    initials: "RM",
    bio: "Leads product and engineering with a background in restaurant operations, data science, and distributed systems.",
    accent: "from-[#dbe9e1] via-[#f6f2e8] to-[#e8efe9]",
  },
  {
    name: "Rouven van Ommen",
    role: "Product Designer, co-founder",
    initials: "RO",
    bio: "Focuses on the product's operating surface and visual language with a background in hospitality design and brand identity.",
    accent: "from-[#e6efe8] via-[#f8f7f2] to-[#d7e5dd]",
  },
  {
    name: "Feline Kramer",
    role: "Product strategist, co-founder",
    initials: "FK",
    bio: "Shapes the product's strategic direction and market fit with a background in restaurant consulting, operations, and customer experience.",
    accent: "from-[#f0eadf] via-[#f8f6f1] to-[#dfe9e4]",
  },
  {
    name: "Senna Meijer",
    role: "Client Aquisition Lead, co-founder",
    initials: "SM",
    bio: "Drives client acquisition and relationship management with a background in hospitality sales and customer success.",
    accent: "from-[#e8efe9] via-[#f6f2e8] to-[#dbe9e1]",
  },
];

const milestones = [
  "Started from a simple observation: restaurants still make critical ordering decisions across spreadsheets, inboxes, and chat threads.",
  "Built the first product flow around shortage detection, waste visibility, and supplier-order timing instead of generic inventory reporting.",
  "Now shaping HVAS into a clearer operating surface for hospitality teams that need better inventory decisions without more system weight.",
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
      className={`inline-flex items-center gap-2 rounded-full bg-emerald-dark px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(23,52,43,0.18)] transition-transform hover:-translate-y-0.5 ${className}`}
    >
      {children}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#fbfaf7] text-heading">
      <div className="absolute inset-x-0 top-0 -z-10 h-144 bg-[radial-gradient(circle_at_top,rgba(217,235,227,0.92),rgba(251,250,247,0)_58%)]" />
      <div className="absolute right-0 top-28 -z-10 h-112 w-md rounded-full bg-[#e7efe3]/80 blur-3xl" />

      <header className="sticky top-0 z-40 border-b border-[rgba(23,52,43,0.08)] bg-[#fbfaf7]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(23,52,43,0.08)] bg-white shadow-sm">
              <Logo className="h-12 w-12 rounded-md object-contain" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[-0.02em] text-emerald-dark">
                HVAS
              </p>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#71807a]">
                Inventory intelligence
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            <Link
              to="/"
              className="text-sm font-medium text-[#5f6a65] transition-colors hover:text-emerald-dark"
            >
              Home
            </Link>
            <a
              href="#mission"
              className="text-sm font-medium text-[#5f6a65] transition-colors hover:text-emerald-dark"
            >
              Mission
            </a>
            <a
              href="#team"
              className="text-sm font-medium text-[#5f6a65] transition-colors hover:text-emerald-dark"
            >
              Team
            </a>
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <Link
              to="/login"
              className="rounded-full px-4 py-2.5 text-sm font-medium text-emerald-dark transition-colors hover:bg-white"
            >
              Log in
            </Link>
            <PrimaryLink to="/signup">Start with HVAS</PrimaryLink>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-5 pb-14 pt-14 sm:px-6 lg:px-8 lg:pb-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(23,52,43,0.08)] bg-white/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5f6a65] shadow-sm">
                <Check className="h-3.5 w-3.5 text-emerald" />
                Mission and team
              </div>
              <h1 className="mt-6 max-w-3xl text-[2.9rem] font-semibold leading-[0.95] tracking-[-0.06em] text-emerald-dark sm:text-[4.4rem]">
                Building calmer inventory decisions for restaurant teams.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5e6a65]">
                HVAS exists to make ordering less reactive. We are focused on
                the messy middle between stock data, supplier cadence, and the
                pressure of daily hospitality operations.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <PrimaryLink to="/signup">Work with us</PrimaryLink>
                <Link
                  to="/"
                  className="inline-flex items-center justify-center rounded-full border border-[rgba(23,52,43,0.12)] bg-white px-5 py-3 text-sm font-semibold text-emerald-dark shadow-sm transition-transform hover:-translate-y-0.5"
                >
                  Back to landing page
                </Link>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-4xl border border-[rgba(23,52,43,0.08)] bg-emerald-dark p-4 shadow-[0_40px_100px_rgba(18,40,33,0.16)]">
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0))]" />
              <div className="relative grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
                <img
                  src="/login-background.png"
                  alt="HVAS team and product atmosphere"
                  className="h-full min-h-80 w-full rounded-3xl object-cover"
                />
                <div className="grid gap-4">
                  <div className="rounded-3xl border border-white/10 bg-white/10 p-5 text-white backdrop-blur-sm">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#c5d9d1]">
                      What we care about
                    </p>
                    <p className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
                      Better ordering without more mental overhead.
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/10 p-5 text-sm leading-7 text-[#d4e2dc] backdrop-blur-sm">
                    We want hospitality teams to spend less energy assembling
                    the truth and more energy acting on it.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="mission"
          className="border-y border-[rgba(23,52,43,0.08)] bg-white/72"
        >
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#809089]">
                  Mission
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-emerald-dark sm:text-4xl">
                  Inventory software should reduce uncertainty, not add another
                  layer to it.
                </h2>
              </div>
              <div className="space-y-5 text-base leading-8 text-[#61706a]">
                <p>
                  Our mission is to help restaurant operators make stronger
                  purchasing decisions with less noise. That means fewer hidden
                  shortage risks, less over-ordering, and a clearer view of what
                  actually needs attention.
                </p>
                <p>
                  We are building HVAS around the real sequence of work:
                  understand demand, review risk, prepare the next order, and do
                  it all fast enough to fit inside a normal operating day.
                </p>
              </div>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {values.map((value) => (
                <article
                  key={value.title}
                  className="rounded-[1.75rem] border border-[rgba(23,52,43,0.08)] bg-[#fbfaf7] p-6 shadow-[0_18px_40px_rgba(18,40,33,0.05)]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e9f2ed] text-emerald-dark">
                    <value.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-emerald-dark">
                    {value.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[#61706a]">
                    {value.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8 lg:py-22">
          <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-4xl bg-emerald-dark p-8 text-white shadow-[0_28px_80px_rgba(18,40,33,0.16)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#aecdbe]">
                Our story
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
                Built from the friction around daily ordering.
              </h2>
              <div className="mt-6 space-y-4">
                {milestones.map((milestone, index) => (
                  <div
                    key={milestone}
                    className="rounded-[1.35rem] border border-white/10 bg-white/8 px-4 py-4"
                  >
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[#aecdbe]">
                      Step {index + 1}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-[#eef4f1]">
                      {milestone}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-4xl border border-[rgba(23,52,43,0.08)] bg-white p-4 shadow-[0_22px_70px_rgba(18,40,33,0.08)]">
              <img
                src="/hvas-dashboard.png"
                alt="HVAS product interface"
                className="h-full w-full rounded-3xl object-cover"
              />
            </div>
          </div>
        </section>

        <section
          id="team"
          className="border-y border-[rgba(23,52,43,0.08)] bg-[#f5f6f2]"
        >
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#809089]">
                Team
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-emerald-dark sm:text-4xl">
                A small team focused on restaurant operations and product
                discipline.
              </h2>
              <p className="mt-4 text-base leading-7 text-[#61706a]">
                Typical team section for now, with portrait-style cards that can
                be swapped to real headshots whenever those assets are ready.
              </p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {team.map((member) => (
                <article
                  key={member.name}
                  className="overflow-hidden rounded-[1.75rem] border border-[rgba(23,52,43,0.08)] bg-white shadow-[0_16px_40px_rgba(18,40,33,0.05)]"
                >
                  <div
                    className={`flex h-72 items-end bg-linear-to-br ${member.accent} p-6`}
                  >
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/70 bg-white/80 text-2xl font-semibold tracking-[-0.04em] text-emerald-dark shadow-sm backdrop-blur-sm">
                      {member.initials}
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-xl font-semibold tracking-[-0.03em] text-emerald-dark">
                      {member.name}
                    </p>
                    <p className="mt-2 text-sm font-medium text-emerald-dark">
                      {member.role}
                    </p>
                    <p className="mt-4 text-sm leading-7 text-[#61706a]">
                      {member.bio}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-20 pt-16 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-[2.25rem] bg-emerald-dark px-6 py-10 text-white shadow-[0_30px_90px_rgba(18,40,33,0.18)] sm:px-10 lg:px-14">
            <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#aecdbe]">
                  Work with us
                </p>
                <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                  Use this page as the company-story layer around the product
                  landing page.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[#d4e2dc]">
                  It gives you a place for mission, team, culture, and broader
                  brand trust signals without overloading the main homepage.
                </p>
              </div>
              <PrimaryLink to="/signup" className="justify-center">
                Create your workspace
              </PrimaryLink>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
