import { useState } from "react";
import type { Target } from "../api";
import { activityDetail, activityLead, activityLog, formatAgo } from "../lib/stats";

const PREVIEW = 6;

export function ActivityList({ targets, now }: { targets: Target[]; now: number }) {
  const items = activityLog(targets);
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items.slice(0, 24) : items.slice(0, PREVIEW);

  return (
    <section className="activity" aria-labelledby="activity-title">
      <div className="section-head">
        <h2 id="activity-title" className="section-title">Activity</h2>
        <p className="section-copy">Status changes only. A steady service stays quiet.</p>
      </div>
      {shown.length === 0 ? (
        <p className="quiet">No status changes yet. The first readings will leave a trail here.</p>
      ) : (
        <ol className="timeline">
          {shown.map((item) => (
            <li key={item.id}>
              <time className="when" dateTime={new Date(item.at).toISOString()}>
                {formatAgo(item.at, now)}
              </time>
              <span className={`rail ${item.kind}`} aria-hidden="true" />
              <div>
                <p className="event-name">{activityLead(item)}</p>
                <p className="event-detail">{activityDetail(item)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {items.length > PREVIEW && (
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setExpanded((open) => !open)} aria-expanded={expanded}>
          {expanded ? "Show fewer" : `Show earlier activity (${items.length - PREVIEW} more)`}
        </button>
      )}
    </section>
  );
}
