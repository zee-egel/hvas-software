import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { ArrowRight, Fingerprint, Lock, Mail } from "../Icons";
import { LoadingState } from "../PageState";
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
      <div className="min-h-screen bg-bg px-5 py-10">
        <div className="mx-auto max-w-4xl">
          <LoadingState title="Checking your session..." />
        </div>
      </div>
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
      subtitle="Please enter your details to access your dashboard."
      footer={
        <>
          <div className="flex items-center gap-4 text-sm text-body">
            <div className="h-px flex-1 bg-border" />
            <span>Or continue with</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => alert("Google sign-in is not yet available.")}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-white text-sm font-medium text-heading"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0f172a] text-xs font-semibold text-white">
                G
              </span>
              Google
            </button>
            <button
              onClick={() => alert("SSO is not yet available.")}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-white text-sm font-medium text-heading"
            >
              <Fingerprint className="h-4 w-4 text-subtitle" />
              SSO
            </button>
          </div>
          <p className="mt-4 text-center text-sm text-body">
            New to HVAS?{" "}
            <Link to="/signup" className="font-semibold text-emerald-dark">
              Create an account
            </Link>
          </p>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-semibold text-heading">
              Work Email
            </label>
          </div>
          <div className="flex h-11 items-center gap-3 rounded-xl border border-border bg-[#fbfcfb] px-4">
            <Mail className="h-4 w-4 text-body" />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              className="h-full w-full bg-transparent text-sm text-heading outline-none placeholder:text-[#8a958f]"
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-semibold text-heading">
              Password
            </label>
            <button
              type="button"
              onClick={() =>
                alert(
                  "Password reset is not yet available. Please contact your admin.",
                )
              }
              className="text-sm font-semibold text-emerald-dark"
            >
              Forgot password?
            </button>
          </div>
          <div className="flex h-11 items-center gap-3 rounded-xl border border-border bg-[#fbfcfb] px-4">
            <Lock className="h-4 w-4 text-body" />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="h-full w-full bg-transparent text-sm text-heading outline-none placeholder:text-[#8a958f]"
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-body">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="h-4 w-4 rounded border border-border"
          />
          Remember me for 30 days
        </label>

        {error ? (
          <p className="text-sm font-medium text-alert">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-dark text-sm font-semibold text-white disabled:opacity-50"
        >
          Sign In
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </AuthShell>
  );
}
