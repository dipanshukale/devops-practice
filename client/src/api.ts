export interface Check { at: number; up: boolean; ms: number; status?: number }
export interface Target { id: string; name: string; url: string; checks: Check[] }

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  list: () => req<Target[]>("/api/targets"),
  add: (name: string, url: string) => req<Target>("/api/targets", { method: "POST", body: JSON.stringify({ name, url }) }),
  remove: (id: string) => req<void>(`/api/targets/${id}`, { method: "DELETE" }),
};
