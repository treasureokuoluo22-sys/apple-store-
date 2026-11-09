"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) {
          setErrorMessage(
            error.code === "signup_disabled" ||
              error.code === "email_provider_disabled"
              ? "New admin account signup is disabled in Supabase. Enable email signups in Authentication settings, then try again."
              : error.message
          );
          return;
        }

        if (data.session) {
          router.replace("/admin");
          router.refresh();
          return;
        }

        setMode("signin");
        setSuccessMessage(
          "Account created. Check your email to confirm the account, then sign in."
        );
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(
          "Sign-in failed. Check your email and password, then try again."
        );
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setErrorMessage(
        "Unable to sign in right now. Check your connection and try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-5 py-12 text-[#1d1d1f]">
      <section className="w-full max-w-md rounded-3xl border border-black/5 bg-white p-8 shadow-sm sm:p-10">
        <div className="mb-8 mt-2">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Store management
          </p>

          <h1 className="text-3xl font-semibold tracking-tight">
            {mode === "signin" ? "Admin sign in" : "Create admin account"}
          </h1>

          <p className="mt-3 text-sm leading-6 text-neutral-600">
            Sign in or create an account to manage your own products and
            checkout links.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium"
            >
              Email address
            </label>

            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none transition focus:border-neutral-800 focus:ring-2 focus:ring-neutral-200"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium"
            >
              Password
            </label>

            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 pr-16 outline-none transition focus:border-neutral-800 focus:ring-2 focus:ring-neutral-200"
                placeholder={
                  mode === "signup"
                    ? "At least 8 characters"
                    : "Enter your password"
                }
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-controls="password"
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-800"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {errorMessage}
            </p>
          )}

          {successMessage && (
            <p
              role="status"
              className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800"
            >
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-[#1d1d1f] px-4 py-3 font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading
              ? mode === "signin"
                ? "Signing in..."
                : "Creating account..."
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode((currentMode) =>
              currentMode === "signin" ? "signup" : "signin"
            );
            setErrorMessage("");
            setSuccessMessage("");
          }}
          className="mt-6 w-full text-center text-sm font-medium text-blue-700 hover:underline"
        >
          {mode === "signin"
            ? "Create a new admin account"
            : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}