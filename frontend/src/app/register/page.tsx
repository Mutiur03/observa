"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, setToken } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const data = await apiFetch<{ access_token: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setToken(data.access_token);
      router.push("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-md border border-border bg-white p-6">
        <h1 className="text-xl font-semibold">Create account</h1>
        <input className="mt-5 w-full rounded-md border border-border px-3 py-2" placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <input className="mt-3 w-full rounded-md border border-border px-3 py-2" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input type="password" className="mt-3 w-full rounded-md border border-border px-3 py-2" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button className="mt-5 w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white">Register</button>
        <p className="mt-4 text-sm text-muted">Have account? <Link className="text-brand" href="/login">Sign in</Link></p>
      </form>
    </main>
  );
}
