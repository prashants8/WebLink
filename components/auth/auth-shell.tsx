"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const supabase = createSupabaseBrowserClient();

export function AuthShell() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const action =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });

    const { data, error: authError } = await action;

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setMessage("Check your inbox to confirm the account, then sign in.");
    setLoading(false);
  }

  return (
    <div className="glass-panel w-full max-w-md p-8 shadow-glow">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Secure storage</p>
        <h1 className="mt-3 font-[var(--font-display)] text-4xl font-semibold">Enter DriveTo</h1>
        <p className="mt-3 text-sm leading-7 text-slate-400">
          Sign in to access your files, folders, shares, previews, trash, and live sync workspace.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1">
        <button
          type="button"
          className={mode === "signin" ? "rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold" : "button-ghost"}
          onClick={() => setMode("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={mode === "signup" ? "rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold" : "button-ghost"}
          onClick={() => setMode("signup")}
        >
          Sign up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm text-slate-300">Email</label>
          <input
            className="field"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm text-slate-300">Password</label>
          <input
            className="field"
            type="password"
            required
            minLength={6}
            placeholder="Minimum 6 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error ? (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">{message}</div>
        ) : null}

        <button type="submit" className="button-primary w-full gap-2" disabled={loading}>
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-400">
        Need the product overview?{" "}
        <Link href="/" className="text-accent transition hover:text-sky-300">
          Back to the landing page
        </Link>
      </p>
    </div>
  );
}
