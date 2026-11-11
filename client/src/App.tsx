import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type Target } from "./api";

function Trace({ target }: { target: Target }) {
  const max = Math.max(200, ...target.checks.map((c) => c.ms));
  return (
    <div className="trace" role="img" aria-label={`Last ${target.checks.length} checks`}>
      {target.checks.map((c) => (
        <i key={c.at} className={c.up ? "up" : "down"} style={{ height: `${Math.max(8, (c.ms / max) * 100)}%` }} title={`${c.ms} ms`} />
      ))}
    </div>
  );
}

export default function App() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("https://");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => api.list().then(setTargets).catch((e: Error) => setError(e.message)), []);
  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, [refresh]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await api.add(name, url); setName(""); setUrl("https://"); await refresh(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  const down = targets.filter((t) => t.checks.at(-1)?.up === false).length;

  return (
    <main>
      <header>
        <h1>Pulsewatch</h1>
        <p className={down ? "summary bad" : "summary good"}>
          {targets.length === 0 ? "Nothing watched yet." : down ? `${down} of ${targets.length} services are down.` : `All ${targets.length} services are up.`}
        </p>
      </header>

      <form onSubmit={onAdd}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Payments API" required maxLength={40} aria-label="Name" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/health" required type="url" aria-label="URL" />
        <button disabled={busy}>{busy ? "Checking…" : "Watch service"}</button>
      </form>
      {error && <p role="alert" className="error">{error}</p>}

      <ul>
        {targets.map((t) => {
          const last = t.checks.at(-1);
          return (
            <li key={t.id}>
              <span className={`dot ${last ? (last.up ? "up" : "down") : ""}`} />
              <div className="meta">
                <strong>{t.name}</strong>
                <small>{t.url}</small>
              </div>
              <Trace target={t} />
              <span className="ms">{last ? `${last.ms} ms` : "…"}</span>
              <button className="ghost" onClick={() => api.remove(t.id).then(refresh)} aria-label={`Stop watching ${t.name}`}>Remove</button>
            </li>
          );
        })}
      </ul>
      {targets.length === 0 && <p className="empty">Add a URL above to start tracking its uptime and response time.</p>}
    </main>
  );
}
