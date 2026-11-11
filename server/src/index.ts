import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import path from "node:path";
import fs from "node:fs";
import { z } from "zod";
import * as monitor from "./monitor.js";

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_DIR = path.resolve(process.env.PUBLIC_DIR ?? "public");
const app = express();
let ready = false;
let shuttingDown = false;

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use((req, res, next) => { // structured access log
  const start = Date.now();
  res.on("finish", () => {
    if (req.path === "/healthz" || req.path === "/readyz") return;
    console.log(JSON.stringify({ level: "info", method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start }));
  });
  next();
});

// Probes + metrics
app.get("/healthz", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));
app.get("/readyz", (_req, res) => (ready && !shuttingDown ? res.json({ status: "ready" }) : res.status(503).json({ status: "not ready" })));
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", monitor.registry.contentType);
  res.send(await monitor.registry.metrics());
});

// API
const NewTarget = z.object({
  name: z.string().trim().min(1).max(40),
  url: z.string().url().refine((u) => /^https?:\/\//.test(u), "Must be http(s)"),
});
app.get("/api/targets", (_req, res) => res.json(monitor.store.list()));
app.post("/api/targets", async (req, res) => {
  const parsed = NewTarget.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  if (monitor.store.list().length >= 50) return res.status(409).json({ error: "Target limit reached (50)" });
  res.status(201).json(await monitor.store.add(parsed.data.name, parsed.data.url));
});
app.delete("/api/targets/:id", (req, res) =>
  monitor.store.remove(req.params.id) ? res.status(204).end() : res.status(404).json({ error: "Not found" }));

// React app
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR, { maxAge: "1h", index: false }));
  app.get("*", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(JSON.stringify({ level: "error", msg: err.message }));
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(PORT, () => {
  monitor.start();
  ready = true;
  console.log(JSON.stringify({ level: "info", msg: `listening on ${PORT}` }));
});

function shutdown(signal: string) {
  console.log(JSON.stringify({ level: "info", msg: `${signal} received, draining` }));
  shuttingDown = true;
  monitor.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
