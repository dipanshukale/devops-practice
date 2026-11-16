import type { BoardStats } from "../lib/stats";
import { formatMs, formatPct } from "../lib/stats";

export function Insights({ stats }: { stats: BoardStats }) {
  const uptime = stats.uptime == null ? "Waiting for checks" : `${formatPct(stats.uptime)} of recent checks`;
  const attention = stats.down === 0 ? "Nothing failing" : "Open right now";

  return (
    <section className="insights" aria-label="Board summary">
      <article className="insight rise">
        <p className="kicker">Watching</p>
        <p className="stat">{stats.total}</p>
        <p className="hint">{stats.total === 1 ? "service on this board" : "services on this board"}</p>
      </article>
      <article className={`insight rise rise-2 ${stats.down === 0 && stats.pending === 0 ? "is-good" : ""}`}>
        <p className="kicker">Responding</p>
        <p className="stat">{stats.up}</p>
        <p className="hint">{uptime}</p>
      </article>
      <article className={`insight rise rise-3 ${stats.down > 0 ? "is-alert" : ""}`}>
        <p className="kicker">Need attention</p>
        <p className="stat">{stats.down}</p>
        <p className="hint">{attention}</p>
      </article>
      <article className="insight rise rise-4">
        <p className="kicker">Typical latency</p>
        <p className="stat">{stats.median == null ? "—" : formatMs(stats.median)}</p>
        <p className="hint">Median of the latest samples</p>
      </article>
    </section>
  );
}
