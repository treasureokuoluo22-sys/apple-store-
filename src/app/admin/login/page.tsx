"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
          setErrorMessage(error.message);
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
        <Link
          href="/"
          className="text-sm text-[#06c] hover:underline"
        >
          ← Back to store
        </Link>

        <div className="mb-8 mt-8">
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

            <input
              id="password"
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none transition focus:border-neutral-800 focus:ring-2 focus:ring-neutral-200"
              placeholder={
                mode === "signup"
                  ? "At least 8 characters"
                  : "Enter your password"
              }
            />
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