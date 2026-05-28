import { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import { Lock, Mail, User } from "./Icons";

export default function AccountPage() {
  const { user, updateAccount } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [companyName, setCompanyName] = useState(user?.companyName ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(user?.fullName ?? "");
    setCompanyName(user?.companyName ?? "");
  }, [user?.fullName, user?.companyName]);

  async function handleSaveProfile() {
    try {
      setSavingProfile(true);
      setError(null);
      setMessage(null);
      await updateAccount({
        fullName,
        companyName,
      });
      setMessage("Account details updated.");
    } catch (saveError) {
      console.error("Failed to update account details", saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not update account details.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSavePassword() {
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    try {
      setSavingPassword(true);
      setError(null);
      setMessage(null);
      await updateAccount({
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated.");
    } catch (saveError) {
      console.error("Failed to update password", saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not update password.",
      );
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-border bg-white px-6 py-6 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#f4f6f3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-subtitle">
            <User className="h-3.5 w-3.5" />
            Account
          </div>
          <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.03em] text-heading">
            Manage your account
          </h1>
          <p className="mt-2 text-sm leading-6 text-body">
            Update the basics for your workspace owner account and keep your sign-in details current.
          </p>
        </div>

        {message ? (
          <p className="mt-4 rounded-2xl border border-[#cce9df] bg-[#f4fbf8] px-4 py-3 text-sm text-heading">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-2xl border border-[#ffd8d5] bg-[#fff9f8] px-4 py-3 text-sm text-alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <section className="rounded-[24px] border border-border bg-white p-5">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-emerald-dark" />
            <p className="text-base font-semibold text-heading">Profile details</p>
          </div>

          <div className="mt-5 grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-heading">
                Full name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="h-12 w-full rounded-2xl border border-border bg-[#fafbf8] px-4 text-sm text-heading outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-heading">
                Company name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="h-12 w-full rounded-2xl border border-border bg-[#fafbf8] px-4 text-sm text-heading outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-heading">
                Email
              </label>
              <div className="flex h-12 items-center gap-3 rounded-2xl border border-border bg-[#f5f7f3] px-4 text-sm text-body">
                <Mail className="h-4 w-4 text-body" />
                <span>{user?.email}</span>
              </div>
              <p className="mt-2 text-xs text-body">
                Email changes are not supported yet.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleSaveProfile()}
                disabled={savingProfile}
                className="rounded-xl bg-emerald-dark px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingProfile ? "Saving..." : "Save profile"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-border bg-white p-5">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-emerald-dark" />
            <p className="text-base font-semibold text-heading">Security</p>
          </div>

          <div className="mt-5 grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-heading">
                Current password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="h-12 w-full rounded-2xl border border-border bg-[#fafbf8] px-4 text-sm text-heading outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-heading">
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="h-12 w-full rounded-2xl border border-border bg-[#fafbf8] px-4 text-sm text-heading outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-heading">
                Confirm new password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-12 w-full rounded-2xl border border-border bg-[#fafbf8] px-4 text-sm text-heading outline-none"
              />
            </div>

            <div className="rounded-2xl bg-[#f6f8f5] px-4 py-4 text-sm text-body">
              Passwords must contain at least 8 characters.
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleSavePassword()}
                disabled={savingPassword || !currentPassword || !newPassword}
                className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-heading disabled:opacity-50"
              >
                {savingPassword ? "Saving..." : "Update password"}
              </button>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
