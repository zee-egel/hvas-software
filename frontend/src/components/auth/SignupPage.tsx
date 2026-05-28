import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { ArrowRight, Building, Lock, Mail, User } from "../Icons";
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
      <AuthShell
        title="Create account"
        subtitle="Checking your session so we can route you correctly."
        footer={<div />}
      >
        <div className="rounded-2xl border border-[#ddd5c9] bg-[#f7f2ea] px-4 py-4 text-sm text-[#6d6258]">
          Restoring your session...
        </div>
      </AuthShell>
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
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not create account.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create account"
      subtitle="Create your workspace to manage forecasting, inventory, and purchasing from one calm control layer."
      footer={
        <p className="text-center text-sm text-[#6d6258]">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-[#2d4f42]">
            Sign in
          </Link>
        </p>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-sm font-medium text-[#2c241c]">
            Full Name
          </label>
          <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#d9d0c4] bg-[#f1ebe2] px-4">
            <User className="h-4 w-4 text-[#8a7f73]" />
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Alex Chef"
              className="h-full w-full bg-transparent text-sm text-[#241d17] outline-none placeholder:text-[#93877a]"
              autoComplete="name"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[#2c241c]">
            Company
          </label>
          <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#d9d0c4] bg-[#f1ebe2] px-4">
            <Building className="h-4 w-4 text-[#8a7f73]" />
            <input
              type="text"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="HVAS Kitchens"
              className="h-full w-full bg-transparent text-sm text-[#241d17] outline-none placeholder:text-[#93877a]"
              autoComplete="organization"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[#2c241c]">
            Work Email
          </label>
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

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-[#2c241c]">
              Password
            </label>
            <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#d9d0c4] bg-[#f1ebe2] px-4">
              <Lock className="h-4 w-4 text-[#8a7f73]" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="h-full w-full bg-transparent text-sm text-[#241d17] outline-none placeholder:text-[#93877a]"
                autoComplete="new-password"
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[#2c241c]">
              Confirm Password
            </label>
            <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#d9d0c4] bg-[#f1ebe2] px-4">
              <Lock className="h-4 w-4 text-[#8a7f73]" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="••••••••"
                className="h-full w-full bg-transparent text-sm text-[#241d17] outline-none placeholder:text-[#93877a]"
                autoComplete="new-password"
                required
              />
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 pt-1 text-sm text-[#6d6258]">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="h-4 w-4 rounded border border-[#cbbfb2] bg-transparent"
          />
          Keep me signed in on this device
        </label>

        <label className="flex items-start gap-2 text-sm leading-5 text-[#6d6258]">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border border-[#cbbfb2] bg-transparent"
          />
          I agree to the terms, privacy policy, and responsible data processing
          requirements.
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
          Create Account
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </AuthShell>
  );
}
