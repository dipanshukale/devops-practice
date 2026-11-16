import type { Check, Target } from "../api";

export interface BoardStats {
  total: number;
  up: number;
  down: number;
  pending: number;
  median: number | null;
  uptime: number | null;
}

export type Health = "idle" | "clear" | "alert";
export type HeadlineTone = "idle" | "good" | "alert" | "wait";

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function uptimeRatio(checks: Check[]): number | null {
  if (checks.length === 0) return null;
  return checks.filter((check) => check.up).length / checks.length;
}

export function boardStats(targets: Target[]): BoardStats {
  let up = 0;
  let down = 0;
  let pending = 0;
  let checks = 0;
  let healthy = 0;
  const latencies: number[] = [];

  for (const target of targets) {
    const last = target.checks.at(-1);
    if (!last) pending += 1;
    else if (last.up) up += 1;
    else down += 1;
    if (last) latencies.push(last.ms);
    for (const check of target.checks) {
      checks += 1;
      if (check.up) healthy += 1;
    }
  }

  return {
    total: targets.length,
    up,
    down,
    pending,
    median: median(latencies),
    uptime: checks === 0 ? null : healthy / checks,
  };
}

export function boardHealth(stats: BoardStats): Health {
  if (stats.total === 0) return "idle";
  if (stats.down > 0) return "alert";
  return "clear";
}

export function boardHeadline(stats: BoardStats): { text: string; tone: HeadlineTone } {
  if (stats.total === 0) return { text: "Nothing on the board yet.", tone: "idle" };
  if (stats.down === 1) return { text: "1 service needs attention.", tone: "alert" };
  if (stats.down > 1) return { text: `${stats.down} services need attention.`, tone: "alert" };
  if (stats.pending === stats.total) return { text: "Waiting on the first readings.", tone: "wait" };
  if (stats.pending > 0) return { text: "Some services are still being checked.", tone: "wait" };
  if (stats.total === 1) return { text: "The service is responding.", tone: "good" };
  return { text: `All ${stats.total} services are responding.`, tone: "good" };
}

export function formatMs(ms: number): string {
  const rounded = Math.max(0, Math.round(ms));
  if (rounded < 1000) return `${rounded} ms`;
  const seconds = rounded / 1000;
  return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
}

export function formatPct(ratio: number): string {
  const pct = ratio * 100;
  if (pct >= 99.95) return "100%";
  if (pct === 0) return "0%";
  if (pct < 10 || pct > 90) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

export function formatAgo(at: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - at) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** A short note only when the latest sample says something worth noticing. */
export function latencyNote(checks: Check[]): { text: string; tone: "bad" | "warn" | "good" } | null {
  const last = checks.at(-1);
  if (!last) return null;
  if (!last.up) {
    return {
      text: last.status ? `Failed with HTTP ${last.status}` : "No response from the host",
      tone: "bad",
    };
  }
  const previous = checks.slice(0, -1).filter((check) => check.up).map((check) => check.ms);
  if (previous.length < 3) return null;
  const typical = median(previous);
  if (typical == null) return null;
  if (last.ms > typical * 1.7 && last.ms - typical > 80) {
    return { text: "Slower than its recent pace", tone: "warn" };
  }
  if (last.ms < typical * 0.6 && typical - last.ms > 40) {
    return { text: "Faster than its recent pace", tone: "good" };
  }
  return null;
}

export type ActivityKind = "online" | "failed" | "recovered" | "down";

export interface ActivityItem {
  id: string;
  at: number;
  name: string;
  kind: ActivityKind;
  ms: number;
  status?: number;
}

/** Status changes only, so a quiet board stays quiet. */
export function activityLog(targets: Target[]): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const target of targets) {
    let previous: boolean | null = null;
    target.checks.forEach((check, index) => {
      if (previous === null) {
        items.push({
          id: `${target.id}-${check.at}-start`,
          at: check.at,
          name: target.name,
          kind: check.up ? "online" : "failed",
          ms: check.ms,
          status: check.status,
        });
      } else if (previous !== check.up) {
        items.push({
          id: `${target.id}-${check.at}-${index}`,
          at: check.at,
          name: target.name,
          kind: check.up ? "recovered" : "down",
          ms: check.ms,
          status: check.status,
        });
      }
      previous = check.up;
    });
  }
  return items.sort((a, b) => b.at - a.at || a.name.localeCompare(b.name));
}

export function activityLead(item: ActivityItem): string {
  switch (item.kind) {
    case "online":
      return `${item.name} came online`;
    case "failed":
      return `${item.name} failed its first check`;
    case "recovered":
      return `${item.name} recovered`;
    case "down":
      return `${item.name} stopped responding`;
  }
}

export function activityDetail(item: ActivityItem): string {
  if (item.kind === "down" || item.kind === "failed") {
    return item.status ? `HTTP ${item.status} · ${formatMs(item.ms)}` : `No response · ${formatMs(item.ms)}`;
  }
  return formatMs(item.ms);
}

export function humanError(message: string): string {
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Can’t reach PulseWatch right now. Check that the server is running, then try again.";
  }
  if (/invalid url|must be http/i.test(message)) {
    return "Enter a full URL starting with http:// or https://.";
  }
  if (/target limit/i.test(message)) {
    return "This board is full at 50 services. Remove one to watch another.";
  }
  if (/not found/i.test(message)) return "That service is no longer on the board.";
  return message || "Something went wrong. Try again.";
}
