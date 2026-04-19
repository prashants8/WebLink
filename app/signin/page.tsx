import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SignInPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-hero-grid bg-hero-grid px-6 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-6">
          <p className="inline-flex rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm text-accent">
            Supabase authentication
          </p>
          <h2 className="max-w-2xl font-[var(--font-display)] text-5xl font-semibold leading-tight text-white">
            A secure drive interface for people who want speed, calm, and control.
          </h2>
          <p className="max-w-2xl text-lg leading-8 text-slate-300">
            DriveTo combines auth, storage, live updates, editing, share links, version history, and recovery flows in
            one focused personal workspace.
          </p>
        </div>
        <div className="flex justify-center lg:justify-end">
          <AuthShell />
        </div>
      </div>
    </main>
  );
}
