export function PulseMark() {
  return (
    <span className="mark" aria-hidden="true">
      <span className="mark-ring" />
      <span className="mark-core" />
    </span>
  );
}

function EcgPath() {
  return (
    <svg className="ecg-svg" viewBox="0 0 640 56" focusable="false">
      <path d="M0 30 H78 L96 30 L110 20 L124 30 L140 30 L156 6 L174 50 L192 30 H330 L348 30 L362 22 L376 30 L392 8 L410 50 L428 30 H640" />
    </svg>
  );
}

export function Ecg() {
  return (
    <div className="ecg-wrap" aria-hidden="true">
      <div className="ecg-track">
        <EcgPath />
        <EcgPath />
      </div>
    </div>
  );
}
