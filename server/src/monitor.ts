import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import client from "prom-client";

export interface Check { at: number; up: boolean; ms: number; status?: number }
export interface Target { id: string; name: string; url: string; checks: Check[] }

const DATA_FILE = process.env.DATA_FILE ?? path.join(process.cwd(), "data", "targets.json");
const INTERVAL_MS = Number(process.env.CHECK_INTERVAL_MS ?? 15_000);
const MAX_CHECKS = 30;

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });
const upGauge = new client.Gauge({ name: "pulsewatch_target_up", help: "1 if target is up", labelNames: ["name"], registers: [registry] });
const latencyGauge = new client.Gauge({ name: "pulsewatch_target_latency_ms", help: "Last latency (ms)", labelNames: ["name"], registers: [registry] });
const checksTotal = new client.Counter({ name: "pulsewatch_checks_total", help: "Checks run", labelNames: ["result"], registers: [registry] });

let targets: Target[] = [];
let timer: NodeJS.Timeout | undefined;

function load() {
  try { targets = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch { targets = []; }
}
function save() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(targets));
  fs.renameSync(tmp, DATA_FILE);
}

async function probe(t: Target) {
  const start = Date.now();
  let check: Check;
  try {
    const res = await fetch(t.url, { method: "GET", signal: AbortSignal.timeout(8000), redirect: "follow" });
    check = { at: start, up: res.ok, ms: Date.now() - start, status: res.status };
  } catch {
    check = { at: start, up: false, ms: Date.now() - start };
  }
  t.checks = [...t.checks, check].slice(-MAX_CHECKS);
  upGauge.set({ name: t.name }, check.up ? 1 : 0);
  latencyGauge.set({ name: t.name }, check.ms);
  checksTotal.inc({ result: check.up ? "up" : "down" });
}

export async function runAll() {
  await Promise.all(targets.map(probe));
  save();
}

export const store = {
  list: () => targets,
  async add(name: string, url: string) {
    const t: Target = { id: randomUUID(), name, url, checks: [] };
    targets.push(t);
    await probe(t);
    save();
    return t;
  },
  remove(id: string) {
    const t = targets.find((x) => x.id === id);
    if (!t) return false;
    targets = targets.filter((x) => x.id !== id);
    upGauge.remove({ name: t.name });
    latencyGauge.remove({ name: t.name });
    save();
    return true;
  },
};

export function start() {
  load();
  timer = setInterval(() => void runAll(), INTERVAL_MS);
  void runAll();
}
export function stop() { if (timer) clearInterval(timer); save(); }
