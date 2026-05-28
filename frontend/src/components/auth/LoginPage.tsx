import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { ArrowRight, Lock, Mail } from "../Icons";
import AuthShell from "./AuthShell";

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading && !user) {
    return (
      <AuthShell
        title="Welcome back"
        subtitle="Checking your session so we can restore your workspace."
        footer={<div />}
      >
        <div className="rounded-2xl border border-[#ddd5c9] bg-[#f7f2ea] px-4 py-4 text-sm text-[#6d6258]">
          Restoring your session...
        </div>
      </AuthShell>
    );
  }

  if (!loading && user) {
    const target =
      (location.state as { from?: string } | null)?.from ?? "/overview";
    return <Navigate to={target} replace />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await login({ email, password, rememberMe });
      const target =
        (location.state as { from?: string } | null)?.from ?? "/overview";
      navigate(target, { replace: true });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not sign you in.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to review forecasts, adjust purchasing decisions, and keep operations on track."
      footer={
        <p className="text-center text-sm text-[#6d6258]">
          New to HVAS?{" "}
          <Link to="/signup" className="font-semibold text-[#2d4f42]">
            Create an account
          </Link>
        </p>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-[#2c241c]">
              Work Email
            </label>
          </div>
          <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#d9d0c4] bg-[#f1ebe2] px-4">
            <Mail className="h-4 w-4 text-[#8a7f73]" />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              className="h-full w-full bg-transparent text-sm text-[#241d17] outline-none placeholder:text-[#93877a]"
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-[#2c241c]">
              Password
            </label>
            <button
              type="button"
              onClick={() =>
                alert(
                  "Password reset is not yet available. Please contact your admin.",
                )
              }
              className="text-sm text-[#6d6258] transition-colors hover:text-[#2c241c]"
            >
              Forgot password?
            </button>
          </div>
          <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#d9d0c4] bg-[#f1ebe2] px-4">
            <Lock className="h-4 w-4 text-[#8a7f73]" />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="h-full w-full bg-transparent text-sm text-[#241d17] outline-none placeholder:text-[#93877a]"
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-[#6d6258]">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="h-4 w-4 rounded border border-[#cbbfb2] bg-transparent"
          />
          Remember me for 30 days
        </label>

        {error ? (
          <p className="rounded-2xl border border-[#e2c7c2] bg-[#f8ece9] px-4 py-3 text-sm font-medium text-alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1f3b31] text-sm font-semibold text-[#f6f0e7] transition-opacity disabled:opacity-50"
        >
          Sign In
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </AuthShell>
  );
}
