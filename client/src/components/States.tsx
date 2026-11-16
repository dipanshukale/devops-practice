import type { ReactNode } from "react";

export function BoardSkeleton() {
  return (
    <div className="skeleton-wrap" role="status">
      <span className="sr-only">Loading services</span>
      <div className="insights" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="skeleton insight-skel" />
        ))}
      </div>
      <div className="skeleton card-skel" aria-hidden="true" />
      <div className="skeleton card-skel" aria-hidden="true" />
    </div>
  );
}

export function Notice({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="notice" role="alert">
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Steps() {
  return (
    <ol className="steps">
      <li>
        <span>Name it</span>
        Something you will recognize at 2 a.m.
      </li>
      <li>
        <span>Paste a URL</span>
        A health check, homepage, or any address that should answer.
      </li>
      <li>
        <span>Watch the pulse</span>
        PulseWatch keeps the last 30 checks and flags status changes.
      </li>
    </ol>
  );
}
