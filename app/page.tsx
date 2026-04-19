import Link from "next/link";
import { ArrowRight, LockKeyhole, RefreshCw, UploadCloud } from "lucide-react";

const features = [
  {
    title: "Built for secure personal storage",
    body: "Supabase Auth, Storage, and Row Level Security keep every item scoped to its owner."
  },
  {
    title: "Feels like a modern drive app",
    body: "Folders, uploads, recent files, trash recovery, search, previews, and link sharing live in one clean workspace."
  },
  {
    title: "Realtime and deployment ready",
    body: "Live updates stream through Supabase realtime, and the app is structured to deploy cleanly on Vercel."
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-hero-grid bg-hero-grid px-6 py-8 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
          <div>
            <p className="font-[var(--font-display)] text-lg font-semibold tracking-wide">DriveTo</p>
            <p className="text-xs text-slate-400">Your files. Secure. Always within reach.</p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/signin" className="button-secondary">
              Sign in
            </Link>
            <Link href="/dashboard" className="button-primary gap-2">
              Open app
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm text-accent">
              <LockKeyhole className="h-4 w-4" />
              Supabase-first secure storage
            </div>

            <div className="space-y-5">
              <h1 className="max-w-3xl font-[var(--font-display)] text-5xl font-semibold leading-tight sm:text-6xl">
                Personal cloud storage with a polished drive-style workspace.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">
                Upload, organize, preview, edit, share, and recover files in a dark, responsive dashboard built with
                Next.js, Tailwind CSS, and Supabase.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link href="/signin" className="button-primary gap-2">
                Launch DriveTo
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#features" className="button-secondary">
                Explore features
              </a>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="glass-panel p-5">
                <UploadCloud className="mb-4 h-8 w-8 text-accent" />
                <p className="font-semibold">Upload anything</p>
                <p className="mt-2 text-sm text-slate-400">Drag, drop, and manage your personal file library.</p>
              </div>
              <div className="glass-panel p-5">
                <RefreshCw className="mb-4 h-8 w-8 text-signal" />
                <p className="font-semibold">Realtime sync</p>
                <p className="mt-2 text-sm text-slate-400">Live table subscriptions keep the workspace fresh.</p>
              </div>
              <div className="glass-panel p-5">
                <LockKeyhole className="mb-4 h-8 w-8 text-rose-300" />
                <p className="font-semibold">Private by default</p>
                <p className="mt-2 text-sm text-slate-400">RLS keeps every item isolated to its owner.</p>
              </div>
            </div>
          </div>

          <div className="glass-panel relative overflow-hidden p-6 shadow-glow">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-signal/10" />
            <div className="relative space-y-5">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div>
                  <p className="text-sm text-slate-400">Workspace</p>
                  <p className="font-semibold">Drive overview</p>
                </div>
                <div className="rounded-full bg-accent/10 px-3 py-1 text-xs text-accent">Live</div>
              </div>
              <div className="grid gap-4">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="font-semibold">Recent files</p>
                    <p className="text-xs text-slate-400">Updated just now</p>
                  </div>
                  <div className="space-y-3">
                    {["Roadmap.md", "Invoices.csv", "Brand-kit.pdf"].map((item, index) => (
                      <div
                        key={item}
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                      >
                        <div>
                          <p className="font-medium">{item}</p>
                          <p className="text-xs text-slate-400">{index === 0 ? "Text doc" : index === 1 ? "Sheet" : "PDF"}</p>
                        </div>
                        <div className="text-xs text-slate-400">{index + 2} mins ago</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <p className="font-semibold">Share links</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Create view or edit links for any file, then manage them from one panel.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="grid gap-4 lg:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="glass-panel p-6">
              <p className="font-[var(--font-display)] text-xl font-semibold">{feature.title}</p>
              <p className="mt-3 leading-7 text-slate-300">{feature.body}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
