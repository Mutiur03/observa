"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-border bg-surface/95 p-6 shadow-[0_16px_48px_rgba(17,17,17,0.06)] backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Observa</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-muted">Minimal observability workspace for product teams.</p>
        <label className="mt-6 block text-sm font-medium">Email</label>
        <input className="mt-1 w-full rounded-2xl border border-border bg-surface px-3 py-2 outline-none ring-0 transition-colors focus:border-brand" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="mt-4 block text-sm font-medium">Password</label>
        <input type="password" className="mt-1 w-full rounded-2xl border border-border bg-surface px-3 py-2 outline-none ring-0 transition-colors focus:border-brand" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <button disabled={loading} className="mt-5 w-full rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-60">
          {loading ? "Signing in..." : "Sign in"}
        </button>
        <p className="mt-4 text-sm text-muted">No account? <Link className="font-medium text-ink underline decoration-border underline-offset-4" href="/register">Register</Link></p>
      </form>
    </main>
  );
}
