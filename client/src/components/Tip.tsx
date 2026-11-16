import { useId, type ReactNode } from "react";

export function Tip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className="tip">
      <span className="tip-target" tabIndex={0} aria-describedby={id}>
        {children}
      </span>
      <span role="tooltip" id={id} className="tip-bubble">
        {label}
      </span>
    </span>
  );
}
