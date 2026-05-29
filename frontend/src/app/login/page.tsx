"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, setToken } from "@/lib/api";

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
      const data = await apiFetch<{ access_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(data.access_token);
      router.push("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-md border border-border bg-white p-6">
        <h1 className="text-xl font-semibold">Sign in to Observa</h1>
        <label className="mt-5 block text-sm font-medium">Email</label>
        <input className="mt-1 w-full rounded-md border border-border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="mt-4 block text-sm font-medium">Password</label>
        <input type="password" className="mt-1 w-full rounded-md border border-border px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="mt-5 w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {loading ? "Signing in..." : "Sign in"}
        </button>
        <p className="mt-4 text-sm text-muted">No account? <Link className="text-brand" href="/register">Register</Link></p>
      </form>
    </main>
  );
}
