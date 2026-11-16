import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { api, type Target } from "./api";
import { ActivityList } from "./components/ActivityList";
import { Ecg, PulseMark } from "./components/Brand";
import { Composer } from "./components/Composer";
import { Insights } from "./components/Insights";
import { ServiceCard } from "./components/ServiceCard";
import { BoardSkeleton, Notice, Steps } from "./components/States";
import { boardHeadline, boardHealth, boardStats, humanError } from "./lib/stats";

type Filter = "all" | "up" | "down";
type SortKey = "attention" | "name" | "latency";
type Phase = "loading" | "ready" | "error";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "up", label: "Up" },
  { id: "down", label: "Down" },
];

function statusRank(target: Target): number {
  const last = target.checks.at(-1);
  if (!last) return 1;
  return last.up ? 2 : 0;
}

export default function App() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("attention");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const refreshGen = useRef(0);
  const pendingRemove = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const gen = ++refreshGen.current;
    setRefreshing(true);
    try {
      const data = await api.list();
      if (gen !== refreshGen.current) return;
      setTargets(data.filter((target) => !pendingRemove.current.has(target.id)));
      setLoadError(null);
      setPhase("ready");
      setLastSync(Date.now());
    } catch (err) {
      if (gen !== refreshGen.current) return;
      setLoadError(humanError((err as Error).message));
      setPhase((current) => (current === "loading" ? "error" : "ready"));
    } finally {
      if (gen === refreshGen.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setPendingId(null);
        return;
      }
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const node = event.target;
      if (node instanceof HTMLElement && node.closest("input, textarea, select")) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!freshId) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(`service-${freshId}`)?.scrollIntoView({
      block: "nearest",
      behavior: reduce ? "auto" : "smooth",
    });
    const timer = setTimeout(() => setFreshId(null), 1800);
    return () => clearTimeout(timer);
  }, [freshId]);

  const stats = useMemo(() => boardStats(targets), [targets]);
  const health = boardHealth(stats);
  const headline = boardHeadline(stats);
  const showComposer = targets.length === 0 || composerOpen;

  const queried = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return targets;
    return targets.filter((target) => target.name.toLowerCase().includes(needle) || target.url.toLowerCase().includes(needle));
  }, [targets, query]);

  const counts = useMemo(
    () => ({
      all: queried.length,
      up: queried.filter((target) => target.checks.at(-1)?.up === true).length,
      down: queried.filter((target) => target.checks.at(-1)?.up === false).length,
    }),
    [queried],
  );

  const visible = useMemo(() => {
    const filtered = queried.filter((target) => {
      const last = target.checks.at(-1);
      if (filter === "up") return last?.up === true;
      if (filter === "down") return last?.up === false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "latency") return (b.checks.at(-1)?.ms ?? -1) - (a.checks.at(-1)?.ms ?? -1);
      const byStatus = statusRank(a) - statusRank(b);
      return byStatus !== 0 ? byStatus : a.name.localeCompare(b.name);
    });
  }, [queried, filter, sort]);

  const duplicate = url.trim().length > 0 && targets.some((target) => target.url === url.trim());

  function openComposer() {
    setComposerOpen(true);
  }

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setActionError(null);
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    let parsed: URL;
    try {
      parsed = new URL(trimmedUrl);
    } catch {
      setFormError("Enter a full URL starting with http:// or https://.");
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      setFormError("Enter a full URL starting with http:// or https://.");
      return;
    }
    setBusy(true);
    try {
      const created = await api.add(trimmedName, trimmedUrl);
      refreshGen.current += 1;
      setName("");
      setUrl("");
      setComposerOpen(false);
      setTargets((current) => (current.some((item) => item.id === created.id) ? current : [...current, created]));
      setFreshId(created.id);
      await refresh();
    } catch (err) {
      setFormError(humanError((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(id: string) {
    pendingRemove.current.add(id);
    setRemovingId(id);
    setActionError(null);
    setTargets((current) => current.filter((target) => target.id !== id));
    try {
      await api.remove(id);
      refreshGen.current += 1;
      setPendingId(null);
    } catch (err) {
      pendingRemove.current.delete(id);
      setActionError(humanError((err as Error).message));
      await refresh();
    } finally {
      pendingRemove.current.delete(id);
      setRemovingId(null);
    }
  }

  function onFilterKey(event: KeyboardEvent<HTMLDivElement>) {
    const order = FILTERS.map((item) => item.id);
    const index = order.indexOf(filter);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      setFilter(order[(index + 1) % order.length]);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      setFilter(order[(index - 1 + order.length) % order.length]);
    }
  }

  const syncLabel = refreshing ? "Refreshing…" : lastSync ? `Updated ${formatSync(lastSync, now)}` : "Connecting…";

  return (
    <div className="app" data-health={health}>
      <a className="skip" href="#services">Skip to services</a>
      <div className="shell">
        <header className="top rise">
          <div className="brand-row">
            <PulseMark />
            <div className="brand-copy">
              <p className="eyebrow">Service pulse</p>
              <h1>PulseWatch</h1>
            </div>
            <p className="sync">{syncLabel}</p>
          </div>
          <p className={`lede is-${headline.tone}`} aria-live="polite">{headline.text}</p>
          <Ecg />
        </header>

        {loadError && (
          <Notice action={<button type="button" className="btn btn-ghost btn-small" onClick={() => void refresh()}>Retry</button>}>
            {loadError}
          </Notice>
        )}
        {actionError && (
          <Notice action={<button type="button" className="btn btn-ghost btn-small" onClick={() => setActionError(null)}>Dismiss</button>}>
            {actionError}
          </Notice>
        )}

        {phase === "loading" && targets.length === 0 ? (
          <BoardSkeleton />
        ) : (
          <>
            {targets.length > 0 && <Insights stats={stats} />}

            {targets.length === 0 && (
              <Composer
                name={name}
                url={url}
                busy={busy}
                error={formError}
                duplicate={duplicate}
                canCancel={false}
                autoFocus={false}
                onName={setName}
                onUrl={setUrl}
                onSubmit={onAdd}
                onCancel={() => setComposerOpen(false)}
              />
            )}

            {targets.length === 0 && phase !== "error" && <Steps />}

            {targets.length > 0 && (
              <>
                <section className="board" id="services" aria-labelledby="services-title">
                  <div className="toolbar">
                    <h2 id="services-title" className="section-title">
                      Services <span className="count">{visible.length}</span>
                    </h2>
                    <div className="tools">
                      <div className="search">
                        <SearchIcon />
                        <label className="sr-only" htmlFor="service-search">Search services</label>
                        <input
                          ref={searchRef}
                          id="service-search"
                          className="input"
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="Search services"
                          type="search"
                        />
                        {query ? (
                          <button type="button" className="search-clear" aria-label="Clear search" onClick={() => { setQuery(""); searchRef.current?.focus(); }}>
                            ×
                          </button>
                        ) : (
                          <kbd className="kbd">/</kbd>
                        )}
                      </div>
                      <div className="seg" role="radiogroup" aria-label="Filter services" onKeyDown={onFilterKey}>
                        {FILTERS.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            role="radio"
                            aria-checked={filter === item.id}
                            tabIndex={filter === item.id ? 0 : -1}
                            onClick={() => setFilter(item.id)}
                          >
                            {item.label}
                            <span className="seg-count">{counts[item.id]}</span>
                          </button>
                        ))}
                      </div>
                      <label className="sort">
                        <span className="sr-only">Sort services</span>
                        <select className="select" value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="Sort services">
                          <option value="attention">Needs attention</option>
                          <option value="name">Name</option>
                          <option value="latency">Slowest</option>
                        </select>
                      </label>
                      {!showComposer && (
                        <button type="button" className="btn btn-primary" onClick={openComposer}>
                          Watch a service
                        </button>
                      )}
                    </div>
                  </div>

                  {showComposer && (
                    <Composer
                      name={name}
                      url={url}
                      busy={busy}
                      error={formError}
                      duplicate={duplicate}
                      canCancel
                      autoFocus
                      onName={setName}
                      onUrl={setUrl}
                      onSubmit={onAdd}
                      onCancel={() => setComposerOpen(false)}
                    />
                  )}

                  {visible.length === 0 ? (
                    <div className="filter-empty">
                      <p>{emptyCopy(query, filter)}</p>
                      <button
                        type="button"
                        className="btn btn-ghost btn-small"
                        onClick={() => { setQuery(""); setFilter("all"); }}
                      >
                        Clear filters
                      </button>
                    </div>
                  ) : (
                    <ul className="services">
                      {visible.map((target) => (
                        <ServiceCard
                          key={target.id}
                          target={target}
                          now={now}
                          fresh={freshId === target.id}
                          confirming={pendingId === target.id}
                          removing={removingId === target.id}
                          onAskRemove={() => setPendingId(target.id)}
                          onCancelRemove={() => setPendingId(null)}
                          onConfirmRemove={() => void onRemove(target.id)}
                        />
                      ))}
                    </ul>
                  )}
                </section>
                <ActivityList targets={targets} now={now} />
              </>
            )}
          </>
        )}

        <footer className="colophon">
          PulseWatch stores the last 30 checks for each service on this machine. The board refreshes every few seconds.
        </footer>
      </div>
    </div>
  );
}

function emptyCopy(query: string, filter: Filter): string {
  if (query.trim()) return "No services match that search.";
  if (filter === "down") return "Nothing is down right now.";
  return "No services are up right now.";
}

function formatSync(at: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - at) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

function SearchIcon() {
  return (
    <svg className="search-icon" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12.5 12.5 L17 17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
