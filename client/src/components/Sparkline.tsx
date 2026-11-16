import type { Check } from "../api";

export function Sparkline({ checks }: { checks: Check[] }) {
  if (checks.length === 0) {
    return <div className="spark spark-empty" aria-hidden="true"><span /></div>;
  }

  const max = Math.max(200, ...checks.map((check) => check.ms));
  const failed = checks.filter((check) => !check.up).length;
  const last = checks[checks.length - 1];
  const label = `Last ${checks.length} checks, ${failed} failed. Latest was ${last.up ? "up" : "down"} in ${Math.round(last.ms)} milliseconds.`;

  return (
    <div className="spark" role="img" aria-label={label}>
      {checks.map((check, index) => (
        <span
          key={`${check.at}-${index}`}
          className={check.up ? "up" : "down"}
          style={{
            height: `${Math.max(14, (check.ms / max) * 100)}%`,
            animationDelay: `${Math.min(index, 24) * 16}ms`,
          }}
          title={`${check.up ? "Up" : "Down"}, ${Math.round(check.ms)} ms`}
        />
      ))}
    </div>
  );
}
