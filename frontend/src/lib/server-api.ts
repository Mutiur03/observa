import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_BASE_URL =
  process.env.SERVER_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

export async function serverApiFetch<T>(
  path: string,
  init: RequestInit & { next?: { revalidate?: number } } = {},
): Promise<T> {
  const cookieStore = await cookies();
  const headers = new Headers(init.headers);
  headers.set("Cookie", cookieStore.toString());
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    next: init.next ?? { revalidate: 5 },
  });

  if (response.status === 401) redirect("/login");
  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const body = JSON.parse(text) as { detail?: unknown };
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // Keep the raw response text for non-JSON backend errors.
    }
    throw new Error(message || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}
