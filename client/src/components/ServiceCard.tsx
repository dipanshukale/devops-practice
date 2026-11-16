import { useEffect, useRef } from "react";
import type { Target } from "../api";
import { formatAgo, formatMs, formatPct, latencyNote, uptimeRatio } from "../lib/stats";
import { Sparkline } from "./Sparkline";
import { Tip } from "./Tip";

export function ServiceCard({
  target,
  now,
  fresh,
  confirming,
  removing,
  onAskRemove,
  onCancelRemove,
  onConfirmRemove,
}: {
  target: Target;
  now: number;
  fresh: boolean;
  confirming: boolean;
  removing: boolean;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const askRef = useRef<HTMLButtonElement>(null);
  const last = target.checks.at(-1);
  const status = !last ? "pending" : last.up ? "up" : "down";
  const note = latencyNote(target.checks);
  const ratio = uptimeRatio(target.checks);
  const uptimeLabel = ratio == null ? "No history yet" : target.checks.length < 2 ? "One sample so far" : `${formatPct(ratio)} uptime`;

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  function cancel() {
    onCancelRemove();
    requestAnimationFrame(() => askRef.current?.focus());
  }

  return (
    <li className={`service is-${status} ${fresh ? "is-fresh" : ""}`} id={`service-${target.id}`}>
      <div className="service-main">
        <div className="identity">
          <span className={`dot ${status}`} aria-hidden="true" />
          <div className="identity-copy">
            <div className="name-row">
              <h3 id={`name-${target.id}`}>{target.name}</h3>
              <span className={`badge badge-${status}`}>{status === "pending" ? "Checking" : status === "up" ? "Up" : "Down"}</span>
            </div>
            <a className="url" href={target.url} target="_blank" rel="noreferrer" title={target.url}>
              {target.url}
            </a>
            {!last && <p className="note">First check in progress</p>}
            {note && <p className={`note ${note.tone}`}>{note.text}</p>}
          </div>
        </div>
        <Sparkline checks={target.checks} />
        <div className="stat-col">
          <p className="latency">{!last ? "—" : last.up ? formatMs(last.ms) : "Down"}</p>
          {ratio != null && target.checks.length >= 2 ? (
            <Tip label={`Healthy responses among the last ${target.checks.length} checks kept for this service.`}>
              <span className="substat">{uptimeLabel}</span>
            </Tip>
          ) : (
            <p className="substat">{uptimeLabel}</p>
          )}
          <p className="substat">{last ? `Checked ${formatAgo(last.at, now)}` : "Waiting"}</p>
        </div>
        {!confirming && (
          <button
            ref={askRef}
            type="button"
            className="btn btn-ghost btn-small"
            onClick={onAskRemove}
            aria-label={`Stop watching ${target.name}`}
          >
            Stop watching
          </button>
        )}
      </div>
      {confirming && (
        <div className="confirm" role="group" aria-label={`Remove ${target.name}`}>
          <p>Remove {target.name} and its recent history?</p>
          <div className="confirm-actions">
            <button type="button" className="btn btn-ghost btn-small" onClick={cancel} disabled={removing}>
              Keep
            </button>
            <button ref={confirmRef} type="button" className="btn btn-danger btn-small" onClick={onConfirmRemove} disabled={removing}>
              {removing ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
