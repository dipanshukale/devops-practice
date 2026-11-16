import { useEffect, useRef, type FormEvent } from "react";

export function Composer({
  name,
  url,
  busy,
  error,
  duplicate,
  canCancel,
  autoFocus,
  onName,
  onUrl,
  onSubmit,
  onCancel,
}: {
  name: string;
  url: string;
  busy: boolean;
  error: string | null;
  duplicate: boolean;
  canCancel: boolean;
  autoFocus: boolean;
  onName: (value: string) => void;
  onUrl: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}) {
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) nameRef.current?.focus();
  }, [autoFocus]);

  return (
    <section className="panel rise" aria-labelledby="composer-title">
      <div className="panel-head">
        <h2 id="composer-title">Watch a service</h2>
        <p>Give it a name and an address that should stay reachable.</p>
      </div>
      <form id="composer" className="add-form" onSubmit={onSubmit} aria-busy={busy}>
        <div className="field">
          <label htmlFor="service-name">Service name</label>
          <input
            ref={nameRef}
            id="service-name"
            className="input"
            value={name}
            onChange={(event) => onName(event.target.value)}
            placeholder="Payments API"
            required
            maxLength={40}
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="service-url">Health check URL</label>
          <input
            id="service-url"
            className="input"
            value={url}
            onChange={(event) => onUrl(event.target.value)}
            placeholder="https://example.com/health"
            required
            type="url"
            inputMode="url"
            spellCheck={false}
            autoComplete="off"
            maxLength={2000}
          />
        </div>
        <div className="form-actions">
          {canCancel && (
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
          )}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Checking…" : "Start watching"}
          </button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {!error && duplicate && (
          <p className="form-note">This URL is already on the board. You can still watch it under another name.</p>
        )}
      </form>
    </section>
  );
}
