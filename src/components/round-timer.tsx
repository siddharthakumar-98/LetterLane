export function RoundTimer({
  remainingMs,
  bonusMs,
  running,
  label = 'Your time',
  announce = true,
}: {
  remainingMs: number;
  bonusMs: number;
  running: boolean;
  label?: string;
  announce?: boolean;
}) {
  const seconds = Math.ceil(remainingMs / 1000);
  const low = running && seconds <= 20;
  return (
    <div className={`match-clock ${low ? 'time-low' : ''}`}>
      <span className="timer-label">{label}</span>
      <strong role="timer" aria-label={`${label} remaining`} aria-live="off">
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
      </strong>
      {bonusMs > 0 && (
        <small className="timer-bonus">+{bonusMs / 1000}s last guess</small>
      )}
      <span className="sr-only" role="status">
        {low && announce
          ? seconds === 0
            ? 'Your time is up.'
            : 'Twenty seconds or less remaining.'
          : ''}
      </span>
    </div>
  );
}
