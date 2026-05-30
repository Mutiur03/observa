"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify(form),
      });
      router.push("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-border bg-surface/95 p-6 shadow-[0_16px_48px_rgba(17,17,17,0.06)] backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Observa</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Create account</h1>
        <p className="mt-2 text-sm text-muted">Start with a clean dashboard and a shared team workspace.</p>
        <input className="mt-6 w-full rounded-2xl border border-border bg-surface px-3 py-2 outline-none transition-colors focus:border-brand" placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <input className="mt-3 w-full rounded-2xl border border-border bg-surface px-3 py-2 outline-none transition-colors focus:border-brand" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input type="password" className="mt-3 w-full rounded-2xl border border-border bg-surface px-3 py-2 outline-none transition-colors focus:border-brand" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <button className="mt-5 w-full rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong">Register</button>
        <p className="mt-4 text-sm text-muted">Have account? <Link className="font-medium text-ink underline decoration-border underline-offset-4" href="/login">Sign in</Link></p>
      </form>
    </main>
  );
}
