import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { ArrowRight, Building, Lock, Mail, User } from "../Icons";
import { LoadingState } from "../PageState";
import AuthShell from "./AuthShell";

export default function SignupPage() {
  const { user, signup, loading } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [agreed, setAgreed] = useState(false);
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
    return <Navigate to="/overview" replace />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!agreed) {
      setError("Please accept the terms to create your account.");
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await signup({ fullName, companyName, email, password, rememberMe });
      navigate("/overview", { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not create account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create account"
      subtitle="Set up your workspace to manage forecasting, inventory, and purchasing in one place."
      footer={
        <p className="text-center text-sm text-body">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-emerald-dark">
            Sign in
          </Link>
        </p>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-heading">
            Full Name
          </label>
          <div className="flex h-11 items-center gap-3 rounded-xl border border-border bg-[#fbfcfb] px-4">
            <User className="h-4 w-4 text-body" />
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Alex Chef"
              className="h-full w-full bg-transparent text-sm text-heading outline-none placeholder:text-[#8a958f]"
              autoComplete="name"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-heading">
            Company
          </label>
          <div className="flex h-11 items-center gap-3 rounded-xl border border-border bg-[#fbfcfb] px-4">
            <Building className="h-4 w-4 text-body" />
            <input
              type="text"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="HVAS Kitchens"
              className="h-full w-full bg-transparent text-sm text-heading outline-none placeholder:text-[#8a958f]"
              autoComplete="organization"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-heading">
            Work Email
          </label>
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

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-heading">
              Password
            </label>
            <div className="flex h-11 items-center gap-3 rounded-xl border border-border bg-[#fbfcfb] px-4">
              <Lock className="h-4 w-4 text-body" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="h-full w-full bg-transparent text-sm text-heading outline-none placeholder:text-[#8a958f]"
                autoComplete="new-password"
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-heading">
              Confirm Password
            </label>
            <div className="flex h-11 items-center gap-3 rounded-xl border border-border bg-[#fbfcfb] px-4">
              <Lock className="h-4 w-4 text-body" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="••••••••"
                className="h-full w-full bg-transparent text-sm text-heading outline-none placeholder:text-[#8a958f]"
                autoComplete="new-password"
                required
              />
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-body">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="h-4 w-4 rounded border border-border"
          />
          Keep me signed in on this device
        </label>

        <label className="flex items-start gap-2 text-sm leading-5 text-body">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border border-border"
          />
          I agree to the terms, privacy policy, and responsible data processing requirements.
        </label>

        {error ? <p className="text-sm font-medium text-alert">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-dark text-sm font-semibold text-white disabled:opacity-50"
        >
          Create Account
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </AuthShell>
  );
}
